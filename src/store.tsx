import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type { AppData, Template, Module, ViewType, FormData, Draft, ApiTemplate, ApiModule, ApiDraft, ModuleType } from "./types";
import {
  normalizeAppData,
  normalizeFormData,
  createBlankFormData,
  buildCase,
  deepClone,
  sanitizeFileName,
  downloadText,
  copyToClipboard,
  normalizeImportedJson,
  getActiveTemplate,
  getSelectedTemplate,
  loadData,
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
  saveCurrentDraft: () => void;
  clearCurrentForm: () => void;
  loadDraft: (id: string) => void;
  deleteDraft: (id: string) => void;
  clearDrafts: () => void;
  exportData: () => void;
  importData: (file: File) => void;
  copyOutput: () => void;
  downloadOutput: () => void;
  downloadDraft: (id: string) => void;
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
  importLocalData: () => void;
  localDataAvailable: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

function apiModuleToLocal(m: ApiModule): Module {
  let rows: { Label: string; Unit: string }[] = [];
  if (m.rows_json) {
    try {
      rows = JSON.parse(m.rows_json);
    } catch { rows = []; }
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

function draftToLocal(d: ApiDraft, templates: Template[]): Draft {
  let formData: FormData;
  try {
    formData = JSON.parse(d.form_data_json);
  } catch {
    const t = templates.find((t) => t.Id === String(d.template_id));
    formData = createBlankFormData(t || templates[0]);
  }
  return {
    Id: String(d.id),
    Name: d.title || "Unbenannter Entwurf",
    TemplateId: String(d.template_id),
    TemplateName: d.template_name || "Vorlage",
    Data: formData,
    UpdatedAt: d.updated_at,
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { user, isTemplateManager } = useAuth();
  const [data, setData] = useState<AppData>(() => normalizeAppData(null));
  const [activeView, setActiveView] = useState<ViewType>("write");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [toast, setToast] = useState<ToastState>({ message: "", visible: false });
  const [loading, setLoading] = useState(true);
  const [conflictInfo, setConflictInfo] = useState<{ templateId: string; message: string } | null>(null);
  const [localDataAvailable] = useState(() => !!loadData());

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => {
      setToast({ message: "", visible: false });
    }, 2600);
  }, []);

  // Load data from API when user is authenticated
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadFromApi() {
      try {
        const [apiTemplates, apiDrafts] = await Promise.all([
          api.get<ApiTemplate[]>("/api/templates"),
          api.get<ApiDraft[]>("/api/drafts"),
        ]);

        if (cancelled) return;

        const templates = apiTemplates.map(apiTemplateToLocal);
        const drafts = apiDrafts.map((d) => draftToLocal(d, templates));

        // Build autosaves for all templates
        const autosaves: Record<string, FormData> = {};
        for (const t of templates) {
          autosaves[t.Id] = createBlankFormData(t);
        }

        // Try to load local autosaves for migration continuity
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

        const appData: AppData = {
          SchemaVersion: 3,
          Templates: templates,
          ActiveTemplateId: activeId,
          Autosaves: autosaves,
          Drafts: drafts,
        };

        setData(appData);
        setSelectedTemplateId(activeId);
      } catch (err) {
        showToast(`Fehler beim Laden: ${(err as Error).message}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadFromApi();
    return () => { cancelled = true; };
  }, [user, showToast]);

  // Socket listeners for real-time updates
  useEffect(() => {
    if (!user) return;

    const socket = getSocket();
    if (!socket) return;

    const handleUpdate = (event: string) => async (payload: unknown) => {
      const apiTemplate = payload as ApiTemplate;
      const apiId = apiTemplate.id;
      const localId = String(apiId);

      // Reload templates from API
      try {
        const [apiTemplates] = await Promise.all([
          api.get<ApiTemplate[]>("/api/templates"),
        ]);
        const templates = apiTemplates.map(apiTemplateToLocal);

        setData((prev) => {
          // Check if user is editing this template
          const isEditing = prev.ActiveTemplateId === localId;
          const autosaves = { ...prev.Autosaves };
          // Keep existing autosaves for templates that still exist
          for (const t of templates) {
            if (!autosaves[t.Id]) {
              autosaves[t.Id] = createBlankFormData(t);
            }
          }

          // If user is actively working on this template, flag conflict
          if (isEditing && event !== "template:deleted") {
            setConflictInfo({
              templateId: localId,
              message: `Diese Vorlage wurde von einem anderen Nutzer aktualisiert.`,
            });
          }

          return {
            ...prev,
            Templates: templates,
            Autosaves: autosaves,
            ActiveTemplateId: prev.ActiveTemplateId && templates.some((t) => t.Id === prev.ActiveTemplateId)
              ? prev.ActiveTemplateId
              : templates[0]?.Id || "",
          };
        });

        setSelectedTemplateId((prev) =>
          templates.some((t) => t.Id === prev) ? prev : templates[0]?.Id || ""
        );
      } catch {}
    };

    socket.on("template:created", handleUpdate("created"));
    socket.on("template:updated", handleUpdate("updated"));
    socket.on("template:modules-updated", handleUpdate("modules-updated"));

    socket.on("template:deleted", (payload: unknown) => {
      const { id } = payload as { id: number };
      const localId = String(id);
      setData((prev) => {
        const remaining = prev.Templates.filter((t) => t.Id !== localId);
        const autosaves = { ...prev.Autosaves };
        delete autosaves[localId];
        return {
          ...prev,
          Templates: remaining,
          Autosaves: autosaves,
          ActiveTemplateId: prev.ActiveTemplateId === localId
            ? remaining[0]?.Id || ""
            : prev.ActiveTemplateId,
        };
      });
      setSelectedTemplateId((prev) => prev === localId ? data.Templates[0]?.Id || "" : prev);
    });

    return () => {
      socket.off("template:created");
      socket.off("template:updated");
      socket.off("template:deleted");
      socket.off("template:modules-updated");
    };
  }, [user, showToast]);

  const setView = useCallback((view: ViewType) => {
    setActiveView(view);
  }, []);

  const selectTemplate = useCallback((id: string) => {
    setSelectedTemplateId(id);
  }, []);

  const setActiveTemplate = useCallback((id: string) => {
    setData((prev) => {
      const template = prev.Templates.find((t) => t.Id === id) || prev.Templates[0];
      const autosaves = { ...prev.Autosaves };
      if (!autosaves[template.Id]) {
        autosaves[template.Id] = createBlankFormData(template);
      }
      return { ...prev, ActiveTemplateId: template.Id, Autosaves: autosaves };
    });
    setSelectedTemplateId(id);
  }, []);

  const updateCaseTitle = useCallback((title: string) => {
    setData((prev) => {
      const template = getActiveTemplate(prev);
      const autosaves = { ...prev.Autosaves };
      const fd = { ...autosaves[template.Id], Title: title };
      autosaves[template.Id] = fd;
      return { ...prev, Autosaves: autosaves };
    });
  }, []);

  const updateIncludeTitle = useCallback((include: boolean) => {
    setData((prev) => {
      const template = getActiveTemplate(prev);
      const autosaves = { ...prev.Autosaves };
      autosaves[template.Id] = { ...autosaves[template.Id], IncludeTitle: include };
      return { ...prev, Autosaves: autosaves };
    });
  }, []);

  const updateModuleValue = useCallback((moduleId: string, text: string) => {
    setData((prev) => {
      const template = getActiveTemplate(prev);
      const autosaves = { ...prev.Autosaves };
      const values = { ...autosaves[template.Id].Values };
      values[moduleId] = { ...values[moduleId], Text: text };
      autosaves[template.Id] = { ...autosaves[template.Id], Values: values };
      return { ...prev, Autosaves: autosaves };
    });
  }, []);

  const updateKeyValueRow = useCallback((moduleId: string, label: string, value: string) => {
    setData((prev) => {
      const template = getActiveTemplate(prev);
      const autosaves = { ...prev.Autosaves };
      const values = { ...autosaves[template.Id].Values };
      const rows = { ...(values[moduleId]?.Rows || {}) };
      rows[label] = value;
      values[moduleId] = { ...values[moduleId], Rows: rows };
      autosaves[template.Id] = { ...autosaves[template.Id], Values: values };
      return { ...prev, Autosaves: autosaves };
    });
  }, []);

  const saveCurrentDraft = useCallback(async () => {
    setData((prev) => {
      const template = getActiveTemplate(prev);
      const formData = normalizeFormData(template, prev.Autosaves[template.Id] as unknown as Record<string, unknown>);
      const name = formData.Title?.trim() || `${template.Name} ${new Date().toLocaleString("de-DE")}`;

      // Save via API
      api.post("/api/drafts", {
        templateId: Number(template.Id),
        title: name,
        formData,
      }).then((saved: any) => {
        setData((p) => {
          const newDraft: Draft = {
            Id: String(saved.id),
            Name: name,
            TemplateId: template.Id,
            TemplateName: template.Name,
            Data: deepClone(formData),
            UpdatedAt: new Date().toISOString(),
          };
          return {
            ...p,
            Drafts: [newDraft, ...p.Drafts.filter((d) => d.Id !== String(saved.id))],
          };
        });
        showToast("Entwurf gespeichert.");
      }).catch((err) => {
        showToast(`Fehler beim Speichern: ${err.message}`);
      });

      return prev;
    });
  }, [showToast]);

  const clearCurrentForm = useCallback(() => {
    setData((prev) => {
      const template = getActiveTemplate(prev);
      const autosaves = { ...prev.Autosaves };
      autosaves[template.Id] = createBlankFormData(template);
      return { ...prev, Autosaves: autosaves };
    });
  }, []);

  const loadDraft = useCallback((id: string) => {
    setData((prev) => {
      const draft = prev.Drafts.find((d) => d.Id === id);
      if (!draft) return prev;

      const template = prev.Templates.find((t) => t.Id === draft.TemplateId) || getActiveTemplate(prev);
      const autosaves = { ...prev.Autosaves };
      autosaves[template.Id] = normalizeFormData(template, deepClone(draft.Data) as unknown as Record<string, unknown>);

      showToast("Entwurf geladen.");
      setActiveView("write");
      setSelectedTemplateId(template.Id);
      return { ...prev, ActiveTemplateId: template.Id, Autosaves: autosaves };
    });
  }, [showToast]);

  const deleteDraft = useCallback(async (id: string) => {
    try {
      await api.delete(`/api/drafts/${id}`);
      setData((prev) => ({
        ...prev,
        Drafts: prev.Drafts.filter((d) => d.Id !== id),
      }));
    } catch (err) {
      showToast(`Fehler beim Löschen: ${(err as Error).message}`);
    }
  }, [showToast]);

  const clearDrafts = useCallback(async () => {
    if (data.Drafts.length === 0) return;
    try {
      for (const d of data.Drafts) {
        await api.delete(`/api/drafts/${d.Id}`);
      }
      setData((prev) => ({ ...prev, Drafts: [] }));
    } catch (err) {
      showToast(`Fehler: ${(err as Error).message}`);
    }
  }, [data.Drafts, showToast]);

  const exportData = useCallback(async () => {
    const exportObj = {
      SchemaVersion: data.SchemaVersion,
      Templates: data.Templates,
      Drafts: data.Drafts,
      exportedAt: new Date().toISOString(),
    };
    downloadText(
      "aktenschreiben-daten.json",
      JSON.stringify(exportObj, null, 2),
      "application/json"
    );
  }, [data]);

  const importData = useCallback((file: File) => {
    if (!isTemplateManager) {
      showToast("Keine Berechtigung für Import.");
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", async () => {
      try {
        const incoming = normalizeImportedJson(JSON.parse(String(reader.result)));
        let imported = 0;
        let skipped = 0;

        for (const t of incoming.Templates) {
          const existing = data.Templates.find((et) => et.Name === t.Name);
          if (existing) {
            const action = window.confirm(
              `Vorlage "${t.Name}" existiert bereits. Überschreiben? (OK = überschreiben, Abbrechen = überspringen)`
            );
            if (action) {
              try {
                await api.put(`/api/templates/${existing.Id}`, {
                  name: t.Name,
                  title_template: t.TitleTemplate,
                  header_text: t.Header,
                  document_heading: t.Heading,
                  separator_line: t.Separator,
                  output_title_by_default: t.IncludeTitleByDefault,
                });
                imported++;
              } catch { skipped++; }
            } else {
              skipped++;
            }
          } else {
            try {
              await api.post("/api/templates", {
                name: t.Name,
                title_template: t.TitleTemplate,
                header_text: t.Header,
                document_heading: t.Heading,
                separator_line: t.Separator,
                output_title_by_default: t.IncludeTitleByDefault,
                modules: t.Modules.map((m) => ({
                  label: m.Label,
                  field_type: m.Type,
                  placeholder: m.Placeholder,
                  bullet_prefix: m.BulletPrefix,
                  show_heading: m.RenderHeading,
                  rows_json: m.Rows.length > 0 ? JSON.stringify(m.Rows) : null,
                })),
              });
              imported++;
            } catch { skipped++; }
          }
        }

        // Reload from API
        const apiTemplates = await api.get<ApiTemplate[]>("/api/templates");
        const apiDrafts = await api.get<ApiDraft[]>("/api/drafts");
        const templates = apiTemplates.map(apiTemplateToLocal);
        const drafts = apiDrafts.map((d) => draftToLocal(d, templates));
        const autosaves: Record<string, FormData> = {};
        for (const t of templates) {
          autosaves[t.Id] = data.Autosaves[t.Id] || createBlankFormData(t);
        }

        setData({
          SchemaVersion: 3,
          Templates: templates,
          ActiveTemplateId: data.ActiveTemplateId,
          Autosaves: autosaves,
          Drafts: drafts,
        });

        showToast(`${imported} Vorlagen importiert, ${skipped} übersprungen.`);
      } catch (error) {
        showToast(`Import fehlgeschlagen: ${(error as Error).message}`);
      }
    });
    reader.readAsText(file, "utf-8");
  }, [data, isTemplateManager, showToast]);

  const copyOutput = useCallback(() => {
    const template = getActiveTemplate(data);
    const text = buildCase(template, data.Autosaves[template.Id]);
    copyToClipboard(text).then(() => showToast("Akte wurde kopiert."));
  }, [data, showToast]);

  const downloadOutput = useCallback(() => {
    const template = getActiveTemplate(data);
    const title = sanitizeFileName(data.Autosaves[template.Id]?.Title || "akte");
    const text = buildCase(template, data.Autosaves[template.Id]);
    downloadText(`${title}.txt`, text);
  }, [data]);

  const downloadDraft = useCallback((id: string) => {
    const draft = data.Drafts.find((d) => d.Id === id);
    if (!draft) return;
    const template = data.Templates.find((t) => t.Id === draft.TemplateId) || getActiveTemplate(data);
    const output = buildCase(template, draft.Data);
    downloadText(`${sanitizeFileName(draft.Name)}.txt`, output);
  }, [data]);

  const createTemplate = useCallback(async () => {
    try {
      const newTemplate = await api.post<ApiTemplate>("/api/templates", {
        name: "Neue Vorlage",
        title_template: "Titel:",
        header_text: "Sheriff-Department der Vereinigten Staaten von Amerika",
        document_heading: "Tatbestand",
        separator_line: "------------------------------------------------",
        output_title_by_default: false,
        modules: [{
          label: "Inhalt",
          field_type: "multiline",
          placeholder: "Text eingeben",
          bullet_prefix: null,
          show_heading: true,
          rows_json: null,
        }],
      });

      const local = apiTemplateToLocal(newTemplate);
      setData((prev) => {
        const autosaves = { ...prev.Autosaves };
        autosaves[local.Id] = createBlankFormData(local);
        return {
          ...prev,
          Templates: [...prev.Templates, local],
          ActiveTemplateId: local.Id,
          Autosaves: autosaves,
        };
      });
      setSelectedTemplateId(local.Id);
      setActiveView("templates");
    } catch (err) {
      showToast(`Fehler beim Erstellen: ${(err as Error).message}`);
    }
  }, [showToast]);

  const duplicateTemplate = useCallback(async () => {
    const source = getSelectedTemplate(data, selectedTemplateId);
    if (!source) return;

    try {
      const dup = await api.post<ApiTemplate>(`/api/templates/${source.Id}/duplicate`, {
        name: `${source.Name} Kopie`,
      });
      const local = apiTemplateToLocal(dup);
      setData((prev) => {
        const autosaves = { ...prev.Autosaves };
        autosaves[local.Id] = createBlankFormData(local);
        return { ...prev, Templates: [...prev.Templates, local], Autosaves: autosaves };
      });
      setSelectedTemplateId(local.Id);
    } catch (err) {
      showToast(`Fehler beim Duplizieren: ${(err as Error).message}`);
    }
  }, [data, selectedTemplateId, showToast]);

  const deleteTemplate = useCallback(async () => {
    if (data.Templates.length <= 1) {
      showToast("Mindestens eine Vorlage muss vorhanden sein.");
      return;
    }
    const template = getSelectedTemplate(data, selectedTemplateId);
    if (!template) return;

    const accepted = window.confirm(`Vorlage "${template.Name}" wirklich löschen?`);
    if (!accepted) return;

    try {
      await api.delete(`/api/templates/${template.Id}`);
      setData((prev) => {
        const remaining = prev.Templates.filter((t) => t.Id !== template.Id);
        const autosaves = { ...prev.Autosaves };
        delete autosaves[template.Id];
        return {
          ...prev,
          Templates: remaining,
          Autosaves: autosaves,
          ActiveTemplateId: remaining[0]?.Id || "",
        };
      });
      setSelectedTemplateId(data.Templates[0]?.Id || "");
    } catch (err) {
      showToast(`Fehler beim Löschen: ${(err as Error).message}`);
    }
  }, [data, selectedTemplateId, showToast]);

  const addModule = useCallback(async () => {
    const template = getSelectedTemplate(data, selectedTemplateId);
    if (!template) return;

    try {
      await api.post(`/api/templates/${template.Id}/modules`, {
        label: "Neues Modul",
        field_type: "multiline",
        placeholder: "",
        bullet_prefix: null,
        show_heading: true,
        rows_json: null,
      });

      const updated = await api.get<ApiTemplate>(`/api/templates/${template.Id}`);
      const local = apiTemplateToLocal(updated);
      setData((prev) => ({
        ...prev,
        Templates: prev.Templates.map((t) => t.Id === local.Id ? local : t),
      }));
    } catch (err) {
      showToast(`Fehler: ${(err as Error).message}`);
    }
  }, [data, selectedTemplateId, showToast]);

  const removeModule = useCallback(async (index: number) => {
    const template = getSelectedTemplate(data, selectedTemplateId);
    if (!template || template.Modules.length <= 1) return;

    const moduleId = template.Modules[index]?.Id;
    if (!moduleId) return;

    try {
      await api.delete(`/api/templates/${template.Id}/modules/${moduleId}`);
      const updated = await api.get<ApiTemplate>(`/api/templates/${template.Id}`);
      const local = apiTemplateToLocal(updated);
      setData((prev) => ({
        ...prev,
        Templates: prev.Templates.map((t) => t.Id === local.Id ? local : t),
      }));
    } catch (err) {
      showToast(`Fehler: ${(err as Error).message}`);
    }
  }, [data, selectedTemplateId, showToast]);

  const moveModule = useCallback(async (index: number, direction: number) => {
    const template = getSelectedTemplate(data, selectedTemplateId);
    if (!template) return;

    const target = index + direction;
    if (target < 0 || target >= template.Modules.length) return;

    const reordered = [...template.Modules];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved);
    const moduleIds = reordered.map((m) => Number(m.Id));

    try {
      await api.put(`/api/templates/${template.Id}/modules/reorder`, { moduleIds });
      const updated = await api.get<ApiTemplate>(`/api/templates/${template.Id}`);
      const local = apiTemplateToLocal(updated);
      setData((prev) => ({
        ...prev,
        Templates: prev.Templates.map((t) => t.Id === local.Id ? local : t),
      }));
    } catch (err) {
      showToast(`Fehler: ${(err as Error).message}`);
    }
  }, [data, selectedTemplateId, showToast]);

  const updateTemplateMeta = useCallback(async (updates: Partial<Template>) => {
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

      setData((prev) => {
        const edited = getSelectedTemplate(prev, selectedTemplateId);
        if (!edited) return prev;
        return {
          ...prev,
          Templates: prev.Templates.map((t) => t.Id === edited.Id ? { ...edited, ...updates } : t),
        };
      });
    } catch (err) {
      showToast(`Fehler: ${(err as Error).message}`);
    }
  }, [data, selectedTemplateId, showToast]);

  const updateModuleMeta = useCallback(async (index: number, updates: Partial<Module>) => {
    setData((prev) => {
      const template = getSelectedTemplate(prev, selectedTemplateId);
      if (!template || !template.Modules[index]) return prev;

      const newModules = [...template.Modules];
      newModules[index] = { ...newModules[index], ...updates };
      const newTemplates = prev.Templates.map((t) =>
        t.Id === template.Id ? { ...template, Modules: newModules } : t
      );
      return { ...prev, Templates: newTemplates };
    });

    const template = getSelectedTemplate(data, selectedTemplateId);
    if (!template || !template.Modules[index]) return;

    const module = { ...template.Modules[index], ...updates };
    const apiUpdates: Record<string, unknown> = {};
    if ("Label" in updates) apiUpdates.label = updates.Label;
    if ("Type" in updates) apiUpdates.field_type = updates.Type;
    if ("Placeholder" in updates) apiUpdates.placeholder = updates.Placeholder;
    if ("BulletPrefix" in updates) apiUpdates.bullet_prefix = updates.BulletPrefix;
    if ("RenderHeading" in updates) apiUpdates.show_heading = updates.RenderHeading;
    if ("Rows" in updates && module.Type === "keyValues") {
      apiUpdates.rows_json = JSON.stringify(module.Rows);
    }

    try {
      await api.put(`/api/templates/${template.Id}/modules/${module.Id}`, apiUpdates);
    } catch (err) {
      showToast(`Fehler: ${(err as Error).message}`);
    }
  }, [data, selectedTemplateId, showToast]);

  const addRowToModule = useCallback(async (moduleIndex: number) => {
    setData((prev) => {
      const template = getSelectedTemplate(prev, selectedTemplateId);
      if (!template || !template.Modules[moduleIndex]) return prev;

      const newModules = [...template.Modules];
      newModules[moduleIndex] = {
        ...newModules[moduleIndex],
        Rows: [...newModules[moduleIndex].Rows, { Label: "Neue Zeile", Unit: "" }],
      };
      return {
        ...prev,
        Templates: prev.Templates.map((t) =>
          t.Id === template.Id ? { ...template, Modules: newModules } : t
        ),
      };
    });

    // Sync rows_json to server
    const template = getSelectedTemplate(data, selectedTemplateId);
    if (!template || !template.Modules[moduleIndex]) return;
    const module = template.Modules[moduleIndex];
    try {
      await api.put(`/api/templates/${template.Id}/modules/${module.Id}`, {
        rows_json: JSON.stringify([...module.Rows, { Label: "Neue Zeile", Unit: "" }]),
      });
    } catch {}
  }, [data, selectedTemplateId]);

  const updateModuleRow = useCallback((moduleIndex: number, rowIndex: number, rowUpdates: Partial<{ Label: string; Unit: string }>) => {
    setData((prev) => {
      const template = getSelectedTemplate(prev, selectedTemplateId);
      if (!template || !template.Modules[moduleIndex]) return prev;

      const newModules = [...template.Modules];
      const newRows = [...newModules[moduleIndex].Rows];
      newRows[rowIndex] = { ...newRows[rowIndex], ...rowUpdates };
      newModules[moduleIndex] = { ...newModules[moduleIndex], Rows: newRows };
      return {
        ...prev,
        Templates: prev.Templates.map((t) =>
          t.Id === template.Id ? { ...template, Modules: newModules } : t
        ),
      };
    });

    // Debounced sync to server
    const template = getSelectedTemplate(data, selectedTemplateId);
    if (!template || !template.Modules[moduleIndex]) return;
    const module = template.Modules[moduleIndex];
    const newRow = { ...module.Rows[rowIndex], ...rowUpdates };
    const newRows = [...module.Rows];
    newRows[rowIndex] = newRow;

    try {
      api.put(`/api/templates/${template.Id}/modules/${module.Id}`, {
        rows_json: JSON.stringify(newRows),
      }).catch(() => {});
    } catch {}
  }, [data, selectedTemplateId]);

  const removeModuleRow = useCallback(async (moduleIndex: number, rowIndex: number) => {
    setData((prev) => {
      const template = getSelectedTemplate(prev, selectedTemplateId);
      if (!template || !template.Modules[moduleIndex]) return prev;

      const newModules = [...template.Modules];
      const newRows = [...newModules[moduleIndex].Rows];
      newRows.splice(rowIndex, 1);
      if (newRows.length === 0) {
        newRows.push({ Label: "Eintrag", Unit: "" });
      }
      newModules[moduleIndex] = { ...newModules[moduleIndex], Rows: newRows };
      return {
        ...prev,
        Templates: prev.Templates.map((t) =>
          t.Id === template.Id ? { ...template, Modules: newModules } : t
        ),
      };
    });

    const template = getSelectedTemplate(data, selectedTemplateId);
    if (!template || !template.Modules[moduleIndex]) return;
    const module = template.Modules[moduleIndex];
    const newRows = [...module.Rows];
    newRows.splice(rowIndex, 1);
    if (newRows.length === 0) newRows.push({ Label: "Eintrag", Unit: "" });

    try {
      await api.put(`/api/templates/${template.Id}/modules/${module.Id}`, {
        rows_json: JSON.stringify(newRows),
      });
    } catch {}
  }, [data, selectedTemplateId]);

  const getPreviewText = useCallback(() => {
    const template = getActiveTemplate(data);
    const formData = data.Autosaves[template.Id];
    return formData ? buildCase(template, formData) : "";
  }, [data]);

  const resolveConflict = useCallback((action: "server" | "local") => {
    if (!conflictInfo) return;
    if (action === "server") {
      // Reload template from API
      const tid = Number(conflictInfo.templateId);
      api.get<ApiTemplate>(`/api/templates/${tid}`).then((apiT) => {
        const local = apiTemplateToLocal(apiT);
        setData((prev) => ({
          ...prev,
          Templates: prev.Templates.map((t) => t.Id === local.Id ? local : t),
        }));
      });
    }
    setConflictInfo(null);
  }, [conflictInfo]);

  const importLocalData = useCallback(() => {
    const localData = loadData();
    if (!localData) { showToast("Keine lokalen Daten gefunden."); return; }

    // Import templates
    for (const t of localData.Templates) {
      const existing = data.Templates.find((et) => et.Name === t.Name);
      if (!existing) {
        api.post("/api/templates", {
          name: t.Name,
          title_template: t.TitleTemplate,
          header_text: t.Header,
          document_heading: t.Heading,
          separator_line: t.Separator,
          output_title_by_default: t.IncludeTitleByDefault,
          modules: t.Modules.map((m) => ({
            label: m.Label,
            field_type: m.Type,
            placeholder: m.Placeholder,
            bullet_prefix: m.BulletPrefix,
            show_heading: m.RenderHeading,
            rows_json: m.Rows.length > 0 ? JSON.stringify(m.Rows) : null,
          })),
        }).catch(() => {});
      }
    }

    // Import drafts
    for (const d of localData.Drafts) {
      api.post("/api/drafts", {
        templateId: Number(d.TemplateId) || 1,
        title: d.Name,
        formData: d.Data,
      }).catch(() => {});
    }

    showToast("Lokale Daten werden importiert...");
    setTimeout(() => window.location.reload(), 1500);
  }, [data, showToast]);

  const value: AppContextValue = {
    data,
    activeView,
    selectedTemplateId,
    toast,
    loading,
    conflictInfo,
    setView,
    showToast,
    selectTemplate,
    setActiveTemplate,
    updateCaseTitle,
    updateIncludeTitle,
    updateModuleValue,
    updateKeyValueRow,
    saveCurrentDraft,
    clearCurrentForm,
    loadDraft,
    deleteDraft,
    clearDrafts,
    exportData,
    importData,
    copyOutput,
    downloadOutput,
    downloadDraft,
    createTemplate,
    duplicateTemplate,
    deleteTemplate,
    addModule,
    removeModule,
    moveModule,
    updateTemplateMeta,
    updateModuleMeta,
    addRowToModule,
    updateModuleRow,
    removeModuleRow,
    getPreviewText,
    resolveConflict,
    importLocalData,
    localDataAvailable,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}
