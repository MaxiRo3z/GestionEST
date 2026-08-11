import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, clearToken, getToken, setToken } from "../api/client";

interface Usuario {
  id: number;
  username: string;
  activo: boolean;
}

interface AuthContextValue {
  usuario: Usuario | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  const cargarUsuario = () => {
    if (!getToken()) {
      setUsuario(null);
      setLoading(false);
      return;
    }
    api
      .get<Usuario>("/api/auth/me")
      .then(setUsuario)
      .catch(() => setUsuario(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    cargarUsuario();

    // Disparado por client.ts cuando cualquier request devuelve 401
    // (token vencido o inválido) -- cierra sesión en toda la app.
    const onUnauthorized = () => setUsuario(null);
    window.addEventListener("auth:unauthorized", onUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", onUnauthorized);
  }, []);

  const login = async (username: string, password: string) => {
    const res = await api.post<{ access_token: string }>("/api/auth/login", { username, password });
    setToken(res.access_token);
    const me = await api.get<Usuario>("/api/auth/me");
    setUsuario(me);
  };

  const logout = () => {
    clearToken();
    setUsuario(null);
  };

  return (
    <AuthContext.Provider value={{ usuario, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
