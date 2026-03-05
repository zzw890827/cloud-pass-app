"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import type { User } from "@/types";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const CF_TEAM_DOMAIN = process.env.NEXT_PUBLIC_CF_TEAM_DOMAIN || "";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const u = await api.me();
      setUser(u);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    // CF Access handles auth — just try to fetch user profile
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const logout = () => {
    setUser(null);
    if (CF_TEAM_DOMAIN) {
      // Redirect to CF Access logout
      window.location.href = `https://${CF_TEAM_DOMAIN}.cloudflareaccess.com/cdn-cgi/access/logout`;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
