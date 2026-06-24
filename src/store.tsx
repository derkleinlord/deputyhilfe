import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type { AppData, Template, Module, ViewType, FormData, ApiTemplate, ApiModule, ModuleType } from "./types";
import {
  normalizeAppData,
  normalizeFormData,
  createBlankFormData,
  buildCase,
  sanitizeFileName,
  downloadText,
  copyToClipboard,
  normalizeImportedJson,
  getActiveTemplate,
  getSelectedTemplate,
  loadData,
  persist,
} from "./data";
import { api } from "./api";
import { getSocket } from "./socket";
import { useAuth } from "./auth";

interface ToastState {
  message: string;
  visible: boolean;
}

interface AppState {
  data: AppData;
  activeView: ViewType;
  selectedTemplateId: string;
  toast: ToastState;
  loading: boolean;
  conflictInfo: { templateId: string; message: string } | null;
}

interface AppContextValue extends AppState {
  setView: (view: ViewType) => void;
  showToast: (message: string) => void;
  selectTemplate: (id: string) => void;
  setActiveTemplate: (id: string) => void;
  updateCaseTitle: (title: string) => void;
  updateIncludeTitle: (include: boolean) => void;
  updateModuleValue: (moduleId: string, text: string) => void;
  updateKeyValueRow: (moduleId: string, label: string, value: string) => void;
  clearCurrentForm: () => void;
  exportData: () => void;
  importData: (file: File) => void;
  copyOutput: () => void;
  downloadOutput: () => void;
  createTemplate: () => void;
  duplicateTemplate: () => void;
  deleteTemplate: () => void;
  addModule: () => void;
  removeModule: (index: number) => void;
  moveModule: (index: number, direction: number) => void;
  updateTemplateMeta: (updates: Partial<Template>) => void;
  updateModuleMeta: (index: number, updates: Partial<Module>) => void;
  addRowToModule: (index: number) => void;
  updateModuleRow: (moduleIndex: number, rowIndex: number, updates: Partial<{ Label: string; Unit: string }>) => void;
  removeModuleRow: (moduleIndex: number, rowIndex: number) => void;
  getPreviewText: () => string;
  resolveConflict: (action: "server" | "local") => void;
  guestMode: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

function apiModuleToLocal(m: ApiModule): Module {
  let rows: { Label: string; Unit: string }[] = [];
  if (m.rows_json) {
    try { rows = JSON.parse(m.rows_json); } catch { rows = []; }
  }
  return {
    Id: String(m.id),
    Label: m.label,
    Type: m.field_type as ModuleType,
    Placeholder: m.placeholder || "",
    Rows: rows,
    RenderHeading: !!m.show_heading,
    BulletPrefix: m.bullet_prefix || null,
  };
}

function apiTemplateToLocal(t: ApiTemplate): Template {
  return {
    Id: String(t.id),
    Name: t.name,
    TitleTemplate: t.title_template || "Titel:",
    Header: t.header_text || "",
    Heading: t.document_heading || "",
    Separator: t.separator_line || "------------------------------------------------",
    IncludeTitleByDefault: !!t.output_title_by_default,
    Modules: (t.modules || []).map(apiModuleToLocal),
  };
}


export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isGuest = !user;

