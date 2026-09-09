"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { LogOut, Sun, Moon, Bell } from "lucide-react";

export default function Header() {
  const { user, logout } = useAuth();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = () => {
    document.documentElement.classList.toggle("dark");
    const nextDark = document.documentElement.classList.contains("dark");
    setIsDark(nextDark);
    localStorage.setItem("theme", nextDark ? "dark" : "light");
  };

  return (
    <header 
      className="flex items-center justify-between whitespace-nowrap border-b px-4 sm:px-6 md:px-8 py-4 sticky top-0 z-20 shrink-0 backdrop-blur-md bg-white/80 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800 transition-colors"
    >
      <div className="flex items-center gap-4">
        {/* Espacio reservado para breadcrumbs / acciones de página */}
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 pr-4 border-r border-slate-200 dark:border-slate-800">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
              {user?.nombre_completo || "Administrador"}
            </p>
            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
              {user?.rol || "ADMIN"} &bull; {user?.email || "admin@serving.com.co"}
            </p>
          </div>
          <button
            onClick={logout}
            className="flex items-center justify-center rounded-xl h-9 w-9 transition-colors cursor-pointer bg-slate-100 hover:bg-rose-500/10 text-slate-500 hover:text-rose-500 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-rose-500/20 dark:hover:text-rose-400"
            title="Cerrar Sesión"
          >
            <LogOut className="h-4.5 w-4.5" />
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="flex cursor-pointer items-center justify-center rounded-xl h-9 w-9 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-[#11a542] dark:hover:text-[#11a542] transition-all hover:scale-105"
            title="Alternar Modo Oscuro/Claro"
          >
            {isDark ? <Sun className="h-4.5 w-4.5 text-amber-500" /> : <Moon className="h-4.5 w-4.5" />}
          </button>

          <button
            className="flex cursor-pointer items-center justify-center rounded-xl h-9 w-9 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-[#11a542] dark:hover:text-[#11a542] transition-all hover:scale-105 relative"
            title="Notificaciones"
          >
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <Bell className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
