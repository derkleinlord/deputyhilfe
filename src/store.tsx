import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { AppData, Template, Module, ViewType } from "./types";
import {
  loadData,
  persist,
  normalizeAppData,
  normalizeTemplate,
  normalizeFormData,
  createBlankFormData,
  buildCase,
  deepClone,
  createId,
  sanitizeFileName,
  downloadText,
  copyToClipboard,
  normalizeImportedJson,
  getActiveTemplate,
  getSelectedTemplate
} from "./data";

interface ToastState {
  message: string;
  visible: boolean;
}

interface AppState {
  data: AppData;
  activeView: ViewType;
  selectedTemplateId: string;
  toast: ToastState;
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
}

const AppContext = createContext<AppContextValue | null>(null);

function loadInitialData(): AppData {
  return normalizeAppData(loadData());
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(loadInitialData);
  const [activeView, setActiveView] = useState<ViewType>("write");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => {
    const d = loadInitialData();
    return d.ActiveTemplateId;
  });
  const [toast, setToast] = useState<ToastState>({ message: "", visible: false });

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => {
      setToast({ message: "", visible: false });
    }, 2600);
  }, []);

  const persistAndUpdate = useCallback(
    (newData: AppData, cb?: () => void) => {
      persist(newData);
      setData(newData);
      cb?.();
    },
    []
  );

  const setView = useCallback((view: ViewType) => {
    setActiveView(view);
  }, []);

  const selectTemplate = useCallback(
    (id: string) => {
      setSelectedTemplateId(id);
    },
    []
  );

  const setActiveTemplate = useCallback(
    (id: string) => {
      const newData = deepClone(data);
      newData.ActiveTemplateId = id;
      const template = getActiveTemplate(newData);
      ensureAutosaveOnData(newData, template);
      persistAndUpdate(newData, () => {
        setSelectedTemplateId(id);
      });
    },
    [data, persistAndUpdate]
  );

  const updateCaseTitle = useCallback(
    (title: string) => {
      const newData = deepClone(data);
      const activeTemplate = getActiveTemplate(newData);
      ensureAutosaveOnData(newData, activeTemplate);
      const formData = newData.Autosaves[activeTemplate.Id];
      formData.Title = title;
      persistAndUpdate(newData);
    },
    [data, persistAndUpdate]
  );

  const updateIncludeTitle = useCallback(
    (include: boolean) => {
      const newData = deepClone(data);
      const activeTemplate = getActiveTemplate(newData);
      ensureAutosaveOnData(newData, activeTemplate);
      newData.Autosaves[activeTemplate.Id].IncludeTitle = include;
      persistAndUpdate(newData);
    },
    [data, persistAndUpdate]
  );

  const updateModuleValue = useCallback(
    (moduleId: string, text: string) => {
      const newData = deepClone(data);
      const activeTemplate = getActiveTemplate(newData);
      ensureAutosaveOnData(newData, activeTemplate);
      if (newData.Autosaves[activeTemplate.Id].Values[moduleId]) {
        newData.Autosaves[activeTemplate.Id].Values[moduleId].Text = text;
      }
      persistAndUpdate(newData);
    },
    [data, persistAndUpdate]
  );

  const updateKeyValueRow = useCallback(
    (moduleId: string, label: string, value: string) => {
      const newData = deepClone(data);
      const activeTemplate = getActiveTemplate(newData);
      ensureAutosaveOnData(newData, activeTemplate);
      if (newData.Autosaves[activeTemplate.Id].Values[moduleId]) {
        newData.Autosaves[activeTemplate.Id].Values[moduleId].Rows[label] = value;
      }
      persistAndUpdate(newData);
    },
    [data, persistAndUpdate]
  );

  const saveCurrentDraft = useCallback(() => {
    const newData = deepClone(data);
    const template = getActiveTemplate(newData);
    const formData = normalizeFormData(
      template,
      newData.Autosaves[template.Id] as unknown as Record<string, unknown>
    );
    const name =
      formData.Title?.trim() || `${template.Name} ${new Date().toLocaleString("de-DE")}`;
    const existing = newData.Drafts.find(
      (d) => d.TemplateId === template.Id && d.Name === name
    );

    const draft = {
      Id: existing?.Id ?? createId("draft"),
      Name: name,
      TemplateId: template.Id,
      TemplateName: template.Name,
      Data: deepClone(formData),
      UpdatedAt: new Date().toISOString()
    };

    if (existing) {
      Object.assign(existing, draft);
    } else {
      newData.Drafts.push(draft);
    }

    persistAndUpdate(newData, () => showToast("Entwurf gespeichert."));
  }, [data, persistAndUpdate, showToast]);

  const clearCurrentForm = useCallback(() => {
    const newData = deepClone(data);
    const template = getActiveTemplate(newData);
    newData.Autosaves[template.Id] = createBlankFormData(template);
    persistAndUpdate(newData);
  }, [data, persistAndUpdate]);

  const loadDraft = useCallback(
    (id: string) => {
      const newData = deepClone(data);
      const draft = newData.Drafts.find((d) => d.Id === id);
      if (!draft) {
        return;
      }
      const template =
        newData.Templates.find((t) => t.Id === draft.TemplateId) ?? getActiveTemplate(newData);
      newData.ActiveTemplateId = template.Id;
      newData.Autosaves[template.Id] = normalizeFormData(
        template,
        deepClone(draft.Data) as unknown as Record<string, unknown>
      );
      persistAndUpdate(newData, () => {
        setSelectedTemplateId(template.Id);
        setActiveView("write");
        showToast("Entwurf geladen.");
      });
    },
    [data, persistAndUpdate, showToast]
  );

  const deleteDraft = useCallback(
    (id: string) => {
      const newData = deepClone(data);
      newData.Drafts = newData.Drafts.filter((d) => d.Id !== id);
      persistAndUpdate(newData);
    },
    [data, persistAndUpdate]
  );

  const clearDrafts = useCallback(() => {
    if (data.Drafts.length === 0) {
      return;
    }
    const newData = deepClone(data);
    newData.Drafts = [];
    persistAndUpdate(newData);
  }, [data, persistAndUpdate]);

  const exportData = useCallback(() => {
    downloadText(
      "aktenschreiben-daten.json",
      JSON.stringify(data, null, 2),
      "application/json"
    );
  }, [data]);

  const importData = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        try {
          const incoming = normalizeImportedJson(JSON.parse(String(reader.result)));
          incoming.ActiveTemplateId = incoming.ActiveTemplateId || incoming.Templates[0]?.Id || "";
          const newData = normalizeAppData(incoming);
          persistAndUpdate(newData, () => {
            setSelectedTemplateId(newData.ActiveTemplateId);
            showToast("Daten wurden importiert.");
          });
        } catch (error) {
          showToast(`Import fehlgeschlagen: ${(error as Error).message}`);
        }
      });
      reader.readAsText(file, "utf-8");
    },
    [persistAndUpdate, showToast]
  );

  const copyOutput = useCallback(() => {
    const text = buildCase(getActiveTemplate(data), data.Autosaves[getActiveTemplate(data).Id]);
    copyToClipboard(text).then(() => showToast("Akte wurde kopiert."));
  }, [data, showToast]);

  const downloadOutput = useCallback(() => {
    const template = getActiveTemplate(data);
    const title = sanitizeFileName(data.Autosaves[template.Id]?.Title || "akte");
    const text = buildCase(template, data.Autosaves[template.Id]);
    downloadText(`${title}.txt`, text);
  }, [data]);

  const downloadDraft = useCallback(
    (id: string) => {
      const draft = data.Drafts.find((d) => d.Id === id);
      if (!draft) {
        return;
      }
      const template =
        data.Templates.find((t) => t.Id === draft.TemplateId) ?? getActiveTemplate(data);
      const output = buildCase(template, draft.Data);
      downloadText(`${sanitizeFileName(draft.Name)}.txt`, output);
    },
    [data]
  );

  const createTemplate = useCallback(() => {
    const template = normalizeTemplate({
      Id: createId("template"),
      Name: "Neue Vorlage",
      TitleTemplate: "Titel:",
      Header: "Sheriff-Department der Vereinigten Staaten von Amerika",
      Heading: "Tatbestand",
      Separator: "------------------------------------------------",
      IncludeTitleByDefault: false,
      Modules: [
        {
          Id: createId("module"),
          Label: "Inhalt",
          Type: "multiline",
          Placeholder: "Text eingeben",
          Rows: [],
          RenderHeading: true,
          BulletPrefix: null
        }
      ]
    });
    const newData = deepClone(data);
    newData.Templates.push(template);
    newData.ActiveTemplateId = template.Id;
    newData.Autosaves[template.Id] = createBlankFormData(template);
    persistAndUpdate(newData, () => {
      setSelectedTemplateId(template.Id);
      setActiveView("templates");
    });
  }, [data, persistAndUpdate]);

  const duplicateTemplate = useCallback(() => {
    const source = getSelectedTemplate(data, selectedTemplateId);
    if (!source) {
      return;
    }
    const copy = deepClone(source);
    copy.Id = createId("template");
    copy.Name = `${source.Name} Kopie`;
    copy.Modules = copy.Modules.map((m) => ({ ...m, Id: createId("module") }));
    const newData = deepClone(data);
    newData.Templates.push(copy);
    persistAndUpdate(newData, () => {
      setSelectedTemplateId(copy.Id);
    });
  }, [data, selectedTemplateId, persistAndUpdate]);

  const deleteTemplate = useCallback(() => {
    if (data.Templates.length <= 1) {
      showToast("Mindestens eine Vorlage muss vorhanden sein.");
      return;
    }
    const template = getSelectedTemplate(data, selectedTemplateId);
    if (!template) {
      return;
    }
    const accepted = window.confirm(`Vorlage "${template.Name}" wirklich löschen?`);
    if (!accepted) {
      return;
    }
    const newData = deepClone(data);
    newData.Templates = newData.Templates.filter((t) => t.Id !== template.Id);
    delete newData.Autosaves[template.Id];
    newData.ActiveTemplateId = newData.Templates[0].Id;
    persistAndUpdate(newData, () => {
      setSelectedTemplateId(newData.ActiveTemplateId);
    });
  }, [data, selectedTemplateId, persistAndUpdate, showToast]);

  const addModule = useCallback(() => {
    const template = getSelectedTemplate(data, selectedTemplateId);
    if (!template) {
      return;
    }
    const newData = deepClone(data);
    const t = getSelectedTemplate(newData, selectedTemplateId);
    t.Modules.push({
      Id: createId("module"),
      Label: "Neues Modul",
      Type: "multiline",
      Placeholder: "",
      Rows: [],
      RenderHeading: true,
      BulletPrefix: null
    });
    const activeTemplate = getActiveTemplate(newData);
    newData.Autosaves[activeTemplate.Id] = normalizeFormData(
      activeTemplate,
      newData.Autosaves[activeTemplate.Id] as unknown as Record<string, unknown>
    );
    persistAndUpdate(newData);
  }, [data, selectedTemplateId, persistAndUpdate]);

  const removeModule = useCallback(
    (index: number) => {
      const template = getSelectedTemplate(data, selectedTemplateId);
      if (!template || template.Modules.length <= 1) {
        return;
      }
      const newData = deepClone(data);
      const t = getSelectedTemplate(newData, selectedTemplateId);
      t.Modules.splice(index, 1);
      const activeTemplate = getActiveTemplate(newData);
      newData.Autosaves[activeTemplate.Id] = normalizeFormData(
        activeTemplate,
        newData.Autosaves[activeTemplate.Id] as unknown as Record<string, unknown>
      );
      persistAndUpdate(newData);
    },
    [data, selectedTemplateId, persistAndUpdate]
  );

  const moveModule = useCallback(
    (index: number, direction: number) => {
      const template = getSelectedTemplate(data, selectedTemplateId);
      if (!template) {
        return;
      }
      const target = index + direction;
      if (target < 0 || target >= template.Modules.length) {
        return;
      }
      const newData = deepClone(data);
      const t = getSelectedTemplate(newData, selectedTemplateId);
      const [mod] = t.Modules.splice(index, 1);
      t.Modules.splice(target, 0, mod);
      const activeTemplate = getActiveTemplate(newData);
      newData.Autosaves[activeTemplate.Id] = normalizeFormData(
        activeTemplate,
        newData.Autosaves[activeTemplate.Id] as unknown as Record<string, unknown>
      );
      persistAndUpdate(newData);
    },
    [data, selectedTemplateId, persistAndUpdate]
  );

  const updateTemplateMeta = useCallback(
    (updates: Partial<Template>) => {
      const newData = deepClone(data);
      const template = getSelectedTemplate(newData, selectedTemplateId);
      if (!template) {
        return;
      }
      Object.assign(template, updates);
      if ("Name" in updates && !template.Name.trim()) {
        template.Name = "Unbenannte Vorlage";
      }
      const activeTemplate = getActiveTemplate(newData);
      newData.Autosaves[activeTemplate.Id] = normalizeFormData(
        activeTemplate,
        newData.Autosaves[activeTemplate.Id] as unknown as Record<string, unknown>
      );
      persistAndUpdate(newData);
    },
    [data, selectedTemplateId, persistAndUpdate]
  );

  const updateModuleMeta = useCallback(
    (index: number, updates: Partial<Module>) => {
      const newData = deepClone(data);
      const template = getSelectedTemplate(newData, selectedTemplateId);
      if (!template || !template.Modules[index]) {
        return;
      }
      Object.assign(template.Modules[index], updates);
      if ("Type" in updates && updates.Type === "keyValues" && template.Modules[index].Rows.length === 0) {
        template.Modules[index].Rows.push({ Label: "Eintrag", Unit: "" });
      }
      const activeTemplate = getActiveTemplate(newData);
      newData.Autosaves[activeTemplate.Id] = normalizeFormData(
        activeTemplate,
        newData.Autosaves[activeTemplate.Id] as unknown as Record<string, unknown>
      );
      persistAndUpdate(newData);
    },
    [data, selectedTemplateId, persistAndUpdate]
  );

  const addRowToModule = useCallback(
    (moduleIndex: number) => {
      const newData = deepClone(data);
      const template = getSelectedTemplate(newData, selectedTemplateId);
      if (!template || !template.Modules[moduleIndex]) {
        return;
      }
      template.Modules[moduleIndex].Rows.push({ Label: "Neue Zeile", Unit: "" });
      const activeTemplate = getActiveTemplate(newData);
      newData.Autosaves[activeTemplate.Id] = normalizeFormData(
        activeTemplate,
        newData.Autosaves[activeTemplate.Id] as unknown as Record<string, unknown>
      );
      persistAndUpdate(newData);
    },
    [data, selectedTemplateId, persistAndUpdate]
  );

  const updateModuleRow = useCallback(
    (moduleIndex: number, rowIndex: number, updates: Partial<{ Label: string; Unit: string }>) => {
      const newData = deepClone(data);
      const template = getSelectedTemplate(newData, selectedTemplateId);
      if (!template || !template.Modules[moduleIndex] || !template.Modules[moduleIndex].Rows[rowIndex]) {
        return;
      }
      Object.assign(template.Modules[moduleIndex].Rows[rowIndex], updates);
      const activeTemplate = getActiveTemplate(newData);
      newData.Autosaves[activeTemplate.Id] = normalizeFormData(
        activeTemplate,
        newData.Autosaves[activeTemplate.Id] as unknown as Record<string, unknown>
      );
      persistAndUpdate(newData);
    },
    [data, selectedTemplateId, persistAndUpdate]
  );

  const removeModuleRow = useCallback(
    (moduleIndex: number, rowIndex: number) => {
      const newData = deepClone(data);
      const template = getSelectedTemplate(newData, selectedTemplateId);
      if (!template || !template.Modules[moduleIndex]) {
        return;
      }
      template.Modules[moduleIndex].Rows.splice(rowIndex, 1);
      if (template.Modules[moduleIndex].Rows.length === 0) {
        template.Modules[moduleIndex].Rows.push({ Label: "Eintrag", Unit: "" });
      }
      const activeTemplate = getActiveTemplate(newData);
      newData.Autosaves[activeTemplate.Id] = normalizeFormData(
        activeTemplate,
        newData.Autosaves[activeTemplate.Id] as unknown as Record<string, unknown>
      );
      persistAndUpdate(newData);
    },
    [data, selectedTemplateId, persistAndUpdate]
  );

  const getPreviewText = useCallback(() => {
    const template = getActiveTemplate(data);
    const formData = data.Autosaves[template.Id];
    return formData ? buildCase(template, formData) : "";
  }, [data]);

  const value: AppContextValue = {
    data,
    activeView,
    selectedTemplateId,
    toast,
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
    getPreviewText
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

function ensureAutosaveOnData(data: AppData, template: Template): void {
  data.Autosaves[template.Id] = normalizeFormData(
    template,
    data.Autosaves[template.Id] as unknown as Record<string, unknown>
  );
}
