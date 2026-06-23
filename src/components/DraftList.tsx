import { FileText, FileDown, Trash2, Inbox } from "lucide-react";
import { useApp } from "../store";

export default function DraftList() {
  const { data, loadDraft, downloadDraft, deleteDraft, clearDrafts } = useApp();

  const sortedDrafts = [...data.Drafts].sort(
    (a, b) => new Date(b.UpdatedAt).getTime() - new Date(a.UpdatedAt).getTime()
  );

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "18px" }}>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.03em", textTransform: "uppercase" }}>
            Gespeichert
          </div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", margin: "2px 0 0" }}>
            Entwürfe
          </h2>
        </div>
        {data.Drafts.length > 0 && (
          <button type="button" className="btn btn-danger btn-sm" onClick={clearDrafts}>
            <Trash2 size={14} />
            Alle löschen
          </button>
        )}
      </div>

      {data.Drafts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Inbox size={32} />
          </div>
          <p>Noch keine Entwürfe gespeichert.</p>
        </div>
      ) : (
        <div className="draft-list">
          {sortedDrafts.map((draft) => {
            const date = new Date(draft.UpdatedAt).toLocaleString("de-DE");
            return (
              <div key={draft.Id} className="draft-card">
                <div className="draft-card-info">
                  <h3>{draft.Name}</h3>
                  <div className="draft-card-meta">
                    {draft.TemplateName} &middot; {date}
                  </div>
                </div>
                <div className="draft-card-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => loadDraft(draft.Id)}
                    title="Entwurf laden"
                  >
                    <FileText size={14} />
                    <span>Laden</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => downloadDraft(draft.Id)}
                    title="Als Textdatei speichern"
                  >
                    <FileDown size={14} />
                    <span>TXT</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => deleteDraft(draft.Id)}
                    title="Entwurf löschen"
                  >
                    <Trash2 size={14} />
                    <span>Löschen</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
