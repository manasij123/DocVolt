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
  category: string; // legacy enum key (MONTHLY_RETURN, FORWARDING_LETTER, IFA_REPORT, OTHERS) — also custom keys
  category_id?: string | null; // new per-client category FK
  year: number;
  month: number | null;
  month_label: string | null;
  size: number;
  uploaded_at: string;
  admin_id: string;
  client_id: string;
};

export type Category = {
  id: string;
  admin_id: string;
  client_id: string;
  key: string;
  name: string;
  color: string;
  icon: string; // ionicons name
  custom_icon_b64?: string | null; // AI-generated PNG; takes priority over icon when present
  keywords: string[];
  sort_order: number;
  is_default: boolean;
  created_at?: string;
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

// ===== Per-client dynamic categories — CRUD helpers =====
export async function listCategories(params: { client_id?: string; admin_id?: string }): Promise<Category[]> {
  const r = await api.get<Category[]>("/categories", { params });
  return r.data;
}
export async function createCategory(payload: {
  client_id: string;
  name: string;
  color?: string;
  icon?: string;
  keywords?: string[];
}): Promise<Category> {
  const r = await api.post<Category>("/categories", payload);
  return r.data;
}
export async function updateCategoryApi(id: string, payload: Partial<Pick<Category, "name" | "color" | "icon" | "keywords" | "sort_order">>): Promise<Category> {
  const r = await api.put<Category>(`/categories/${id}`, payload);
  return r.data;
}
export async function deleteCategoryApi(id: string): Promise<{ ok: boolean; moved_to_others: number }> {
  const r = await api.delete(`/categories/${id}`);
  return r.data;
}
export async function generateCategoryIcon(payload: { description: string; style_hint?: string }): Promise<{ image_base64: string; prompt_used: string }> {
  // gpt-image-1 can take 30-90s; bump axios timeout for this call.
  const r = await api.post("/categories/generate-icon", payload, { timeout: 180_000 });
  return r.data;
}

// 8-color preset palette for category creation
export const CATEGORY_COLOR_PRESETS = [
  "#3B82F6", // blue
  "#8B5CF6", // purple
  "#10B981", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#6B7280", // slate
];

// Web emoji-icon presets (since we don't ship Ionicons in the Vite app)
export const CATEGORY_ICON_PRESETS: { name: string; emoji: string }[] = [
  { name: "stats-chart",   emoji: "📊" },
  { name: "paper-plane",   emoji: "✉️" },
  { name: "podium",        emoji: "📈" },
  { name: "folder-open",   emoji: "📁" },
  { name: "receipt",       emoji: "🧾" },
  { name: "card",          emoji: "💳" },
  { name: "cash",          emoji: "💵" },
  { name: "calculator",    emoji: "🧮" },
  { name: "briefcase",     emoji: "💼" },
  { name: "document-text", emoji: "📄" },
  { name: "shield",        emoji: "🛡️" },
  { name: "medkit",        emoji: "🩺" },
  { name: "school",        emoji: "🎓" },
  { name: "home",          emoji: "🏠" },
  { name: "car",           emoji: "🚗" },
  { name: "gift",          emoji: "🎁" },
];

export function emojiForIcon(iconName: string | undefined | null): string {
  if (!iconName) return "📁";
  const found = CATEGORY_ICON_PRESETS.find((p) => p.name === iconName);
  return found ? found.emoji : "📁";
}

/** Look up display info for a doc's category — preferring the dynamic
 * categories list, falling back to the legacy enum labels for backward compat.
 */
export function categoryDisplay(
  doc: Pick<DocumentMeta, "category" | "category_id">,
  cats: Category[],
): { name: string; emoji: string; color: string; key: string } {
  const byId = doc.category_id ? cats.find((c) => c.id === doc.category_id) : undefined;
  const byKey = !byId ? cats.find((c) => c.key === doc.category) : undefined;
  const c = byId || byKey;
  if (c) return { name: c.name, emoji: emojiForIcon(c.icon), color: c.color, key: c.key };
  // Legacy fallback
  return {
    name: CATEGORY_LABELS[doc.category] || doc.category || "Others",
    emoji: CATEGORY_ICONS[doc.category] || "📁",
    color: "#6B7280",
    key: doc.category || "OTHERS",
  };
}

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

/** Bulk download a list of documents as a single zip. Triggers a browser save. */
export async function bulkDownloadDocs(docIds: string[]): Promise<void> {
  if (!docIds.length) return;
  const res = await api.post("/documents/bulk-download", { doc_ids: docIds }, {
    responseType: "blob",
    timeout: 120000,
  });
  const cd = (res.headers as any)["content-disposition"] || "";
  let fname = "docvault-bundle.zip";
  const m = cd.match(/filename="?([^"]+)"?/i);
  if (m) fname = m[1];
  const blobUrl = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = fname;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
}