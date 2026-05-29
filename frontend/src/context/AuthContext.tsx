import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { authApi, AuthUser, getStoredUser, getToken, setStoredUser, setToken } from "@/lib/api";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getStoredUser());
  const [loading, setLoading] = useState<boolean>(!!getToken() && !getStoredUser());

  useEffect(() => {
    let active = true;
    if (getToken() && !user) {
      authApi
        .me()
        .then((res) => {
          if (!active) return;
          setUser(res.user);
          setStoredUser(res.user);
        })
        .catch(() => {
          setToken(null);
          setStoredUser(null);
          setUser(null);
        })
        .finally(() => active && setLoading(false));
    } else {
      setLoading(false);
    }
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    setToken(res.token);
    setStoredUser(res.user);
    setUser(res.user);
  };

  const logout = () => {
    setToken(null);
    setStoredUser(null);
    setUser(null);
  };

  const refresh = async () => {
    const res = await authApi.me();
    setUser(res.user);
    setStoredUser(res.user);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
