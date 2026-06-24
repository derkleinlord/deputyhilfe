import { FileText, BookTemplate, Shield, LogOut, Users, LogIn } from "lucide-react";
import { useApp } from "../store";
import { useAuth } from "../auth";
import type { ViewType } from "../types";

const navItems: { view: ViewType; label: string; icon: typeof FileText; auth: boolean }[] = [
  { view: "write", label: "Akte schreiben", icon: FileText, auth: false },
  { view: "templates", label: "Vorlagen", icon: BookTemplate, auth: true },
];

export default function Sidebar() {
  const { activeView, setView } = useApp();
  const { user, isAdmin, logout, requestLogin } = useAuth();

  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <Shield size={20} />
        </div>
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-title">Deputy Hilfe</span>
        </div>
      </div>
      <nav className="sidebar-nav">
        {navItems.map(({ view, label, icon: Icon, auth }) => (
          (!auth || user) && (
            <button
              key={view}
              type="button"
              className={`sidebar-nav-item${activeView === view ? " active" : ""}`}
              onClick={() => setView(view)}
            >
              <Icon className="sidebar-nav-icon" size={18} />
              <span>{label}</span>
            </button>
          )
        ))}
        {isAdmin && (
          <button
            type="button"
            className={`sidebar-nav-item${activeView === "users" ? " active" : ""}`}
            onClick={() => setView("users")}
          >
            <Users className="sidebar-nav-icon" size={18} />
            <span>Admin</span>
          </button>
        )}
      </nav>
      <div className="sidebar-user">
        {user ? (
          <>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user.username}</span>
              <span className="sidebar-user-role">
                {user.role === "admin" ? "Administrator" : user.role === "template_manager" ? "Vorlagenverwaltung" : "Nutzer"}
              </span>
            </div>
            <button type="button" className="btn btn-ghost btn-xs" onClick={logout} title="Abmelden">
              <LogOut size={14} />
            </button>
          </>
        ) : (
          <>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">Gast</span>
              <span className="sidebar-user-role">Nicht angemeldet</span>
            </div>
            <button type="button" className="btn btn-ghost btn-xs" onClick={requestLogin} title="Anmelden">
              <LogIn size={14} />
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
