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

const memoryStore: { [key: string]: string } = {};

async function setTokenStorage(value: string | null) {
  if (Platform.OS === "web") {
    if (value === null) {
      delete memoryStore[TOKEN_KEY];
    } else {
      memoryStore[TOKEN_KEY] = value;
    }
    return;
  }
  if (value === null) {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } else {
    await SecureStore.setItemAsync(TOKEN_KEY, value);
  }
}

async function getTokenStorage(): Promise<string | null> {
  if (Platform.OS === "web") {
    return memoryStore[TOKEN_KEY] || null;
  }
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string | null) {
  await setTokenStorage(token);
}

export async function getToken() {
  return getTokenStorage();
}

api.interceptors.request.use(async (config) => {
  const token = await getTokenStorage();
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
