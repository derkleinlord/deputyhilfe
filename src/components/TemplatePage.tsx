import TemplateLibrary from "./TemplateLibrary";
import TemplateEditorPanel from "./TemplateEditorPanel";

export default function TemplatePage() {
  return (
    <div className="template-layout">
      <TemplateLibrary />
      <TemplateEditorPanel />
    </div>
  );
}
