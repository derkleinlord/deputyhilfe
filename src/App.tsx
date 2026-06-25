import { AppProvider, useApp } from "./store";
import { useAuth } from "./auth";
import AppLayout from "./components/AppLayout";
import CaseEditor from "./components/CaseEditor";
import TemplatePage from "./components/TemplatePage";
import UserManagement from "./components/UserManagement";
import TelegramListsPage from "./components/TelegramListsPage";
import LoginPage from "./components/LoginPage";
import Toast from "./components/Toast";
import "./App.css";

function Content() {
  const { activeView, loading } = useApp();

  if (loading) {
    return (
      <div className="loading-state">
        <p>Lade Daten...</p>
      </div>
    );
  }

  switch (activeView) {
    case "write":
      return <CaseEditor />;
    case "templates":
      return <TemplatePage />;
    case "users":
      return <UserManagement />;
    case "telegramlists":
      return <TelegramListsPage />;
    default:
      return <CaseEditor />;
  }
}

function AppInner() {
  const { conflictInfo, resolveConflict } = useApp();

  return (
    <>
      <AppLayout>
        <Content />
        <Toast />
      </AppLayout>
      {conflictInfo && (
        <div className="conflict-overlay">
          <div className="conflict-dialog">
            <p>{conflictInfo.message}</p>
            <div className="conflict-actions">
              <button type="button" className="btn btn-primary" onClick={() => resolveConflict("server")}>
                Server-Version übernehmen
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => resolveConflict("local")}>
                Eigene Änderungen behalten
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  const { loading, showLogin, user } = useAuth();

  if (loading) {
    return (
      <div className="login-page">
        <div className="loading-card">
          <p>Lade Anwendung...</p>
        </div>
      </div>
    );
  }

  if (showLogin && !user) {
    return <LoginPage />;
  }

  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}
