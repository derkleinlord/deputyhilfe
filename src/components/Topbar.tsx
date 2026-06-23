import { useRef } from "react";
import { Download, Upload } from "lucide-react";
import { useApp } from "../store";

const viewLabels: Record<string, string> = {
  write: "Akte schreiben",
  templates: "Vorlagen bearbeiten",
  drafts: "Entwürfe"
};

export default function Topbar() {
  const { activeView, exportData, importData } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) {
      importData(file);
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="topbar-title">{viewLabels[activeView] ?? "Aktenschreiben"}</span>
      </div>
      <div className="topbar-right">
        <button type="button" className="btn btn-ghost" onClick={exportData} title="Daten exportieren">
          <Download size={16} />
          <span className="topbar-btn-label">Exportieren</span>
        </button>
        <button type="button" className="btn btn-ghost file-btn" onClick={handleImport} title="Daten importieren">
          <Upload size={16} />
          <span className="topbar-btn-label">Importieren</span>
          <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleFileChange} />
        </button>
      </div>
    </header>
  );
}