  const [data, setData] = useState<AppData>(() => {
    if (isGuest) return normalizeAppData(loadData());
    return normalizeAppData(null);
  });
  const [activeView, setActiveView] = useState<ViewType>("write");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [toast, setToast] = useState<ToastState>({ message: "", visible: false });
  const [loading, setLoading] = useState(!isGuest);
  const [conflictInfo, setConflictInfo] = useState<{ templateId: string; message: string } | null>(null);

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: "", visible: false }), 2600);
  }, []);

  // Guest mode: persist to localStorage on every data change
  const prevDataRef = { current: data };
  prevDataRef.current = data;

  useEffect(() => {
    if (isGuest) {
      persist(data);
    }
  }, [data, isGuest]);

  // Auth mode: load from API on mount
  useEffect(() => {
    if (isGuest) return;

    let cancelled = false;
    async function loadFromApi() {
      try {
        const apiTemplates = await api.get<ApiTemplate[]>("/api/templates");
        if (cancelled) return;

        const templates = apiTemplates.map(apiTemplateToLocal);
        const autosaves: Record<string, FormData> = {};
        for (const t of templates) autosaves[t.Id] = createBlankFormData(t);

        // Try to carry over local autosaves
        const localData = loadData();
        if (localData?.Autosaves) {
          for (const [tid, fd] of Object.entries(localData.Autosaves)) {
            if (autosaves[tid]) {
              autosaves[tid] = normalizeFormData(
                templates.find((t) => t.Id === tid) || templates[0],
                fd as unknown as Record<string, unknown>
              );
            }
          }
        }

        const activeId = templates.length > 0 ? templates[0].Id : "";
        setData({ SchemaVersion: 3, Templates: templates, ActiveTemplateId: activeId, Autosaves: autosaves });
        setSelectedTemplateId(activeId);
      } catch (err) {
        showToast(`Fehler beim Laden: ${(err as Error).message}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadFromApi();
    return () => { cancelled = true; };
  }, [isGuest, showToast]);

  // Socket listeners for real-time updates (auth mode only)
  useEffect(() => {
    if (isGuest) return;
    const socket = getSocket();
    if (!socket) return;

    const reloadTemplates = async () => {
      try {
        const apiTemplates = await api.get<ApiTemplate[]>("/api/templates");
        const templates = apiTemplates.map(apiTemplateToLocal);
        setData((prev) => {
          const autosaves = { ...prev.Autosaves };
          for (const t of templates) {
            if (!autosaves[t.Id]) autosaves[t.Id] = createBlankFormData(t);
          }
          return {
            ...prev,
            Templates: templates,
            Autosaves: autosaves,
            ActiveTemplateId: prev.ActiveTemplateId && templates.some((t) => t.Id === prev.ActiveTemplateId)
              ? prev.ActiveTemplateId : templates[0]?.Id || "",
          };
        });
        setSelectedTemplateId((prev) => templates.some((t) => t.Id === prev) ? prev : templates[0]?.Id || "");
      } catch {}
    };

    socket.on("template:created", () => reloadTemplates());
    socket.on("template:updated", (payload: unknown) => {
      const apiT = payload as ApiTemplate;
      setConflictInfo({ templateId: String(apiT.id), message: "Diese Vorlage wurde von einem anderen Nutzer aktualisiert." });
      reloadTemplates();
    });
    socket.on("template:modules-updated", (payload: unknown) => {
      const apiT = payload as ApiTemplate;
      setConflictInfo({ templateId: String(apiT.id), message: "Module dieser Vorlage wurden von einem anderen Nutzer geändert." });
      reloadTemplates();
    });
    socket.on("template:deleted", (payload: unknown) => {
      const { id } = payload as { id: number };
      const localId = String(id);
      setData((prev) => {
        const remaining = prev.Templates.filter((t) => t.Id !== localId);
        const autosaves = { ...prev.Autosaves };
        delete autosaves[localId];
        return { ...prev, Templates: remaining, Autosaves: autosaves, ActiveTemplateId: prev.ActiveTemplateId === localId ? remaining[0]?.Id || "" : prev.ActiveTemplateId };
      });
    });

    return () => { socket.off("template:created"); socket.off("template:updated"); socket.off("template:deleted"); socket.off("template:modules-updated"); };
  }, [isGuest, showToast]);

  const setView = useCallback((view: ViewType) => setActiveView(view), []);

  const selectTemplate = useCallback((id: string) => setSelectedTemplateId(id), []);

  const setActiveTemplate = useCallback((id: string) => {
    setData((prev) => {
      const template = prev.Templates.find((t) => t.Id === id) || prev.Templates[0];
      const autosaves = { ...prev.Autosaves };
      if (!autosaves[template.Id]) autosaves[template.Id] = createBlankFormData(template);
      return { ...prev, ActiveTemplateId: template.Id, Autosaves: autosaves };
    });
    setSelectedTemplateId(id);
  }, []);

  const updateCaseTitle = useCallback((title: string) => {
    setData((prev) => {
      const t = getActiveTemplate(prev);
      const a = { ...prev.Autosaves };
      if (!a[t.Id]) a[t.Id] = createBlankFormData(t);
      a[t.Id] = { ...a[t.Id], Title: title };
      return { ...prev, Autosaves: a };
    });
  }, []);

  const updateIncludeTitle = useCallback((include: boolean) => {
    setData((prev) => {
      const t = getActiveTemplate(prev);
      const a = { ...prev.Autosaves };
      if (!a[t.Id]) a[t.Id] = createBlankFormData(t);
      a[t.Id] = { ...a[t.Id], IncludeTitle: include };
      return { ...prev, Autosaves: a };
    });
  }, []);

  const updateModuleValue = useCallback((moduleId: string, text: string) => {
    setData((prev) => {
      const t = getActiveTemplate(prev);
      const a = { ...prev.Autosaves };
      if (!a[t.Id]) a[t.Id] = createBlankFormData(t);
      const v = { ...a[t.Id].Values };
      v[moduleId] = { ...v[moduleId], Text: text };
      a[t.Id] = { ...a[t.Id], Values: v };
      return { ...prev, Autosaves: a };
    });
  }, []);

  const updateKeyValueRow = useCallback((moduleId: string, label: string, value: string) => {
    setData((prev) => {
      const t = getActiveTemplate(prev);
      const a = { ...prev.Autosaves };
      if (!a[t.Id]) a[t.Id] = createBlankFormData(t);
      const v = { ...a[t.Id].Values };
      const r = { ...(v[moduleId]?.Rows || {}) };
      r[label] = value;
      v[moduleId] = { ...v[moduleId], Rows: r };
      a[t.Id] = { ...a[t.Id], Values: v };
      return { ...prev, Autosaves: a };
    });
  }, []);

  const clearCurrentForm = useCallback(() => {
    setData((prev) => {
      const t = getActiveTemplate(prev);
      const a = { ...prev.Autosaves };
      a[t.Id] = createBlankFormData(t);
      return { ...prev, Autosaves: a };
    });
  }, []);

  const exportData = useCallback(() => {
    downloadText("aktenschreiben-daten.json", JSON.stringify(data, null, 2), "application/json");
  }, [data]);

  const importData = useCallback((file: File) => {
    const reader = new FileReader();
    reader.addEventListener("load", async () => {
      try {
        const incoming = normalizeImportedJson(JSON.parse(String(reader.result)));
        if (isGuest) {
          const newData = normalizeAppData(incoming);
          setData(newData);
          setSelectedTemplateId(newData.ActiveTemplateId);
          showToast("Daten wurden importiert.");
        } else {
          let imported = 0, skipped = 0;
          for (const t of incoming.Templates) {
            const existing = data.Templates.find((et) => et.Name === t.Name);
            if (existing) {
              if (window.confirm(`Vorlage "${t.Name}" existiert bereits. Überschreiben? (OK = ja, Abbrechen = nein)`)) {
                try { await api.put(`/api/templates/${existing.Id}`, { name: t.Name, title_template: t.TitleTemplate, header_text: t.Header, document_heading: t.Heading, separator_line: t.Separator, output_title_by_default: t.IncludeTitleByDefault }); imported++; } catch { skipped++; }
              } else { skipped++; }
            } else {
              try {
                await api.post("/api/templates", { name: t.Name, title_template: t.TitleTemplate, header_text: t.Header, document_heading: t.Heading, separator_line: t.Separator, output_title_by_default: t.IncludeTitleByDefault, modules: t.Modules.map((m) => ({ label: m.Label, field_type: m.Type, placeholder: m.Placeholder, bullet_prefix: m.BulletPrefix, show_heading: m.RenderHeading, rows_json: m.Rows.length > 0 ? JSON.stringify(m.Rows) : null })) });
                imported++;
              } catch { skipped++; }
            }
          }
          const apiTemplates = await api.get<ApiTemplate[]>("/api/templates");
          const templates = apiTemplates.map(apiTemplateToLocal);
          const autosaves: Record<string, FormData> = {};
          for (const t of templates) autosaves[t.Id] = data.Autosaves[t.Id] || createBlankFormData(t);
          setData({ SchemaVersion: 3, Templates: templates, ActiveTemplateId: data.ActiveTemplateId, Autosaves: autosaves });
          showToast(`${imported} Vorlagen importiert, ${skipped} übersprungen.`);
        }
      } catch (error) { showToast(`Import fehlgeschlagen: ${(error as Error).message}`); }
    });
    reader.readAsText(file, "utf-8");
  }, [isGuest, data, showToast]);

  const copyOutput = useCallback(() => {
    const t = getActiveTemplate(data);
    copyToClipboard(buildCase(t, data.Autosaves[t.Id])).then(() => showToast("Akte wurde kopiert."));
  }, [data, showToast]);

  const downloadOutput = useCallback(() => {
    const t = getActiveTemplate(data);
    downloadText(`${sanitizeFileName(data.Autosaves[t.Id]?.Title || "akte")}.txt`, buildCase(t, data.Autosaves[t.Id]));
  }, [data]);

  const createTemplate = useCallback(async () => {
    if (isGuest) {
      showToast("Bitte melden Sie sich an, um Vorlagen zu bearbeiten.");
      return;
    }
    try {
      const nt = await api.post<ApiTemplate>("/api/templates", { name: "Neue Vorlage", title_template: "Titel:", header_text: "Sheriff-Department der Vereinigten Staaten von Amerika", document_heading: "Tatbestand", separator_line: "------------------------------------------------", output_title_by_default: false, modules: [{ label: "Inhalt", field_type: "multiline", placeholder: "Text eingeben", bullet_prefix: null, show_heading: true, rows_json: null }] });
      const local = apiTemplateToLocal(nt);
      setData((prev) => { const a = { ...prev.Autosaves }; a[local.Id] = createBlankFormData(local); return { ...prev, Templates: [...prev.Templates, local], ActiveTemplateId: local.Id, Autosaves: a }; });
      setSelectedTemplateId(local.Id);
      setActiveView("templates");
    } catch (err) { showToast(`Fehler: ${(err as Error).message}`); }
  }, [isGuest, showToast]);

  const duplicateTemplate = useCallback(async () => {
    if (isGuest) { showToast("Bitte melden Sie sich an, um Vorlagen zu bearbeiten."); return; }
    const source = getSelectedTemplate(data, selectedTemplateId);
    if (!source) return;
    try {
      const dup = await api.post<ApiTemplate>(`/api/templates/${source.Id}/duplicate`, { name: `${source.Name} Kopie` });
      const local = apiTemplateToLocal(dup);
      setData((prev) => { const a = { ...prev.Autosaves }; a[local.Id] = createBlankFormData(local); return { ...prev, Templates: [...prev.Templates, local], Autosaves: a }; });
      setSelectedTemplateId(local.Id);
    } catch (err) { showToast(`Fehler: ${(err as Error).message}`); }
  }, [isGuest, data, selectedTemplateId, showToast]);

  const deleteTemplate = useCallback(async () => {
    if (isGuest) { showToast("Bitte melden Sie sich an, um Vorlagen zu bearbeiten."); return; }
    if (data.Templates.length <= 1) { showToast("Mindestens eine Vorlage muss vorhanden sein."); return; }
    const template = getSelectedTemplate(data, selectedTemplateId);
    if (!template || !window.confirm(`Vorlage "${template.Name}" wirklich löschen?`)) return;
    try {
      await api.delete(`/api/templates/${template.Id}`);
      setData((prev) => {
        const rem = prev.Templates.filter((t) => t.Id !== template.Id);
        const a = { ...prev.Autosaves }; delete a[template.Id];
        return { ...prev, Templates: rem, Autosaves: a, ActiveTemplateId: rem[0]?.Id || "" };
      });
    } catch (err) { showToast(`Fehler: ${(err as Error).message}`); }
  }, [isGuest, data, selectedTemplateId, showToast]);

  const addModule = useCallback(async () => {
    if (isGuest) { showToast("Bitte melden Sie sich an, um Module zu bearbeiten."); return; }
    const template = getSelectedTemplate(data, selectedTemplateId);
    if (!template) return;
    try {
      await api.post(`/api/templates/${template.Id}/modules`, { label: "Neues Modul", field_type: "multiline", placeholder: "", bullet_prefix: null, show_heading: true, rows_json: null });
      const updated = await api.get<ApiTemplate>(`/api/templates/${template.Id}`);
      const local = apiTemplateToLocal(updated);
      setData((prev) => ({ ...prev, Templates: prev.Templates.map((t) => t.Id === local.Id ? local : t) }));
    } catch (err) { showToast(`Fehler: ${(err as Error).message}`); }
  }, [isGuest, data, selectedTemplateId, showToast]);

  const removeModule = useCallback(async (index: number) => {
    if (isGuest) { showToast("Bitte melden Sie sich an, um Module zu bearbeiten."); return; }
    const template = getSelectedTemplate(data, selectedTemplateId);
    if (!template || template.Modules.length <= 1) return;
    try {
      await api.delete(`/api/templates/${template.Id}/modules/${template.Modules[index].Id}`);
      const updated = await api.get<ApiTemplate>(`/api/templates/${template.Id}`);
      setData((prev) => ({ ...prev, Templates: prev.Templates.map((t) => t.Id === String(updated.id) ? apiTemplateToLocal(updated) : t) }));
    } catch (err) { showToast(`Fehler: ${(err as Error).message}`); }
  }, [isGuest, data, selectedTemplateId, showToast]);

  const moveModule = useCallback(async (index: number, direction: number) => {
    if (isGuest) { showToast("Bitte melden Sie sich an, um Module zu bearbeiten."); return; }
    const template = getSelectedTemplate(data, selectedTemplateId);
    if (!template) return;
    const target = index + direction;
    if (target < 0 || target >= template.Modules.length) return;
    const reordered = [...template.Modules];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved);
    try {
      await api.put(`/api/templates/${template.Id}/modules/reorder`, { moduleIds: reordered.map((m) => Number(m.Id)) });
      const updated = await api.get<ApiTemplate>(`/api/templates/${template.Id}`);
      setData((prev) => ({ ...prev, Templates: prev.Templates.map((t) => t.Id === String(updated.id) ? apiTemplateToLocal(updated) : t) }));
    } catch (err) { showToast(`Fehler: ${(err as Error).message}`); }
  }, [isGuest, data, selectedTemplateId, showToast]);

  const updateTemplateMeta = useCallback(async (updates: Partial<Template>) => {
    if (isGuest) { return; }
    const template = getSelectedTemplate(data, selectedTemplateId);
    if (!template) return;
    const apiUpdates: Record<string, unknown> = {};
    if ("Name" in updates) apiUpdates.name = updates.Name;
    if ("TitleTemplate" in updates) apiUpdates.title_template = updates.TitleTemplate;
    if ("Header" in updates) apiUpdates.header_text = updates.Header;
    if ("Heading" in updates) apiUpdates.document_heading = updates.Heading;
    if ("Separator" in updates) apiUpdates.separator_line = updates.Separator;
    if ("IncludeTitleByDefault" in updates) apiUpdates.output_title_by_default = updates.IncludeTitleByDefault;
    try {
      await api.put(`/api/templates/${template.Id}`, apiUpdates);
      setData((prev) => ({ ...prev, Templates: prev.Templates.map((t) => t.Id === template.Id ? { ...t, ...updates } : t) }));
    } catch (err) { showToast(`Fehler: ${(err as Error).message}`); }
  }, [isGuest, data, selectedTemplateId, showToast]);

  const updateModuleMeta = useCallback(async (index: number, updates: Partial<Module>) => {
    if (isGuest) { return; }
    const template = getSelectedTemplate(data, selectedTemplateId);
    if (!template || !template.Modules[index]) return;
    const m = template.Modules[index];
    const apiUpdates: Record<string, unknown> = {};
    if ("Label" in updates) apiUpdates.label = updates.Label;
    if ("Type" in updates) apiUpdates.field_type = updates.Type;
    if ("Placeholder" in updates) apiUpdates.placeholder = updates.Placeholder;
    if ("BulletPrefix" in updates) apiUpdates.bullet_prefix = updates.BulletPrefix;
    if ("RenderHeading" in updates) apiUpdates.show_heading = updates.RenderHeading;
    try {
      await api.put(`/api/templates/${template.Id}/modules/${m.Id}`, apiUpdates);
      setData((prev) => {
        const t = getSelectedTemplate(prev, selectedTemplateId);
        if (!t || !t.Modules[index]) return prev;
        const nm = [...t.Modules];
        nm[index] = { ...nm[index], ...updates };
        return { ...prev, Templates: prev.Templates.map((tm) => tm.Id === t.Id ? { ...t, Modules: nm } : tm) };
      });
    } catch (err) { showToast(`Fehler: ${(err as Error).message}`); }
  }, [isGuest, data, selectedTemplateId, showToast]);

  const addRowToModule = useCallback(async (moduleIndex: number) => {
    if (isGuest) { return; }
    const template = getSelectedTemplate(data, selectedTemplateId);
    if (!template || !template.Modules[moduleIndex]) return;
    const m = template.Modules[moduleIndex];
    const newRows = [...m.Rows, { Label: "Neue Zeile", Unit: "" }];
    try {
      await api.put(`/api/templates/${template.Id}/modules/${m.Id}`, { rows_json: JSON.stringify(newRows) });
      setData((prev) => {
        const t = getSelectedTemplate(prev, selectedTemplateId);
        if (!t || !t.Modules[moduleIndex]) return prev;
        const nm = [...t.Modules];
        nm[moduleIndex] = { ...nm[moduleIndex], Rows: newRows };
        return { ...prev, Templates: prev.Templates.map((tm) => tm.Id === t.Id ? { ...t, Modules: nm } : tm) };
      });
    } catch {}
  }, [isGuest, data, selectedTemplateId]);

  const updateModuleRow = useCallback((moduleIndex: number, rowIndex: number, rowUpdates: Partial<{ Label: string; Unit: string }>) => {
    const template = getSelectedTemplate(data, selectedTemplateId);
    if (!template || !template.Modules[moduleIndex]) return;
    const m = template.Modules[moduleIndex];
    const newRows = [...m.Rows];
    newRows[rowIndex] = { ...newRows[rowIndex], ...rowUpdates };
    setData((prev) => {
      const t = getSelectedTemplate(prev, selectedTemplateId);
      if (!t || !t.Modules[moduleIndex]) return prev;
      const nm = [...t.Modules];
      nm[moduleIndex] = { ...nm[moduleIndex], Rows: newRows };
      return { ...prev, Templates: prev.Templates.map((tm) => tm.Id === t.Id ? { ...t, Modules: nm } : tm) };
    });
    if (!isGuest) {
      api.put(`/api/templates/${template.Id}/modules/${m.Id}`, { rows_json: JSON.stringify(newRows) }).catch(() => {});
    }
  }, [isGuest, data, selectedTemplateId]);

  const removeModuleRow = useCallback(async (moduleIndex: number, rowIndex: number) => {
    if (isGuest) { return; }
    const template = getSelectedTemplate(data, selectedTemplateId);
    if (!template || !template.Modules[moduleIndex]) return;
    const m = template.Modules[moduleIndex];
    const newRows = [...m.Rows];
    newRows.splice(rowIndex, 1);
    if (newRows.length === 0) newRows.push({ Label: "Eintrag", Unit: "" });
    try {
      await api.put(`/api/templates/${template.Id}/modules/${m.Id}`, { rows_json: JSON.stringify(newRows) });
      setData((prev) => {
        const t = getSelectedTemplate(prev, selectedTemplateId);
        if (!t || !t.Modules[moduleIndex]) return prev;
        const nm = [...t.Modules];
        nm[moduleIndex] = { ...nm[moduleIndex], Rows: newRows };
        return { ...prev, Templates: prev.Templates.map((tm) => tm.Id === t.Id ? { ...t, Modules: nm } : tm) };
      });
    } catch {}
  }, [isGuest, data, selectedTemplateId]);

  const getPreviewText = useCallback(() => {
    const t = getActiveTemplate(data);
    return data.Autosaves[t.Id] ? buildCase(t, data.Autosaves[t.Id]) : "";
  }, [data]);

  const resolveConflict = useCallback((action: "server" | "local") => {
    if (action === "server" && conflictInfo) {
      api.get<ApiTemplate>(`/api/templates/${Number(conflictInfo.templateId)}`).then((apiT) => {
        const local = apiTemplateToLocal(apiT);
        setData((prev) => ({ ...prev, Templates: prev.Templates.map((t) => t.Id === local.Id ? local : t) }));
      });
    }
    setConflictInfo(null);
  }, [conflictInfo]);

  const value: AppContextValue = {
    data, activeView, selectedTemplateId, toast, loading, conflictInfo,
    setView, showToast, selectTemplate, setActiveTemplate,
    updateCaseTitle, updateIncludeTitle, updateModuleValue, updateKeyValueRow,
    clearCurrentForm,
    exportData, importData, copyOutput, downloadOutput,
    createTemplate, duplicateTemplate, deleteTemplate,
    addModule, removeModule, moveModule,
    updateTemplateMeta, updateModuleMeta, addRowToModule, updateModuleRow, removeModuleRow,
    getPreviewText, resolveConflict,
    guestMode: isGuest,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
}
