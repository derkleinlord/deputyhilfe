import { Plus, Copy, Trash2 } from "lucide-react";
import { useApp } from "../store";
import { useAuth } from "../auth";

export default function TemplateLibrary() {
  const { data, selectedTemplateId, selectTemplate, createTemplate, duplicateTemplate, deleteTemplate } = useApp();
  const { isTemplateManager } = useAuth();

  return (
    <div className="template-list-panel">
      <div className="template-list-header">
        <span className="template-list-title">Vorlagen</span>
        {isTemplateManager && (
          <button type="button" className="btn btn-primary btn-sm" onClick={createTemplate} title="Neue Vorlage">
            <Plus size={14} />
          </button>
        )}
      </div>

      <div className="template-list-items">
        {data.Templates.map((template) => (
          <button
            key={template.Id}
            type="button"
            className={`template-list-item${selectedTemplateId === template.Id ? " active" : ""}`}
            onClick={() => selectTemplate(template.Id)}
          >
            <span className="template-list-item-name">{template.Name}</span>
            <span className="template-list-item-meta">{template.Modules.length} Module</span>
          </button>
        ))}
      </div>

      {isTemplateManager && (
        <div className="template-list-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={duplicateTemplate} title="Duplizieren">
            <Copy size={14} />
            <span>Duplizieren</span>
          </button>
          <button type="button" className="btn btn-danger btn-sm" onClick={deleteTemplate} title="Löschen">
            <Trash2 size={14} />
            <span>Löschen</span>
          </button>
        </div>
      )}
    </div>
  );
}
