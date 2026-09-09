"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { resilientFetch } from "@/lib/apiConfig";
import IdleTimeoutModal from "@/components/auth/IdleTimeoutModal";

export interface User {
  id: string;
  email: string;
  nombre_completo: string;
  rol: string;
  empresa_id?: string;
  totp_enabled?: boolean;
}

export interface LoginResult {
  success: boolean;
  requires2FA?: boolean;
  message?: string;
  error?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  requires2FA: boolean;
  login: (usernameOrEmail: string, pass: string) => Promise<LoginResult>;
  verify2FA: (code: string) => Promise<{ success: boolean; error?: string }>;
  cancel2FA: () => void;
  logout: () => void;
  extendSession: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Configuración de Tiempos de Sesión (OWASP Session Management)
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 Minutos de inactividad
const WARNING_TIMEOUT_MS = 25 * 60 * 1000;    // Alerta a los 25 Minutos (5 min de margen)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [requires2FA, setRequires2FA] = useState<boolean>(false);
  const [tempToken, setTempToken] = useState<string | null>(null);

  // Estados de Inactividad
  const [showIdleWarning, setShowIdleWarning] = useState<boolean>(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(300);

  const lastActivityRef = useRef<number>(0);
  const router = useRouter();

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setRequires2FA(false);
    setTempToken(null);
    setShowIdleWarning(false);
    try {
      localStorage.removeItem("sma_token");
      localStorage.removeItem("sma_user");
      document.cookie = `sma_auth=; path=/; max-age=0; SameSite=Strict`;
    } catch {
      // Ignorar errores de cookies/storage en entornos restringidos
    }
    router.push("/login");
  }, [router]);

  // Validar sesión contra el backend al iniciar la aplicación
  useEffect(() => {
    async function validateInitialSession() {
      try {
        const savedToken = localStorage.getItem("sma_token");
        const savedUser = localStorage.getItem("sma_user");

        if (!savedToken || !savedUser) {
          setIsLoading(false);
          return;
        }

        // Validación estricta con el backend para verificar firma y estado activo
        const res = await resilientFetch("/api/v1/auth/me", {
          headers: {
            "Authorization": `Bearer ${savedToken}`,
            "Content-Type": "application/json"
          }
        }, 5000);

        if (res.ok) {
          const freshUser: User = await res.json();
          setToken(savedToken);
          setUser(freshUser);
          localStorage.setItem("sma_user", JSON.stringify(freshUser));
        } else {
          // Token rechazado o usuario inactivo -> purgar almacenamiento local
          localStorage.removeItem("sma_token");
          localStorage.removeItem("sma_user");
          setToken(null);
          setUser(null);
        }
      } catch (err) {
        console.warn("[AuthContext] Backend inaccesible al validar sesión inicial:", err);
        // En caso de caída transitoria de red, mantener sesión local si existe
        const savedToken = localStorage.getItem("sma_token");
        const savedUser = localStorage.getItem("sma_user");
        if (savedToken && savedUser) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
        }
      } finally {
        setIsLoading(false);
      }
    }

    validateInitialSession();
  }, []);

  // Actualizar marca de actividad del usuario
  const resetActivityTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (showIdleWarning) {
      setShowIdleWarning(false);
      setRemainingSeconds(300);
    }
  }, [showIdleWarning]);

  // Monitoreo de actividad e inactividad en segundo plano
  useEffect(() => {
    if (!user || !token) return;

    const handleUserActivity = () => {
      // Registrar actividad cada 10 segundos para no saturar CPU
      if (Date.now() - lastActivityRef.current > 10000) {
        resetActivityTimer();
      }
    };

    window.addEventListener("mousemove", handleUserActivity, { passive: true });
    window.addEventListener("keydown", handleUserActivity, { passive: true });
    window.addEventListener("click", handleUserActivity, { passive: true });
    window.addEventListener("scroll", handleUserActivity, { passive: true });
    window.addEventListener("touchstart", handleUserActivity, { passive: true });

    const interval = setInterval(() => {
      const inactiveDuration = Date.now() - lastActivityRef.current;

      if (inactiveDuration >= INACTIVITY_TIMEOUT_MS) {
        // Tiempo límite alcanzado -> Cierre forzoso de sesión
        clearInterval(interval);
        logout();
      } else if (inactiveDuration >= WARNING_TIMEOUT_MS) {
        // En el rango de advertencia (últimos 5 minutos)
        const leftSec = Math.max(0, Math.floor((INACTIVITY_TIMEOUT_MS - inactiveDuration) / 1000));
        setRemainingSeconds(leftSec);
        setShowIdleWarning(true);
      } else {
        if (showIdleWarning) {
          setShowIdleWarning(false);
        }
      }
    }, 1000);

    return () => {
      window.removeEventListener("mousemove", handleUserActivity);
      window.removeEventListener("keydown", handleUserActivity);
      window.removeEventListener("click", handleUserActivity);
      window.removeEventListener("scroll", handleUserActivity);
      window.removeEventListener("touchstart", handleUserActivity);
      clearInterval(interval);
    };
  }, [user, token, resetActivityTimer, showIdleWarning, logout]);

  // Login primario contra el backend
  const login = async (usernameOrEmail: string, pass: string): Promise<LoginResult> => {
    setIsLoading(true);
    const cleanIdent = usernameOrEmail.trim();

    try {
      const res = await resilientFetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: cleanIdent,
          email: cleanIdent.includes("@") ? cleanIdent.toLowerCase() : undefined,
          password: pass
        })
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        // Caso 1: Requiere segundo factor (2FA / TOTP)
        if (data.requires_2fa && data.temp_token) {
          setTempToken(data.temp_token);
          setRequires2FA(true);
          setIsLoading(false);
          return {
            success: false,
            requires2FA: true,
            message: data.message || "Ingrese el código de su aplicación de autenticación."
          };
        }

        // Caso 2: Login directo exitoso
        const authToken = data.access_token;
        const authUser: User = data.user;

        setToken(authToken);
        setUser(authUser);
        setRequires2FA(false);
        setTempToken(null);
        resetActivityTimer();

        localStorage.setItem("sma_token", authToken);
        localStorage.setItem("sma_user", JSON.stringify(authUser));
        
        const isProd = process.env.NODE_ENV === "production";
        document.cookie = `sma_auth=true; path=/; max-age=3600; SameSite=Strict${isProd ? "; Secure" : ""}`;
        setIsLoading(false);
        return { success: true };
      }

      // Error en credenciales
      setIsLoading(false);
      return {
        success: false,
        error: data.detail || "Credenciales de acceso incorrectas."
      };

    } catch {
      setIsLoading(false);
      return {
        success: false,
        error: "Error de conexión segura con el servidor. Intente nuevamente en unos instantes."
      };
    }
  };

  // Verificación de código 2FA (TOTP)
  const verify2FA = async (code: string): Promise<{ success: boolean; error?: string }> => {
    if (!tempToken) {
      return { success: false, error: "La sesión de verificación ha expirado. Inicie sesión nuevamente." };
    }

    setIsLoading(true);
    try {
      const res = await resilientFetch("/api/v1/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          temp_token: tempToken,
          code: code.trim()
        })
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.access_token) {
        const authToken = data.access_token;
        const authUser: User = data.user;

        setToken(authToken);
        setUser(authUser);
        setRequires2FA(false);
        setTempToken(null);
        resetActivityTimer();

        localStorage.setItem("sma_token", authToken);
        localStorage.setItem("sma_user", JSON.stringify(authUser));

        const isProd = process.env.NODE_ENV === "production";
        document.cookie = `sma_auth=true; path=/; max-age=3600; SameSite=Strict${isProd ? "; Secure" : ""}`;
        setIsLoading(false);
        return { success: true };
      }

      setIsLoading(false);
      return {
        success: false,
        error: data.detail || "Código de autenticación incorrecto o expirado."
      };

    } catch {
      setIsLoading(false);
      return {
        success: false,
        error: "Error de comunicación al verificar código 2FA."
      };
    }
  };

  const cancel2FA = () => {
    setRequires2FA(false);
    setTempToken(null);
  };

  const refreshUser = async () => {
    const savedToken = token || localStorage.getItem("sma_token");
    if (!savedToken) return;
    try {
      const res = await resilientFetch("/api/v1/auth/me", {
        headers: {
          "Authorization": `Bearer ${savedToken}`,
          "Content-Type": "application/json"
        }
      }, 5000);
      if (res.ok) {
        const freshUser: User = await res.json();
        setUser(freshUser);
        localStorage.setItem("sma_user", JSON.stringify(freshUser));
      }
    } catch (err) {
      console.warn("[AuthContext] Error refrescando usuario:", err);
    }
  };

  const extendSession = () => {
    resetActivityTimer();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        requires2FA,
        login,
        verify2FA,
        cancel2FA,
        logout,
        extendSession,
        refreshUser
      }}
    >
      {children}
      <IdleTimeoutModal
        isOpen={showIdleWarning}
        remainingSeconds={remainingSeconds}
        onExtend={extendSession}
        onLogout={logout}
      />
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
