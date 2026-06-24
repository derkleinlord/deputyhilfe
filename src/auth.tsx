import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type { User } from "./types";
import { setToken, loginApi, logoutApi, getMeApi } from "./api";
import { connectSocket, disconnectSocket } from "./socket";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  showLogin: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  requestLogin: () => void;
  cancelLogin: () => void;
  isAdmin: boolean;
  isTemplateManager: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function parseRole(role: string): User["role"] {
  if (role === "admin" || role === "template_manager" || role === "user") return role;
  return "user";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem("aktenschreiben_token");
    if (savedToken) {
      setToken(savedToken);
      getMeApi()
        .then((res) => {
          setUser({
            id: res.user.userId,
            username: res.user.username,
            email: "",
            role: parseRole(res.user.role),
          });
          connectSocket();
        })
        .catch(() => {
          setToken(null);
          localStorage.removeItem("aktenschreiben_token");
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const res = await loginApi(identifier, password);
    setToken(res.token);
    localStorage.setItem("aktenschreiben_token", res.token);
    setUser({
      id: res.user.id,
      username: res.user.username,
      email: res.user.email,
      role: parseRole(res.user.role),
    });
    setShowLogin(false);
    connectSocket();
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      // ignore
    }
    disconnectSocket();
    setToken(null);
    localStorage.removeItem("aktenschreiben_token");
    setUser(null);
  }, []);

  const requestLogin = useCallback(() => setShowLogin(true), []);
  const cancelLogin = useCallback(() => setShowLogin(false), []);

  const value: AuthContextValue = {
    user,
    loading,
    showLogin,
    login,
    logout,
    requestLogin,
    cancelLogin,
    isAdmin: user?.role === "admin",
    isTemplateManager: user?.role === "admin" || user?.role === "template_manager",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
