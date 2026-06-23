import { Copy, FileDown } from "lucide-react";
import { useApp } from "../store";

export default function CasePreview() {
  const { getPreviewText, copyOutput, downloadOutput } = useApp();
  const previewText = getPreviewText();

  return (
    <div className="case-preview-panel">
      <div className="preview-container">
        <div className="preview-header">
          <span className="preview-title">Ausgabe</span>
          <div className="preview-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={copyOutput} title="Kopieren">
              <Copy size={14} />
              <span>Kopieren</span>
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={downloadOutput} title="TXT">
              <FileDown size={14} />
              <span>TXT</span>
            </button>
          </div>
        </div>
        <pre className="case-output">{previewText}</pre>
      </div>
    </div>
  );
}
