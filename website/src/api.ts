import axios from "axios";

// Same backend as the mobile app — relative path so it works behind any host.
// In dev (vite at port 5173) browsers will hit /api proxied via the parent host
// because the SPA is loaded under https://<host>/web/ and APIs sit at /api on
// the same origin (FastAPI behind the same ingress).
export const API_BASE = "/api";

const api = axios.create({ baseURL: API_BASE, timeout: 60000 });

const TOKEN_KEY = "docvault_token";
const ROLE_KEY = "docvault_role";

export const setToken = (t: string | null) =>
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setRole  = (r: "admin" | "client" | null) =>
  r ? localStorage.setItem(ROLE_KEY, r) : localStorage.removeItem(ROLE_KEY);
export const getRole  = () => localStorage.getItem(ROLE_KEY) as "admin" | "client" | null;

api.interceptors.request.use((config) => {
  const t = getToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

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
