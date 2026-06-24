import { useApp } from "../store";
import { getActiveTemplate } from "../data";
import CaseForm from "./CaseForm";
import CasePreview from "./CasePreview";

export default function CaseEditor() {
  const { data, setActiveTemplate } = useApp();
  const template = getActiveTemplate(data);
  if (!template) {
    return <div className="case-layout"><div className="empty-state">Keine Vorlage verfügbar.</div></div>;
  }
  const formData = data.Autosaves[template.Id];

  return (
    <div className="case-layout">
      <CaseForm
        template={template}
        formData={formData}
        onSelectTemplate={setActiveTemplate}
      />
      <CasePreview />
    </div>
  );
}
