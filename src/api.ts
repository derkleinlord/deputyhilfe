let token: string | null = null;

export function setToken(t: string | null) {
  token = t;
}

export function getToken(): string | null {
  return token;
}

async function request<T>(
  method: string,
  url: string,
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return data as T;
}

export const api = {
  get: <T>(url: string) => request<T>("GET", url),
  post: <T>(url: string, body?: unknown) => request<T>("POST", url, body),
  put: <T>(url: string, body?: unknown) => request<T>("PUT", url, body),
  delete: <T>(url: string) => request<T>("DELETE", url),
};

export interface LoginResponse {
  user: { id: number; username: string; email: string; role: string };
  token: string;
}

export async function loginApi(identifier: string, password: string): Promise<LoginResponse> {
  return api.post<LoginResponse>("/api/auth/login", { identifier, password });
}

export async function logoutApi(): Promise<void> {
  await api.post("/api/auth/logout");
}

export async function getMeApi(): Promise<{ user: { userId: number; username: string; role: string } }> {
  return api.get("/api/auth/me");
}
