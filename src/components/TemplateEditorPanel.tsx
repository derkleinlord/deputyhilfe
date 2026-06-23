import { Plus } from "lucide-react";
import { useApp } from "../store";
import { getSelectedTemplate } from "../data";
import TemplateModuleCard from "./TemplateModuleCard";

export default function TemplateEditorPanel() {
  const { data, selectedTemplateId, updateTemplateMeta, addModule } = useApp();
  const template = getSelectedTemplate(data, selectedTemplateId);

  if (!template) {
    return (
      <div className="template-editor-panel">
        <div className="empty-state">
          <p>Keine Vorlage ausgewählt.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="template-editor-panel">
      <div className="template-editor-header">
        <h3 className="template-editor-title">Vorlage bearbeiten</h3>
        <button type="button" className="btn btn-primary btn-sm" onClick={addModule}>
          <Plus size={14} />
          <span>Modul hinzufügen</span>
        </button>
      </div>

      <div className="template-editor-grid">
        <div className="field">
          <span className="field-label">Name</span>
          <input
            type="text"
            value={template.Name}
            onChange={(e) => updateTemplateMeta({ Name: e.target.value })}
            autoComplete="off"
          />
        </div>
        <div className="field">
          <span className="field-label">Titel-Vorlage</span>
          <input
            type="text"
            value={template.TitleTemplate}
            onChange={(e) => updateTemplateMeta({ TitleTemplate: e.target.value })}
            autoComplete="off"
          />
        </div>
        <div className="field">
          <span className="field-label">Kopfzeile</span>
          <input
            type="text"
            value={template.Header}
            onChange={(e) => updateTemplateMeta({ Header: e.target.value })}
            autoComplete="off"
          />
        </div>
        <div className="field">
          <span className="field-label">Überschrift</span>
          <input
            type="text"
            value={template.Heading}
            onChange={(e) => updateTemplateMeta({ Heading: e.target.value })}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="template-options-grid">
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={template.IncludeTitleByDefault}
            onChange={(e) => updateTemplateMeta({ IncludeTitleByDefault: e.target.checked })}
          />
          <span>Titel standardmäßig ausgeben</span>
        </label>
        <div className="field">
          <span className="field-label">Trennlinie</span>
          <input
            type="text"
            value={template.Separator}
            onChange={(e) => updateTemplateMeta({ Separator: e.target.value })}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="module-editor-list">
        {template.Modules.map((module, index) => (
          <TemplateModuleCard
            key={module.Id}
            module={module}
            index={index}
            total={template.Modules.length}
          />
        ))}
      </div>
    </div>
  );
}
