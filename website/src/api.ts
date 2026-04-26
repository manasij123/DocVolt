import axios from "axios";

export const API_BASE = "/api";

const api = axios.create({ baseURL: API_BASE, timeout: 60000 });

const TOKEN_KEY = "docvault_token";
const USER_KEY = "docvault_user";

export type UserInfo = { id: string; email: string; name: string; role: "admin" | "client" };

export const setToken = (t: string | null) =>
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);
export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const setUser = (u: UserInfo | null) =>
  u ? localStorage.setItem(USER_KEY, JSON.stringify(u)) : localStorage.removeItem(USER_KEY);
export const getUser = (): UserInfo | null => {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as UserInfo; } catch { return null; }
};

export const logout = () => { setToken(null); setUser(null); };

api.interceptors.request.use((config) => {
  const t = getToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Auto-logout on auth failure (token expired etc.)
    if (err?.response?.status === 401) {
      const url = err?.config?.url || "";
      if (!url.includes("/auth/login") && !url.includes("/auth/register")) {
        logout();
        if (!window.location.pathname.endsWith("/login")
          && !window.location.pathname.endsWith("/register")
          && !window.location.pathname.endsWith("/web/")) {
          window.location.replace("/api/web/");
        }
      }
    }
    return Promise.reject(err);
  }
);

export default api;

export type DocumentMeta = {
  id: string;
  original_name: string;
  display_name: string;
  category: "MONTHLY_RETURN" | "FORWARDING_LETTER" | "IFA_REPORT" | "OTHERS";
  year: number;
  month: number | null;
  month_label: string | null;
  size: number;
  uploaded_at: string;
  admin_id: string;
  client_id: string;
};

export type ClientRow = UserInfo & {
  created_at?: string;
  doc_count: number;
  last_upload_at?: string | null;
};

export type ConnectedAdmin = UserInfo & {
  doc_count: number;
  last_upload_at?: string | null;
};

export const CATEGORY_LABELS: Record<string, string> = {
  MONTHLY_RETURN: "Monthly Return",
  FORWARDING_LETTER: "Forwarding Letter",
  IFA_REPORT: "IFA Report",
  OTHERS: "Others",
};

export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  MONTHLY_RETURN: "Periodic monthly returns",
  FORWARDING_LETTER: "Cover & forwarding letters",
  IFA_REPORT: "Independent advisor reports",
  OTHERS: "Other documents",
};

export const CATEGORY_ICONS: Record<string, string> = {
  MONTHLY_RETURN: "📊",
  FORWARDING_LETTER: "✉️",
  IFA_REPORT: "📈",
  OTHERS: "📁",
};

export function fileUrl(id: string) {
  return `${API_BASE}/documents/${id}/file`;
}

export function initials(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  const parts = t.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
}

export function colorFromString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return `hsl(${h} 70% 50%)`;
}
