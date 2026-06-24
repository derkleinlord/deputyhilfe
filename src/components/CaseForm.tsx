import { useState } from "react";
import type { Template, FormData } from "../types";
import { moduleTypeMap } from "../types";
import { useApp } from "../store";
import { useAuth } from "../auth";
import ProofreadPanel from "./ProofreadPanel";

interface CaseFormProps {
  template: Template;
  formData: FormData;
  onSelectTemplate: (id: string) => void;
}

export default function CaseForm({ template, formData, onSelectTemplate }: CaseFormProps) {
  const { data, updateCaseTitle, updateIncludeTitle, updateModuleValue, updateKeyValueRow, clearCurrentForm } = useApp();
  const { user } = useAuth();

  const [proofreadTarget, setProofreadTarget] = useState<{
    moduleId: string;
    text: string;
    label: string;
  } | null>(null);

  const handleProofreadAccept = (original: string, replacement: string) => {
    if (!proofreadTarget) return;
    const currentText = data.Autosaves[data.ActiveTemplateId]?.Values[proofreadTarget.moduleId]?.Text ?? "";
    const newText = currentText.replace(original, replacement);
    updateModuleValue(proofreadTarget.moduleId, newText);
  };

  return (
    <div className="case-form-panel">
      <div className="form-header">
        <div className="form-header-left">
          <span className="form-header-kicker">Formular</span>
          <h2 className="form-header-title">Neue Akte</h2>
        </div>
        <div className="form-header-right">
          <select
            className="template-select-inline"
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
                <div className="module-textarea-wrap">
                  <textarea
                    rows={module.Type === "bullets" ? 4 : 6}
                    value={value?.Text ?? ""}
                    placeholder={module.Placeholder}
                    onChange={(e) => updateModuleValue(module.Id, e.target.value)}
                  />
                  {user && value?.Text && value.Text.length >= 20 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm module-proofread-btn"
                      onClick={() =>
                        setProofreadTarget({
                          moduleId: module.Id,
                          text: value.Text,
                          label: module.Label,
                        })
                      }
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                      Rechtschreibung & Grammatik prüfen
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={clearCurrentForm}>
          Formular leeren
        </button>
      </div>

      {proofreadTarget && (
        <ProofreadPanel
          text={proofreadTarget.text}
          moduleLabel={proofreadTarget.label}
          onClose={() => setProofreadTarget(null)}
          onAccept={handleProofreadAccept}
        />
      )}
    </div>
  );
}
