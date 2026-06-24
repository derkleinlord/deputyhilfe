import { useState } from "react";
import { useApp } from "../store";
import { useAuth } from "../auth";

export default function MigrationDialog() {
  const { localDataAvailable, importLocalData, showToast } = useApp();
  const { isTemplateManager } = useAuth();
  const [show, setShow] = useState(localDataAvailable);

  if (!show) return null;

  return (
    <div className="conflict-overlay">
      <div className="conflict-dialog" style={{ maxWidth: "420px" }}>
        <h3 style={{ marginBottom: "10px", color: "var(--accent)" }}>Lokale Daten gefunden</h3>
        <p style={{ marginBottom: "16px", color: "var(--text-secondary)", fontSize: "13px", lineHeight: 1.5 }}>
          Es wurden lokale Daten aus der bisherigen Installation gefunden.
          {isTemplateManager
            ? " Sie können diese Daten jetzt in die zentrale Datenbank importieren."
            : " Bitte kontaktieren Sie einen Administrator für den Import."}
        </p>
        <div className="conflict-actions">
          {isTemplateManager && (
            <button type="button" className="btn btn-primary" onClick={() => { importLocalData(); setShow(false); }}>
              Jetzt importieren
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={() => {
            setShow(false);
            showToast("Sie können den Import später über die Export/Import-Funktion nachholen.");
          }}>
            Später
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => {
            setShow(false);
            localStorage.removeItem("aktenschreiben.web.data.v1");
            showToast("Lokale Daten ignoriert.");
          }}>
            Ignorieren
          </button>
        </div>
      </div>
    </div>
  );
}
