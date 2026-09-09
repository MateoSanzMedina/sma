"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Settings,
  Building2,
  Moon,
  Sun,
  Server,
  Shield,
  Bell,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Laptop
} from "lucide-react";
import { CLOUD_BACKEND_URL, LOCAL_BACKEND_URL } from "@/lib/apiConfig";
import { TwoFactorSetupCard } from "@/components/auth/TwoFactorSetupCard";

export default function ConfiguracionPage() {
  const { user } = useAuth();
  const [theme, setTheme] = useState<"light" | "dark" | "system">("dark");
  const [serverStatus, setServerStatus] = useState<"checking" | "online" | "offline">("checking");
  const [activeServerUrl, setActiveServerUrl] = useState<string>("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const checkBackendHealth = useCallback(async () => {
    setServerStatus("checking");
    // 1. Probar primero si localhost responde
    try {
      const res = await fetch(`${LOCAL_BACKEND_URL}/`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        setServerStatus("online");
        setActiveServerUrl(LOCAL_BACKEND_URL + " (PC Local)");
        return;
      }
    } catch {
      // Localhost no activo, probar Render
    }

    // 2. Probar Render
    try {
      const res = await fetch(`${CLOUD_BACKEND_URL}/`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        setServerStatus("online");
        setActiveServerUrl(CLOUD_BACKEND_URL + " (Nube Render)");
        return;
      }
    } catch {
      // Backend offline o en cold-start
    }

    setServerStatus("offline");
    setActiveServerUrl("Servidor en arranque en frío (Render)");
  }, []);

  // Cargar tema inicial y estado de backend
  useEffect(() => {
    let isMounted = true;
    const timer = setTimeout(() => {
      if (!isMounted) return;
      const isDark = document.documentElement.classList.contains("dark");
      setTheme(isDark ? "dark" : "light");
      checkBackendHealth();
    }, 0);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [checkBackendHealth]);

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else if (newTheme === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  };

  const handleSavePreferences = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto py-2">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#11a542]">
            <Settings className="h-4 w-4" />
            Preferencias del Sistema
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Configuración General
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Administra las opciones de entorno, conectividad, apariencia y seguridad de SMA.
          </p>
        </div>

        {saveSuccess && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            Configuración guardada exitosamente
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Columna Izquierda: Opciones de Apariencia y Sistema */}
        <div className="md:col-span-2 flex flex-col gap-6">
          
          {/* Card: Apariencia & Tema */}
          <div 
            style={{ padding: "1.75rem", borderRadius: "20px" }}
            className="border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-5"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <Sun className="h-5 w-5 dark:hidden" />
                  <Moon className="h-5 w-5 hidden dark:block text-[#11a542]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Tema &amp; Apariencia Visual
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Personaliza el esquema de contraste y colores de la interfaz.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => handleThemeChange("light")}
                style={{ padding: "1rem", borderRadius: "16px" }}
                className={`flex flex-col items-center gap-2 border text-xs font-bold transition-all cursor-pointer ${
                  theme === "light"
                    ? "border-[#11a542] bg-emerald-500/10 text-[#015c32] dark:text-[#11a542] ring-2 ring-[#11a542]/20"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                }`}
              >
                <Sun className="h-5 w-5 text-amber-500" />
                <span>Modo Claro</span>
              </button>

              <button
                onClick={() => handleThemeChange("dark")}
                style={{ padding: "1rem", borderRadius: "16px" }}
                className={`flex flex-col items-center gap-2 border text-xs font-bold transition-all cursor-pointer ${
                  theme === "dark"
                    ? "border-[#11a542] bg-emerald-500/10 text-[#015c32] dark:text-[#11a542] ring-2 ring-[#11a542]/20"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                }`}
              >
                <Moon className="h-5 w-5 text-emerald-400" />
                <span>Modo Oscuro</span>
              </button>

              <button
                onClick={() => handleThemeChange("system")}
                style={{ padding: "1rem", borderRadius: "16px" }}
                className={`flex flex-col items-center gap-2 border text-xs font-bold transition-all cursor-pointer ${
                  theme === "system"
                    ? "border-[#11a542] bg-emerald-500/10 text-[#015c32] dark:text-[#11a542] ring-2 ring-[#11a542]/20"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                }`}
              >
                <Laptop className="h-5 w-5 text-slate-500" />
                <span>Automático</span>
              </button>
            </div>
          </div>

          {/* Card: Servidores & Conectividad */}
          <div 
            style={{ padding: "1.75rem", borderRadius: "20px" }}
            className="border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-5"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <Server className="h-5 w-5 text-[#11a542]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Conectividad de Backend
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Estado de comunicación entre Next.js y el motor de FastAPI.
                  </p>
                </div>
              </div>

              <button
                onClick={checkBackendHealth}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                title="Comprobar estado del servidor"
              >
                <RefreshCw className={`h-4 w-4 ${serverStatus === "checking" ? "animate-spin text-[#11a542]" : ""}`} />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/60">
                <div className="flex items-center gap-3">
                  <span 
                    className={`h-3 w-3 rounded-full ${
                      serverStatus === "online" 
                        ? "bg-emerald-500 shadow-lg shadow-emerald-500/50" 
                        : serverStatus === "checking" 
                          ? "bg-amber-400 animate-pulse" 
                          : "bg-rose-500"
                    }`} 
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      {serverStatus === "online" 
                        ? "Backend Operativo & Conectado" 
                        : serverStatus === "checking" 
                          ? "Verificando disponibilidad..." 
                          : "Backend No Disponible (Cold Start)"}
                    </p>
                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                      {activeServerUrl || "Consultando endpoints..."}
                    </p>
                  </div>
                </div>

                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  FastAPI v1
                </span>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                El sistema utiliza <strong>resilientFetch</strong> para detectar automáticamente si estás ejecutando el servidor en tu computador local (<code className="font-mono">localhost:8000</code>) o en la nube (<code className="font-mono">render.com</code>).
              </p>
            </div>
          </div>

          {/* Card: Autenticación en Dos Pasos (2FA / TOTP) */}
          <TwoFactorSetupCard />

          {/* Card: Notificaciones y Auditoría */}
          <div 
            style={{ padding: "1.75rem", borderRadius: "20px" }}
            className="border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4"
          >
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <Bell className="h-5 w-5 text-[#11a542]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Alertas y Notificaciones de Obra
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Avisos de vencimientos de seguridad social y desvíos presupuestales.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <label className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer">
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Alertas de Novedades de Seguridad Social</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Notificar diferencias entre planillas ARUS y registros SIIMED.</p>
                </div>
                <input type="checkbox" defaultChecked className="h-4 w-4 accent-[#11a542] rounded cursor-pointer" />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer">
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Avisos de Desviación de Costos SAO</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Alertar cuando un capítulo supere el 5% de sobrecosto.</p>
                </div>
                <input type="checkbox" defaultChecked className="h-4 w-4 accent-[#11a542] rounded cursor-pointer" />
              </label>
            </div>
          </div>

        </div>

        {/* Columna Derecha: Datos de la Empresa y Sesión */}
        <div className="flex flex-col gap-6">
          
          {/* Card: Empresa */}
          <div 
            style={{ padding: "1.75rem", borderRadius: "20px" }}
            className="border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4"
          >
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-[#11a542]">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Constructora Serving S.A.S.
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Organización Principal
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">NIT</span>
                <span className="font-semibold text-slate-900 dark:text-white">900.824.195-2</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Sede</span>
                <span className="font-semibold text-slate-900 dark:text-white">Medellín, Colombia</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Módulos</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">SMA Enterprise</span>
              </div>
            </div>
          </div>

          {/* Card: Sesión Actual */}
          <div 
            style={{ padding: "1.75rem", borderRadius: "20px" }}
            className="border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4"
          >
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <Shield className="h-5 w-5 text-[#11a542]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Sesión de Usuario
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Autenticación Activa
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Usuario</span>
                <span className="font-semibold text-slate-900 dark:text-white">{user?.nombre_completo || "ChainPoint Super Admin"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Rol</span>
                <span className="font-bold text-[#11a542]">{user?.rol || "ADMIN"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Cifrado</span>
                <span className="font-semibold text-slate-900 dark:text-white">JWT HS256</span>
              </div>
            </div>
          </div>

          {/* Botón Guardar */}
          <button
            onClick={handleSavePreferences}
            style={{
              borderRadius: "9999px",
              padding: "0.85rem 1.5rem",
              background: "linear-gradient(135deg, #015c32 0%, #11a542 100%)",
              boxShadow: "0 6px 20px rgba(17, 165, 66, 0.35)",
            }}
            className="w-full text-white font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border-none flex items-center justify-center gap-2"
          >
            <span>Guardar Preferencias</span>
          </button>

        </div>

      </div>
    </div>
  );
}
