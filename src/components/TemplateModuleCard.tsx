import { ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import type { Module } from "../types";
import { moduleTypeMap } from "../types";
import { useApp } from "../store";

interface TemplateModuleCardProps {
  module: Module;
  index: number;
  total: number;
}

export default function TemplateModuleCard({ module, index, total }: TemplateModuleCardProps) {
  const { updateModuleMeta, moveModule, removeModule, addRowToModule, updateModuleRow, removeModuleRow } = useApp();

  return (
    <div className="editor-card">
      <div className="editor-card-header">
        <div className="editor-card-title">
          <span className="editor-card-name">{module.Label}</span>
          <span className="editor-card-index">Modul {index + 1}</span>
        </div>
        <div className="editor-card-actions">
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            disabled={index === 0}
            onClick={() => moveModule(index, -1)}
            title="Nach oben"
          >
            <ArrowUp size={14} />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            disabled={index === total - 1}
            onClick={() => moveModule(index, 1)}
            title="Nach unten"
          >
            <ArrowDown size={14} />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            style={{ color: "var(--danger)" }}
            disabled={total <= 1}
            onClick={() => removeModule(index)}
            title="Modul löschen"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="editor-grid">
        <div className="field">
          <span className="field-label">Bezeichnung</span>
          <input
            type="text"
            value={module.Label}
            onChange={(e) => updateModuleMeta(index, { Label: e.target.value })}
          />
        </div>
        <div className="field">
          <span className="field-label">Typ</span>
          <select
            value={module.Type}
            onChange={(e) => updateModuleMeta(index, { Type: e.target.value as Module["Type"] })}
          >
            {Object.entries(moduleTypeMap).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="placeholder-editor">
        <div className="field">
          <span className="field-label">Platzhalter bearbeiten</span>
          <textarea
            rows={3}
            value={module.Placeholder}
            onChange={(e) => updateModuleMeta(index, { Placeholder: e.target.value })}
          />
        </div>
        <div className="placeholder-preview">
          <span className="placeholder-preview-label">Platzhalter-Vorschau</span>
          <div className="placeholder-preview-box">
            {module.Placeholder || "Kein Platzhalter gesetzt."}
          </div>
        </div>
      </div>

      <div className="editor-grid">
        <div className="field">
          <span className="field-label">Stichpunkt-Präfix</span>
          <input
            type="text"
            value={module.BulletPrefix ?? ""}
            onChange={(e) => updateModuleMeta(index, { BulletPrefix: e.target.value })}
          />
        </div>
        <label className="toggle-row" style={{ paddingTop: "22px" }}>
          <input
            type="checkbox"
            checked={module.RenderHeading}
            onChange={(e) => updateModuleMeta(index, { RenderHeading: e.target.checked })}
          />
          <span>Überschrift ausgeben</span>
        </label>
      </div>

      {module.Type === "keyValues" && (
        <div className="row-editor-list">
          {module.Rows.map((row, rowIndex) => (
            <div key={rowIndex} className="row-editor">
              <input
                type="text"
                value={row.Label}
                placeholder="Zeile"
                onChange={(e) => updateModuleRow(index, rowIndex, { Label: e.target.value })}
              />
              <input
                type="text"
                value={row.Unit}
                placeholder="$ / HE"
                onChange={(e) => updateModuleRow(index, rowIndex, { Unit: e.target.value })}
              />
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                style={{ color: "var(--danger)" }}
                onClick={() => removeModuleRow(index, rowIndex)}
                title="Zeile löschen"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => addRowToModule(index)}
          >
            Zeile hinzufügen
          </button>
        </div>
      )}
    </div>
  );
}
