import type { ReactNode } from "react";
import { Copy, FileDown } from "lucide-react";
import { useApp } from "../store";

function renderMarkdown(text: string): ReactNode[] {
  const lines = text.split("\n");
  const elements: ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim() === "") {
      continue;
    }

    if (/^-{10,}$/.test(line.trim())) {
      elements.push(<hr key={key++} />);
      continue;
    }

    const headingMatch = line.match(/^__\*\*(.+)\*\*__$/);
    if (headingMatch) {
      elements.push(
        <p key={key++} className="preview-section-heading">
          <strong>{headingMatch[1]}</strong>
        </p>
      );
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("-")) {
      const items: string[] = [];
      while (i < lines.length) {
        const l = lines[i];
        if (l.startsWith("- ")) {
          items.push(l.slice(2));
        } else if (l.startsWith("-") && !l.startsWith("--")) {
          items.push(l.slice(1));
        } else {
          break;
        }
        i++;
      }
      i--;
      elements.push(
        <ul key={key++}>
          {items.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      );
      continue;
    }

    elements.push(<p key={key++}>{line}</p>);
  }

  return elements;
}

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
        <div className="case-output">{renderMarkdown(previewText)}</div>
      </div>
    </div>
  );
}
