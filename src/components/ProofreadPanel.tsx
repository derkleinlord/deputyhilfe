import { useEffect, useState, useCallback } from "react";
import type { ProofreadSuggestion } from "../types";
import { proofreadApi } from "../api";

interface ProofreadPanelProps {
  text: string;
  moduleLabel: string;
  onClose: () => void;
  onAccept: (original: string, replacement: string) => void;
}

export default function ProofreadPanel({ text, moduleLabel, onClose, onAccept }: ProofreadPanelProps) {
  const [suggestions, setSuggestions] = useState<ProofreadSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acceptedIndices, setAcceptedIndices] = useState<Set<number>>(new Set());
  const [declinedIndices, setDeclinedIndices] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function fetchSuggestions() {
      try {
        const result = await proofreadApi(text);
        if (!cancelled) setSuggestions(result.suggestions);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchSuggestions();
    return () => { cancelled = true; };
  }, [text]);

  const handleAccept = useCallback((index: number) => {
    const s = suggestions[index];
    if (!s) return;
    onAccept(s.original, s.replacement);
    setAcceptedIndices((prev) => new Set(prev).add(index));
  }, [suggestions, onAccept]);

  const handleDecline = useCallback((index: number) => {
    setDeclinedIndices((prev) => new Set(prev).add(index));
  }, []);

  const handleAcceptAllSafe = useCallback(() => {
    for (let i = 0; i < suggestions.length; i++) {
      if (suggestions[i].confidence === "safe" && !acceptedIndices.has(i) && !declinedIndices.has(i)) {
        onAccept(suggestions[i].original, suggestions[i].replacement);
      }
    }
    setAcceptedIndices((prev) => {
      const next = new Set(prev);
      for (let i = 0; i < suggestions.length; i++) {
        if (suggestions[i].confidence === "safe") next.add(i);
      }
      return next;
    });
  }, [suggestions, acceptedIndices, declinedIndices, onAccept]);

  const hasSafeUnresolved = suggestions.some(
    (s, i) => s.confidence === "safe" && !acceptedIndices.has(i) && !declinedIndices.has(i)
  );

  return (
    <div className="proofread-overlay" onClick={onClose}>
      <div className="proofread-panel" onClick={(e) => e.stopPropagation()}>
        <div className="proofread-header">
          <div className="proofread-header-left">
            <h3 className="proofread-title">Rechtschreibung & Grammatik prüfen</h3>
            <span className="proofread-module-label">{moduleLabel}</span>
          </div>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Schließen">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {loading && (
          <div className="proofread-loading">
            <div className="proofread-spinner" />
            <p>Prüfung wird durchgeführt...</p>
          </div>
        )}

        {error && (
          <div className="proofread-error">
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && suggestions.length === 0 && (
          <div className="proofread-empty">
            <p>Keine Korrekturen gefunden. Der Text scheint in Ordnung zu sein.</p>
          </div>
        )}

        {!loading && !error && suggestions.length > 0 && (
          <>
            {hasSafeUnresolved && (
              <div className="proofread-accept-all">
                <button type="button" className="btn btn-primary btn-sm" onClick={handleAcceptAllSafe}>
                  Alle sicheren Korrekturen übernehmen
                </button>
              </div>
            )}

            <div className="proofread-list">
              {suggestions.map((s, i) => {
                const isAccepted = acceptedIndices.has(i);
                const isDeclined = declinedIndices.has(i);
                const isResolved = isAccepted || isDeclined;

                return (
                  <div key={i} className={`proofread-item ${isResolved ? "proofread-item-resolved" : ""}`}>
                    <div className="proofread-item-badge">
                      <span className={`proofread-category badge-${s.category}`}>{s.category}</span>
                      <span className={`proofread-confidence badge-${s.confidence}`}>
                        {s.confidence === "safe" ? "Sicher" : "Prüfen"}
                      </span>
                    </div>

                    <div className="proofread-item-texts">
                      <div className="proofread-original">
                        <span className="proofread-label">Original:</span>
                        <span className="proofread-value">{s.original}</span>
                      </div>
                      <div className="proofread-arrow">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                        </svg>
                      </div>
                      <div className="proofread-replacement">
                        <span className="proofread-label">Vorschlag:</span>
                        <span className="proofread-value">{s.replacement}</span>
                      </div>
                    </div>

                    <p className="proofread-reason">{s.reason}</p>

                    {!isResolved && (
                      <div className="proofread-item-actions">
                        <button type="button" className="btn btn-primary btn-xs" onClick={() => handleAccept(i)}>
                          Übernehmen
                        </button>
                        <button type="button" className="btn btn-secondary btn-xs" onClick={() => handleDecline(i)}>
                          Ablehnen
                        </button>
                      </div>
                    )}
                    {isAccepted && <span className="proofread-item-status">Übernommen</span>}
                    {isDeclined && <span className="proofread-item-status">Abgelehnt</span>}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
