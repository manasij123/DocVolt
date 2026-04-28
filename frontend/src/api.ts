import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";

export const API_BASE_URL = `${BASE}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
});

const TOKEN_KEY = "pdfstore_admin_token";
const ROLE_KEY = "pdfstore_last_role";
const USER_KEY = "pdfstore_user";

// Web fallback (Expo web preview cannot use SecureStore)
const memoryStore: { [key: string]: string } = {};

async function setItem(key: string, value: string | null) {
  if (Platform.OS === "web") {
    if (value === null) delete memoryStore[key];
    else memoryStore[key] = value;
    return;
  }
  if (value === null) await SecureStore.deleteItemAsync(key);
  else await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") return memoryStore[key] || null;
  return await SecureStore.getItemAsync(key);
}

export async function setToken(token: string | null) { await setItem(TOKEN_KEY, token); }
export async function getToken() { return getItem(TOKEN_KEY); }

export async function setLastRole(role: "admin" | "client" | null) {
  await setItem(ROLE_KEY, role);
}
export async function getLastRole(): Promise<"admin" | "client" | null> {
  const v = await getItem(ROLE_KEY);
  if (v === "admin" || v === "client") return v;
  return null;
}

export type UserInfo = { id: string; email: string; name: string; role: "admin" | "client" };

export async function setStoredUser(u: UserInfo | null) {
  await setItem(USER_KEY, u ? JSON.stringify(u) : null);
}
export async function getStoredUser(): Promise<UserInfo | null> {
  const raw = await getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as UserInfo; } catch { return null; }
}

export async function logoutLocal() {
  await setToken(null);
  await setLastRole(null);
  await setStoredUser(null);
}

api.interceptors.request.use(async (config) => {
  const token = await getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      const url = err?.config?.url || "";
      if (!url.includes("/auth/login") && !url.includes("/auth/register")) {
        // Token expired — clear local creds. Caller should redirect.
        logoutLocal().catch(() => {});
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
  category: string;            // legacy enum or custom slug
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
  icon: string;          // ionicons name (eg "stats-chart")
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

// Visual presets for the Category Editor (mobile uses Ionicons names).
export const CATEGORY_COLOR_PRESETS = [
  "#3B82F6", "#8B5CF6", "#10B981", "#F59E0B",
  "#EF4444", "#EC4899", "#06B6D4", "#6B7280",
];
export const CATEGORY_ICON_PRESETS: { name: string; label: string }[] = [
  { name: "stats-chart",    label: "Chart" },
  { name: "paper-plane",    label: "Mail" },
  { name: "podium",         label: "Report" },
  { name: "folder-open",    label: "Folder" },
  { name: "receipt",        label: "Receipt" },
  { name: "card",           label: "Card" },
  { name: "cash",           label: "Cash" },
  { name: "calculator",     label: "Calc" },
  { name: "briefcase",      label: "Bag" },
  { name: "document-text",  label: "Doc" },
  { name: "shield",         label: "Shield" },
  { name: "medkit",         label: "Med" },
  { name: "school",         label: "School" },
  { name: "home",           label: "Home" },
  { name: "car",            label: "Car" },
  { name: "gift",           label: "Gift" },
];

// ===== Per-client dynamic categories — CRUD helpers =====
export async function listCategories(params: { client_id?: string; admin_id?: string }, token?: string): Promise<Category[]> {
  const r = await api.get<Category[]>("/categories", {
    params,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return r.data;
}
export async function createCategory(payload: {
  client_id: string;
  name: string;
  color?: string;
  icon?: string;
  keywords?: string[];
}, token?: string): Promise<Category> {
  const r = await api.post<Category>("/categories", payload, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return r.data;
}
export async function updateCategoryApi(id: string, payload: Partial<Pick<Category, "name" | "color" | "icon" | "keywords" | "sort_order">>, token?: string): Promise<Category> {
  const r = await api.put<Category>(`/categories/${id}`, payload, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return r.data;
}
export async function deleteCategoryApi(id: string, token?: string): Promise<{ ok: boolean; moved_to_others: number }> {
  const r = await api.delete(`/categories/${id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return r.data;
}
export async function generateCategoryIcon(payload: { description: string; style_hint?: string }, token?: string): Promise<{ image_base64: string; prompt_used: string }> {
  // gpt-image-1 can take 30-90s; bump axios timeout for this call.
  const r = await api.post("/categories/generate-icon", payload, {
    timeout: 180_000,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return r.data;
}

/** Pick the category that best matches a filename via the per-client keywords.
 * Returns the category id, falling back to the OTHERS row if no match. */
export function autoDetectCategoryId(filename: string, cats: Category[]): string {
  const n = (filename || "").toLowerCase();
  for (const c of cats) {
    for (const kw of c.keywords || []) {
      if (kw && n.includes(kw.toLowerCase())) return c.id;
    }
  }
  const others = cats.find((c) => c.key === "OTHERS");
  return others ? others.id : (cats[0]?.id || "");
}

export function fileUrl(id: string) {
  return `${API_BASE_URL}/documents/${id}/file`;
}

export function initials(name: string): string {
  const t = (name || "").trim();
  if (!t) return "?";
  const parts = t.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
}

export function colorFromString(s: string): string {
  let h = 0;
  for (let i = 0; i < (s || "").length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return `hsl(${h} 70% 50%)`;
}
