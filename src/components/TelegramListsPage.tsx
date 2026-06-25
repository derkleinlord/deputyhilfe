import { useState, useEffect, useCallback } from "react";
import {
  List, Plus, Trash2, Edit3, Check, X, Users, UserPlus, Globe,
  User, Share2
} from "lucide-react";
import { useAuth } from "../auth";
import { api } from "../api";
import type { TelegramList, TelegramEntry, TelegramShare, TelegramGroupMember, TelegramUserBrief } from "../types";

type TabKey = "mine" | "shared" | "public";

export default function TelegramListsPage() {
  const { user } = useAuth();
  const [lists, setLists] = useState<TelegramList[]>([]);
  const [users, setUsers] = useState<TelegramUserBrief[]>([]);
  const [myGroups, setMyGroups] = useState<TelegramGroupMember[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("mine");
  const [selectedList, setSelectedList] = useState<TelegramList | null>(null);
  const [entries, setEntries] = useState<TelegramEntry[]>([]);
  const [shares, setShares] = useState<TelegramShare[]>([]);
  const [loading, setLoading] = useState(true);

  const [showNewList, setShowNewList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [editingListName, setEditingListName] = useState(false);
  const [editListNameVal, setEditListNameVal] = useState("");

  const [showNewEntry, setShowNewEntry] = useState(false);
  const [entryForm, setEntryForm] = useState({ name: "", tg_number: "", company: "", note: "" });
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [editEntryForm, setEditEntryForm] = useState({ name: "", tg_number: "", company: "", note: "" });

  const [showShareUser, setShowShareUser] = useState(false);
  const [shareUserId, setShareUserId] = useState("");
  const [showShareGroup, setShowShareGroup] = useState(false);
  const [shareGroupName, setShareGroupName] = useState("");

  const [showJoinGroup, setShowJoinGroup] = useState(false);
  const [joinGroupName, setJoinGroupName] = useState("");

  const isOwner = selectedList && user && selectedList.owner_id === user.id;
  const canEdit = isOwner || user?.role === "admin";

  const filteredLists = lists.filter((l) => {
    if (activeTab === "mine") return l.access_type === "owner";
    if (activeTab === "shared") return l.access_type === "shared_with_me" || l.access_type === "shared_with_group";
    return l.access_type === "public";
  });

  const loadLists = useCallback(async () => {
    try {
      const data = await api.get<TelegramList[]>("/api/telegram-lists");
      setLists(data);
    } catch { /* ignore */ }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const data = await api.get<TelegramUserBrief[]>("/api/telegram-lists/users");
      setUsers(data);
    } catch { /* ignore */ }
  }, []);

  const loadGroups = useCallback(async () => {
    try {
      const data = await api.get<TelegramGroupMember[]>("/api/telegram-lists/groups");
      setMyGroups(data);
    } catch { /* ignore */ }
  }, []);

  const loadEntriesAndShares = useCallback(async (listId: number) => {
    try {
      const [e, s] = await Promise.all([
        api.get<TelegramEntry[]>(`/api/telegram-lists/${listId}/entries`),
        api.get<TelegramShare[]>(`/api/telegram-lists/${listId}/shares`),
      ]);
      setEntries(e);
      setShares(s);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    Promise.all([loadLists(), loadUsers(), loadGroups()]).finally(() => setLoading(false));
  }, [loadLists, loadUsers, loadGroups]);

  useEffect(() => {
    if (selectedList) {
      const refreshed = lists.find((l) => l.id === selectedList.id);
      if (refreshed) {
        setSelectedList(refreshed);
        loadEntriesAndShares(refreshed.id);
      } else {
        setSelectedList(null);
        setEntries([]);
        setShares([]);
      }
    }
  }, [lists, selectedList, loadEntriesAndShares]);

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    try {
      const list = await api.post<TelegramList>("/api/telegram-lists", { name: newListName.trim() });
      setLists((prev) => [...prev, { ...list, owner_name: user?.username || "", access_type: "owner" }]);
      setNewListName("");
      setShowNewList(false);
      setSelectedList({ ...list, owner_name: user?.username || "", access_type: "owner" });
      setActiveTab("mine");
      setEntries([]);
      setShares([]);
    } catch (err) { alert((err as Error).message); }
  };

  const handleEditListName = async () => {
    if (!selectedList || !editListNameVal.trim() || !canEdit) return;
    try {
      const updated = await api.put<TelegramList>(`/api/telegram-lists/${selectedList.id}`, { name: editListNameVal.trim() });
      setLists((prev) => prev.map((l) => l.id === updated.id ? { ...l, name: updated.name } : l));
      setSelectedList((prev) => prev ? { ...prev, name: updated.name } : null);
      setEditingListName(false);
    } catch (err) { alert((err as Error).message); }
  };

  const handleDeleteList = async () => {
    if (!selectedList || !canEdit) return;
    if (!window.confirm(`Liste "${selectedList.name}" wirklich löschen?`)) return;
    try {
      await api.delete(`/api/telegram-lists/${selectedList.id}`);
      setLists((prev) => prev.filter((l) => l.id !== selectedList.id));
      setSelectedList(null);
      setEntries([]);
      setShares([]);
    } catch (err) { alert((err as Error).message); }
  };

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedList || !entryForm.name.trim() || !entryForm.tg_number.trim()) return;
    try {
      const entry = await api.post<TelegramEntry>(`/api/telegram-lists/${selectedList.id}/entries`, entryForm);
      setEntries((prev) => [...prev, entry]);
      setEntryForm({ name: "", tg_number: "", company: "", note: "" });
      setShowNewEntry(false);
    } catch (err) { alert((err as Error).message); }
  };

  const startEditEntry = (e: TelegramEntry) => {
    setEditingEntryId(e.id);
    setEditEntryForm({ name: e.name, tg_number: e.tg_number, company: e.company || "", note: e.note || "" });
  };

  const handleEditEntry = async () => {
    if (!selectedList || editingEntryId === null) return;
    try {
      const updated = await api.put<TelegramEntry>(`/api/telegram-lists/${selectedList.id}/entries/${editingEntryId}`, editEntryForm);
      setEntries((prev) => prev.map((e) => e.id === updated.id ? updated : e));
      setEditingEntryId(null);
    } catch (err) { alert((err as Error).message); }
  };

  const handleDeleteEntry = async (entryId: number) => {
    if (!selectedList || !window.confirm("Eintrag wirklich löschen?")) return;
    try {
      await api.delete(`/api/telegram-lists/${selectedList.id}/entries/${entryId}`);
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
    } catch (err) { alert((err as Error).message); }
  };

  const handleAddShareUser = async () => {
    if (!selectedList || !shareUserId) return;
    try {
      const share = await api.post<TelegramShare>(`/api/telegram-lists/${selectedList.id}/shares`, { shared_with_user_id: Number(shareUserId) });
      const u = users.find((u) => u.id === Number(shareUserId));
      setShares((prev) => [...prev, { ...share, shared_with_username: u?.username || null }]);
      setShareUserId("");
      setShowShareUser(false);
    } catch (err) { alert((err as Error).message); }
  };

  const handleAddShareGroup = async () => {
    if (!selectedList || !shareGroupName.trim()) return;
    try {
      const share = await api.post<TelegramShare>(`/api/telegram-lists/${selectedList.id}/shares`, { group_name: shareGroupName.trim() });
      setShares((prev) => [...prev, share]);
      setShareGroupName("");
      setShowShareGroup(false);
    } catch (err) { alert((err as Error).message); }
  };

  const handleSetPublic = async (sharedWithAll: boolean) => {
    if (!selectedList) return;
    try {
      if (sharedWithAll) {
        const share = await api.post<TelegramShare>(`/api/telegram-lists/${selectedList.id}/shares`, { shared_with_all: true });
        setShares((prev) => [...prev, share]);
      } else {
        const publicShare = shares.find((s) => s.shared_with_all);
        if (publicShare) {
          await api.delete(`/api/telegram-lists/${selectedList.id}/shares/${publicShare.id}`);
          setShares((prev) => prev.filter((s) => s.id !== publicShare.id));
        }
      }
    } catch (err) { alert((err as Error).message); }
  };

  const handleDeleteShare = async (shareId: number) => {
    if (!selectedList) return;
    try {
      await api.delete(`/api/telegram-lists/${selectedList.id}/shares/${shareId}`);
      setShares((prev) => prev.filter((s) => s.id !== shareId));
    } catch (err) { alert((err as Error).message); }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinGroupName.trim()) return;
    try {
      await api.post("/api/telegram-lists/groups/join", { group_name: joinGroupName.trim() });
      setJoinGroupName("");
      setShowJoinGroup(false);
      loadGroups();
      loadLists();
    } catch (err) { alert((err as Error).message); }
  };

  const handleLeaveGroup = async (groupName: string) => {
    try {
      await api.post("/api/telegram-lists/groups/leave", { group_name: groupName });
      loadGroups();
      loadLists();
    } catch (err) { alert((err as Error).message); }
  };

  const hasPublicShare = shares.some((s) => s.shared_with_all);

  if (loading) return <section><p>Lade Telegrammlisten...</p></section>;

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.03em", textTransform: "uppercase" }}>
            Telegramm-Kontakte
          </div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", margin: "2px 0 0" }}>
            Telegrammlisten
          </h2>
        </div>
      </div>

      <div className="tg-layout">
        {/* LEFT: List browser */}
        <div className="tg-list-panel">
          <div className="tg-tabs">
            <button type="button" className={`tg-tab${activeTab === "mine" ? " active" : ""}`} onClick={() => setActiveTab("mine")}>
              Meine Listen
            </button>
            <button type="button" className={`tg-tab${activeTab === "shared" ? " active" : ""}`} onClick={() => setActiveTab("shared")}>
              Mit mir geteilt
            </button>
            <button type="button" className={`tg-tab${activeTab === "public" ? " active" : ""}`} onClick={() => setActiveTab("public")}>
              Alle freigegebenen
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "12px" }}>
            {filteredLists.map((l) => (
              <button
                key={l.id}
                type="button"
                className={`tg-list-item${selectedList?.id === l.id ? " active" : ""}`}
                onClick={() => setSelectedList(l)}
              >
                <List size={16} className="tg-list-item-icon" />
                <div className="tg-list-item-text">
                  <span className="tg-list-item-name">{l.name}</span>
                  <span className="tg-list-item-owner">{l.owner_name}</span>
                </div>
              </button>
            ))}
            {filteredLists.length === 0 && (
              <div className="empty-state" style={{ marginTop: "8px", fontSize: "13px", padding: "20px 16px" }}>
                {activeTab === "mine" ? "Keine eigenen Listen." : activeTab === "shared" ? "Nichts geteilt." : "Keine öffentlichen Listen."}
              </div>
            )}
          </div>

          <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "8px" }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowNewList(!showNewList)}>
              <Plus size={14} /> Neue Liste
            </button>
            {showNewList && (
              <form onSubmit={handleCreateList} style={{ display: "flex", gap: "6px" }}>
                <input
                  type="text" value={newListName} onChange={(e) => setNewListName(e.target.value)}
                  placeholder="Listenname" required
                  style={{ flex: 1, minHeight: "28px", padding: "4px 8px", background: "var(--bg-input)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-xs)", color: "var(--text-primary)", fontSize: "12px", outline: "none" }}
                />
                <button type="submit" className="btn btn-primary btn-xs"><Check size={12} /></button>
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => setShowNewList(false)}><X size={12} /></button>
              </form>
            )}
          </div>

          {/* Groups section */}
          <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid var(--border)" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.03em", textTransform: "uppercase", marginBottom: "8px" }}>
              Meine Gruppen
            </div>
            {myGroups.length === 0 && (
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px" }}>Keine Gruppen.</div>
            )}
            {myGroups.map((g) => (
              <div key={g.group_name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px", borderRadius: "var(--radius-xs)", fontSize: "13px", color: "var(--text-secondary)" }}>
                <span>{g.group_name}</span>
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => handleLeaveGroup(g.group_name)} title="Gruppe verlassen" style={{ color: "var(--danger)" }}>
                  <X size={12} />
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-ghost btn-xs" style={{ marginTop: "4px" }} onClick={() => setShowJoinGroup(!showJoinGroup)}>
              <UserPlus size={12} /> Gruppe beitreten
            </button>
            {showJoinGroup && (
              <form onSubmit={handleJoinGroup} style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                <input
                  type="text" value={joinGroupName} onChange={(e) => setJoinGroupName(e.target.value)}
                  placeholder="Gruppenname" required
                  style={{ flex: 1, minHeight: "28px", padding: "4px 8px", background: "var(--bg-input)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-xs)", color: "var(--text-primary)", fontSize: "12px", outline: "none" }}
                />
                <button type="submit" className="btn btn-primary btn-xs"><Check size={12} /></button>
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => setShowJoinGroup(false)}><X size={12} /></button>
              </form>
            )}
          </div>
        </div>

        {/* MIDDLE: Entries table */}
        <div className="tg-entries-panel">
          {selectedList ? (
            <>
              <div className="tg-entries-header">
                <div className="tg-entries-title">
                  <span className="tg-entries-name">{selectedList.name}</span>
                  {selectedList.access_type === "owner" && <span className="tg-entries-badge">Besitzer</span>}
                  {selectedList.access_type === "shared_with_me" && <span className="tg-entries-badge" style={{ borderColor: "rgba(62, 184, 123, 0.3)", color: "var(--success)", background: "rgba(62, 184, 123, 0.12)" }}>Geteilt</span>}
                  {selectedList.access_type === "shared_with_group" && <span className="tg-entries-badge" style={{ borderColor: "rgba(212, 168, 83, 0.3)", color: "var(--accent)", background: "var(--accent-dim)" }}>Gruppe</span>}
                  {selectedList.access_type === "public" && <span className="tg-entries-badge" style={{ borderColor: "rgba(212, 168, 83, 0.3)", color: "var(--accent)", background: "var(--accent-dim)" }}>Öffentlich</span>}
                </div>
                {canEdit && (
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowNewEntry(!showNewEntry)}>
                    <Plus size={14} /> Eintrag hinzufügen
                  </button>
                )}
              </div>

              {showNewEntry && (
                <form onSubmit={handleCreateEntry} className="tg-entry-form">
                  <div className="tg-entry-form-grid">
                    <div className="field">
                      <span className="field-label">Name *</span>
                      <input type="text" value={entryForm.name} onChange={(e) => setEntryForm({ ...entryForm, name: e.target.value })} required />
                    </div>
                    <div className="field">
                      <span className="field-label">TG-Nummer *</span>
                      <input type="text" value={entryForm.tg_number} onChange={(e) => setEntryForm({ ...entryForm, tg_number: e.target.value })} required />
                    </div>
                    <div className="field">
                      <span className="field-label">Unternehmen</span>
                      <input type="text" value={entryForm.company} onChange={(e) => setEntryForm({ ...entryForm, company: e.target.value })} />
                    </div>
                    <div className="field">
                      <span className="field-label">Bemerkung</span>
                      <input type="text" value={entryForm.note} onChange={(e) => setEntryForm({ ...entryForm, note: e.target.value })} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                    <button type="submit" className="btn btn-primary btn-sm">Hinzufügen</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setShowNewEntry(false); setEntryForm({ name: "", tg_number: "", company: "", note: "" }); }}>Abbrechen</button>
                  </div>
                </form>
              )}

              <div className="tg-table-wrap">
                <table className="tg-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>TG-Nummer</th>
                      <th>Unternehmen</th>
                      <th>Bemerkung</th>
                      {canEdit && <th style={{ width: "80px" }}>Aktionen</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => {
                      const isEditing = editingEntryId === e.id;
                      return (
                        <tr key={e.id}>
                          {isEditing ? (
                            <>
                              <td><input type="text" value={editEntryForm.name} onChange={(ev) => setEditEntryForm({ ...editEntryForm, name: ev.target.value })} className="tg-inline-input" /></td>
                              <td><input type="text" value={editEntryForm.tg_number} onChange={(ev) => setEditEntryForm({ ...editEntryForm, tg_number: ev.target.value })} className="tg-inline-input" /></td>
                              <td><input type="text" value={editEntryForm.company} onChange={(ev) => setEditEntryForm({ ...editEntryForm, company: ev.target.value })} className="tg-inline-input" /></td>
                              <td><input type="text" value={editEntryForm.note} onChange={(ev) => setEditEntryForm({ ...editEntryForm, note: ev.target.value })} className="tg-inline-input" /></td>
                              <td>
                                <div style={{ display: "flex", gap: "4px" }}>
                                  <button type="button" className="btn btn-primary btn-xs" onClick={handleEditEntry}><Check size={12} /></button>
                                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => setEditingEntryId(null)}><X size={12} /></button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td><span className="tg-cell-name">{e.name}</span></td>
                              <td><span className="tg-cell-tg">{e.tg_number}</span></td>
                              <td><span className="tg-cell-muted">{e.company || "—"}</span></td>
                              <td><span className="tg-cell-muted">{e.note || "—"}</span></td>
                              {canEdit && (
                                <td>
                                  <div style={{ display: "flex", gap: "4px" }}>
                                    <button type="button" className="btn btn-ghost btn-xs" onClick={() => startEditEntry(e)} title="Bearbeiten"><Edit3 size={12} /></button>
                                    <button type="button" className="btn btn-ghost btn-xs" onClick={() => handleDeleteEntry(e.id)} title="Löschen" style={{ color: "var(--danger)" }}><Trash2 size={12} /></button>
                                  </div>
                                </td>
                              )}
                            </>
                          )}
                        </tr>
                      );
                    })}
                    {entries.length === 0 && (
                      <tr>
                        <td colSpan={canEdit ? 5 : 4} style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px", fontSize: "13px" }}>
                          Keine Einträge in dieser Liste.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ minHeight: "300px", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "8px" }}>
              <List size={32} style={{ opacity: 0.3 }} />
              <p>Wählen Sie eine Liste aus oder erstellen Sie eine neue.</p>
            </div>
          )}
        </div>

        {/* RIGHT: Settings panel */}
        <div className="tg-settings-panel">
          {selectedList ? (
            <>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.03em", textTransform: "uppercase", marginBottom: "12px" }}>
                Einstellungen
              </div>

              {canEdit && (
                <div className="tg-settings-section">
                  <div className="field" style={{ marginBottom: "0" }}>
                    <span className="field-label">Listenname</span>
                    {editingListName ? (
                      <div style={{ display: "flex", gap: "6px" }}>
                        <input
                          type="text" value={editListNameVal}
                          onChange={(e) => setEditListNameVal(e.target.value)}
                          style={{ flex: 1, minHeight: "32px", padding: "4px 8px", background: "var(--bg-input)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-xs)", color: "var(--text-primary)", fontSize: "13px", outline: "none" }}
                          autoFocus
                        />
                        <button type="button" className="btn btn-primary btn-xs" onClick={handleEditListName}><Check size={12} /></button>
                        <button type="button" className="btn btn-ghost btn-xs" onClick={() => setEditingListName(false)}><X size={12} /></button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: "14px" }}>{selectedList.name}</span>
                        <button type="button" className="btn btn-ghost btn-xs" onClick={() => { setEditingListName(true); setEditListNameVal(selectedList.name); }} title="Umbenennen">
                          <Edit3 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                  {!isOwner && selectedList.access_type !== "owner" && (
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                      Erstellt von <strong style={{ color: "var(--text-secondary)" }}>{selectedList.owner_name}</strong>
                    </div>
                  )}
                </div>
              )}

              {!canEdit && (
                <div className="tg-settings-section">
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{selectedList.name}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                    Erstellt von <strong style={{ color: "var(--text-secondary)" }}>{selectedList.owner_name}</strong>
                  </div>
                </div>
              )}

              {canEdit && (
                <>
                  <div className="tg-settings-section">
                    <div className="field-label" style={{ marginBottom: "8px" }}>Sichtbarkeit & Freigabe</div>

                    <div className="toggle-row" style={{ marginBottom: "8px" }} onClick={() => handleSetPublic(!hasPublicShare)}>
                      <input type="checkbox" checked={hasPublicShare} readOnly />
                      <span>Für alle eingeloggten Nutzer sichtbar</span>
                    </div>

                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: "10px", marginBottom: "8px" }}>
                      <button type="button" className="btn btn-ghost btn-xs" style={{ width: "100%", justifyContent: "flex-start" }} onClick={() => setShowShareUser(!showShareUser)}>
                        <UserPlus size={12} /> Mit Nutzer teilen
                      </button>
                      {showShareUser && (
                        <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                          <select
                            value={shareUserId}
                            onChange={(e) => setShareUserId(e.target.value)}
                            style={{ flex: 1, minHeight: "28px", padding: "4px 8px", background: "var(--bg-input)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-xs)", color: "var(--text-primary)", fontSize: "12px", outline: "none" }}
                          >
                            <option value="">— Nutzer wählen —</option>
                            {users.filter((u) => u.id !== user?.id).map((u) => (
                              <option key={u.id} value={u.id}>{u.username}</option>
                            ))}
                          </select>
                          <button type="button" className="btn btn-primary btn-xs" onClick={handleAddShareUser}><Check size={12} /></button>
                          <button type="button" className="btn btn-ghost btn-xs" onClick={() => setShowShareUser(false)}><X size={12} /></button>
                        </div>
                      )}
                    </div>

                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: "10px" }}>
                      <button type="button" className="btn btn-ghost btn-xs" style={{ width: "100%", justifyContent: "flex-start" }} onClick={() => setShowShareGroup(!showShareGroup)}>
                        <Users size={12} /> Mit Gruppe teilen
                      </button>
                      {showShareGroup && (
                        <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                          <input
                            type="text" value={shareGroupName}
                            onChange={(e) => setShareGroupName(e.target.value)}
                            placeholder="Gruppenname"
                            style={{ flex: 1, minHeight: "28px", padding: "4px 8px", background: "var(--bg-input)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-xs)", color: "var(--text-primary)", fontSize: "12px", outline: "none" }}
                          />
                          <button type="button" className="btn btn-primary btn-xs" onClick={handleAddShareGroup}><Check size={12} /></button>
                          <button type="button" className="btn btn-ghost btn-xs" onClick={() => setShowShareGroup(false)}><X size={12} /></button>
                        </div>
                      )}
                    </div>

                    {shares.length > 0 && (
                      <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.03em", textTransform: "uppercase", marginBottom: "4px" }}>Aktuelle Freigaben</div>
                        {shares.map((s) => (
                          <div key={s.id} className="tg-share-item">
                            <div className="tg-share-item-info">
                              {s.shared_with_all ? <><Globe size={14} /> <span>Alle Nutzer</span></> : null}
                              {s.shared_with_username ? <><User size={14} /> <span>{s.shared_with_username}</span></> : null}
                              {s.group_name && !s.shared_with_all ? <><Users size={14} /> <span>Gruppe: {s.group_name}</span></> : null}
                            </div>
                            <button type="button" className="btn btn-ghost btn-xs" onClick={() => handleDeleteShare(s.id)} title="Freigabe entfernen" style={{ color: "var(--danger)" }}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="tg-settings-section" style={{ borderTop: "1px solid var(--border)", paddingTop: "16px", marginTop: "16px" }}>
                    <button type="button" className="btn btn-danger btn-sm" style={{ width: "100%" }} onClick={handleDeleteList}>
                      <Trash2 size={14} /> Liste löschen
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <div style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", padding: "40px 0" }}>
              <Share2 size={24} style={{ opacity: 0.3, marginBottom: "8px" }} />
              <p>Wählen Sie eine Liste aus.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
