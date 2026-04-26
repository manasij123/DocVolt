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
