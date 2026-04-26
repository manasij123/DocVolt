import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import api, { setToken, setStoredUser, getStoredUser, getToken, UserInfo, logoutLocal, setLastRole } from "./api";

export const AUTH_WRONG_ROLE = "AUTH_WRONG_ROLE";

type AuthContextValue = {
  user: UserInfo | null;
  loading: boolean;
  login: (email: string, password: string, expectedRole?: "admin" | "client") => Promise<UserInfo>;
  register: (
    email: string,
    password: string,
    name: string,
    role: "admin" | "client",
    adminEmail?: string,
  ) => Promise<UserInfo>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) { setLoading(false); return; }
      const cached = await getStoredUser();
      if (cached) setUser(cached);
      try {
        const res = await api.get("/auth/me");
        setUser(res.data);
        await setStoredUser(res.data);
      } catch {
        await logoutLocal();
        setUser(null);
      } finally { setLoading(false); }
    })();
  }, []);

  const login = async (email: string, password: string, expectedRole?: "admin" | "client") => {
    const res = await api.post("/auth/login", { email, password });
    const u = res.data.user as UserInfo;
    if (expectedRole && u.role !== expectedRole) {
      // Do NOT persist token / set user — refuse the wrong-role login.
      const err: any = new Error(AUTH_WRONG_ROLE);
      err.code = AUTH_WRONG_ROLE;
      err.actualRole = u.role;
      throw err;
    }
    await setToken(res.data.access_token);
    await setStoredUser(u);
    await setLastRole(u.role);
    setUser(u);
    return u;
  };

  const register = async (
    email: string,
    password: string,
    name: string,
    role: "admin" | "client",
    adminEmail?: string,
  ) => {
    const body: any = { email, password, name, role };
    if (role === "client" && adminEmail) body.admin_email = adminEmail;
    const res = await api.post("/auth/register", body);
    await setToken(res.data.access_token);
    await setStoredUser(res.data.user);
    await setLastRole(res.data.user.role);
    setUser(res.data.user);
    return res.data.user as UserInfo;
  };

  const logout = async () => {
    await logoutLocal();
    setUser(null);
  };

  const refresh = async () => {
    try {
      const res = await api.get("/auth/me");
      setUser(res.data);
      await setStoredUser(res.data);
    } catch {
      // ignore
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
