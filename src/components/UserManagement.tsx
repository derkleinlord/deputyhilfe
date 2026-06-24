import { useState, useEffect, useCallback } from "react";
import { Shield, Trash2 } from "lucide-react";
import { useAuth } from "../auth";
import { api } from "../api";
import type { User } from "../types";

export default function UserManagement() {
  const { user, isAdmin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ username: "", email: "", password: "", role: "user" });

  const loadUsers = useCallback(async () => {
    try {
      const data = await api.get<User[]>("/api/users");
      setUsers(data);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadUsers();
    else setLoading(false);
  }, [isAdmin, loadUsers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/api/users", form);
      setShowCreate(false);
      setForm({ username: "", email: "", password: "", role: "user" });
      loadUsers();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleDelete = async (id: number, username: string) => {
    if (!window.confirm(`Benutzer "${username}" wirklich löschen?`)) return;
    try {
      await api.delete(`/api/users/${id}`);
      loadUsers();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleToggleActive = async (id: number, current: number) => {
    try {
      await api.put(`/api/users/${id}`, { is_active: current ? 0 : 1 });
      loadUsers();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  if (!isAdmin) {
    return (
      <section>
        <div className="empty-state">
          <p>Keine Berechtigung für die Benutzerverwaltung.</p>
        </div>
      </section>
    );
  }

  if (loading) {
    return <section><p>Lade Benutzer...</p></section>;
  }

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.03em", textTransform: "uppercase" }}>
            Verwaltung
          </div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", margin: "2px 0 0" }}>
            Benutzer
          </h2>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowCreate(!showCreate)}>
          Benutzer anlegen
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px", marginBottom: "18px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="field">
              <span className="field-label">Benutzername</span>
              <input type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            </div>
            <div className="field">
              <span className="field-label">E-Mail</span>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="field">
              <span className="field-label">Passwort</span>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </div>
            <div className="field">
              <span className="field-label">Rolle</span>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="user">Nutzer</option>
                <option value="template_manager">Vorlagenverwaltung</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="submit" className="btn btn-primary btn-sm">Erstellen</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCreate(false)}>Abbrechen</button>
          </div>
        </form>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {users.map((u) => (
          <div key={u.id} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px", background: "var(--bg-surface)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", gap: "12px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
              <Shield size={16} style={{ opacity: 0.4 }} />
              <div>
                <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "14px" }}>
                  {u.username}
                  {u.id === user?.id && <span style={{ color: "var(--accent)", marginLeft: "8px", fontSize: "11px" }}>(Sie)</span>}
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>{u.email}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{
                padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 700,
                background: u.role === "admin" ? "var(--accent-dim)" : u.role === "template_manager" ? "rgba(62, 184, 123, 0.12)" : "transparent",
                border: "1px solid",
                borderColor: u.role === "admin" ? "var(--accent-border)" : u.role === "template_manager" ? "rgba(62, 184, 123, 0.3)" : "var(--border)",
                color: u.role === "admin" ? "var(--accent)" : u.role === "template_manager" ? "var(--success)" : "var(--text-muted)",
              }}>
                {u.role === "admin" ? "Admin" : u.role === "template_manager" ? "Vorlagen" : "Nutzer"}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => handleToggleActive(u.id, u.is_active ?? 1)}
                title={u.is_active ? "Deaktivieren" : "Aktivieren"}
                style={{ color: u.is_active ? "var(--success)" : "var(--danger)", fontSize: "11px", fontWeight: 600 }}
              >
                {u.is_active ? "Aktiv" : "Inaktiv"}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                style={{ color: "var(--danger)" }}
                disabled={u.id === user?.id}
                onClick={() => handleDelete(u.id, u.username)}
                title="Löschen"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
