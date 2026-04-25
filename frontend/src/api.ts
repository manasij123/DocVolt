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

const memoryStore: { [key: string]: string } = {};

async function setItem(key: string, value: string | null) {
  if (Platform.OS === "web") {
    if (value === null) {
      delete memoryStore[key];
    } else {
      memoryStore[key] = value;
    }
    return;
  }
  if (value === null) {
    await SecureStore.deleteItemAsync(key);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return memoryStore[key] || null;
  }
  return await SecureStore.getItemAsync(key);
}

export async function setToken(token: string | null) {
  await setItem(TOKEN_KEY, token);
}

export async function getToken() {
  return getItem(TOKEN_KEY);
}

export async function setLastRole(role: "admin" | "client" | null) {
  await setItem(ROLE_KEY, role);
}

export async function getLastRole(): Promise<"admin" | "client" | null> {
  const v = await getItem(ROLE_KEY);
  if (v === "admin" || v === "client") return v;
  return null;
}

api.interceptors.request.use(async (config) => {
  const token = await getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
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
