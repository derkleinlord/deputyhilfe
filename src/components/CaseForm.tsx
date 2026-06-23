import type { Template, FormData } from "../types";
import { moduleTypeMap } from "../types";
import { useApp } from "../store";

interface CaseFormProps {
  template: Template;
  formData: FormData;
  onSelectTemplate: (id: string) => void;
}

export default function CaseForm({ template, formData, onSelectTemplate }: CaseFormProps) {
  const { data, updateCaseTitle, updateIncludeTitle, updateModuleValue, updateKeyValueRow, saveCurrentDraft, clearCurrentForm } = useApp();

  return (
    <div className="case-form-panel">
      <div className="form-header">
        <div className="form-header-left">
          <span className="form-header-kicker">Formular</span>
          <h2 className="form-header-title">Neue Akte</h2>
        </div>
        <div className="form-header-right">
          <select
            className="field template-select-inline"
            value={data.ActiveTemplateId}
            onChange={(e) => onSelectTemplate(e.target.value)}
            aria-label="Vorlage auswählen"
          >
            {data.Templates.map((t) => (
              <option key={t.Id} value={t.Id}>
                {t.Name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-title-grid">
        <div className="field">
          <span className="field-label">Titel</span>
          <input
            type="text"
            value={formData.Title}
            onChange={(e) => updateCaseTitle(e.target.value)}
            autoComplete="off"
          />
        </div>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={formData.IncludeTitle}
            onChange={(e) => updateIncludeTitle(e.target.checked)}
          />
          <span>Titel in Ausgabe übernehmen</span>
        </label>
      </div>

      <div className="module-list">
        {template.Modules.map((module) => {
          const value = formData.Values[module.Id];
          return (
            <div key={module.Id} className="module-card">
              <div className="module-card-header">
                <div>
                  <div className="module-card-title">{module.Label}</div>
                  <div className="module-card-type">{moduleTypeMap[module.Type]}</div>
                </div>
              </div>

              {module.Placeholder && module.Type !== "keyValues" && (
                <div className="module-hint">{module.Placeholder}</div>
              )}

              {module.Type === "keyValues" ? (
                <div className="kv-list">
                  {module.Rows.map((row) => (
                    <div key={row.Label} className="kv-row">
                      <span className="kv-label">{row.Label}:</span>
                      <input
                        type="text"
                        value={value?.Rows[row.Label] ?? ""}
                        onChange={(e) => updateKeyValueRow(module.Id, row.Label, e.target.value)}
                        autoComplete="off"
                      />
                      <span className="kv-unit">{row.Unit || " "}</span>
                    </div>
                  ))}
                </div>
              ) : module.Type === "text" ? (
                <input
                  type="text"
                  value={value?.Text ?? ""}
                  placeholder={module.Placeholder}
                  onChange={(e) => updateModuleValue(module.Id, e.target.value)}
                  autoComplete="off"
                />
              ) : (
                <textarea
                  rows={module.Type === "bullets" ? 4 : 6}
                  value={value?.Text ?? ""}
                  placeholder={module.Placeholder}
                  onChange={(e) => updateModuleValue(module.Id, e.target.value)}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-primary" onClick={saveCurrentDraft}>
          Entwurf speichern
        </button>
        <button type="button" className="btn btn-secondary" onClick={clearCurrentForm}>
          Formular leeren
        </button>
      </div>
    </div>
  );
}
