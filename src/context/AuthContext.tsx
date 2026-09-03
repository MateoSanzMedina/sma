"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export interface User {
  id: string;
  email: string;
  nombre_completo: string;
  rol: string;
  empresa_id?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  useEffect(() => {
    // Cargar sesión guardada en almacenamiento local
    try {
      const savedToken = localStorage.getItem("sma_token");
      const savedUser = localStorage.getItem("sma_user");
      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      }
    } catch (e) {
      console.error("Error al cargar sesión local:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://sma-backend-m7ia.onrender.com";

    try {
      const res = await fetch(`${apiUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password: pass })
      });

      if (res.ok) {
        const data = await res.json();
        const authToken = data.access_token;
        const authUser: User = data.user;

        setToken(authToken);
        setUser(authUser);
        localStorage.setItem("sma_token", authToken);
        localStorage.setItem("sma_user", JSON.stringify(authUser));
        document.cookie = `sma_auth=true; path=/; max-age=604800; SameSite=Lax`;
        setIsLoading(false);
        return { success: true };
      }

      const errorData = await res.json().catch(() => ({}));
      const errorMsg = errorData.detail || "Credenciales de acceso incorrectas.";
      setIsLoading(false);
      return { success: false, error: errorMsg };

    } catch (netErr: any) {
      setIsLoading(false);
      return { 
        success: false, 
        error: "Error de conexión con el servidor. Intente nuevamente en unos segundos." 
      };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("sma_token");
    localStorage.removeItem("sma_user");
    document.cookie = `sma_auth=; path=/; max-age=0; SameSite=Lax`;
    router.push("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe utilizarse dentro de un AuthProvider");
  }
  return context;
}
