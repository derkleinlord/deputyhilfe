import { useState, type FormEvent } from "react";
import { Shield, ArrowLeft } from "lucide-react";
import { useAuth } from "../auth";

export default function LoginPage() {
  const { login, cancelLogin, loading: authLoading } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(identifier, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <button
          type="button"
          className="login-back-btn"
          onClick={cancelLogin}
        >
          <ArrowLeft size={14} />
          <span>Zurück zur Anwendung</span>
        </button>

        <div className="login-header">
          <div className="login-icon">
            <Shield size={28} />
          </div>
          <h1 className="login-title">Deputy Hilfe</h1>
          <p className="login-subtitle">Anmeldung</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="field">
            <span className="field-label">Benutzername</span>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          <div className="field">
            <span className="field-label">Passwort</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="btn btn-primary login-btn" disabled={busy || authLoading}>
            {busy ? "Anmelden..." : "Anmelden"}
          </button>
        </form>
      </div>
    </div>
  );
}
