import { FileText, BookTemplate, FileEdit, Shield } from "lucide-react";
import { useApp } from "../store";
import type { ViewType } from "../types";

const navItems: { view: ViewType; label: string; icon: typeof FileText }[] = [
  { view: "write", label: "Akte schreiben", icon: FileText },
  { view: "templates", label: "Vorlagen", icon: BookTemplate },
  { view: "drafts", label: "Entwürfe", icon: FileEdit }
];

export default function Sidebar() {
  const { activeView, setView } = useApp();

  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <Shield size={20} />
        </div>
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-title">Aktenschreiben</span>
          <span className="sidebar-brand-subtitle">Lokale Aktenverwaltung</span>
        </div>
      </div>
      <nav className="sidebar-nav">
        {navItems.map(({ view, label, icon: Icon }) => (
          <button
            key={view}
            type="button"
            className={`sidebar-nav-item${activeView === view ? " active" : ""}`}
            onClick={() => setView(view)}
          >
            <Icon className="sidebar-nav-icon" size={18} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
