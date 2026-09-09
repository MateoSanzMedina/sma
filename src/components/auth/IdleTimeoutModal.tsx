"use client";

import React from "react";
import { ShieldAlert, Clock, LogOut, CheckCircle2 } from "lucide-react";

interface IdleTimeoutModalProps {
  isOpen: boolean;
  remainingSeconds: number;
  onExtend: () => void;
  onLogout: () => void;
}

export default function IdleTimeoutModal({
  isOpen,
  remainingSeconds,
  onExtend,
  onLogout
}: IdleTimeoutModalProps) {
  if (!isOpen) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-slate-900 p-6 shadow-2xl shadow-amber-500/10 text-slate-100">
        <div className="flex items-center gap-3 text-amber-400 mb-4">
          <div className="rounded-xl bg-amber-500/10 p-3 ring-1 ring-amber-500/30">
            <ShieldAlert className="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Sesión Inactiva</h3>
            <p className="text-xs text-amber-400/80">Política de seguridad OWASP SMA</p>
          </div>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed mb-6">
          No se ha detectado actividad reciente en su cuenta. Por motivos de seguridad y protección de datos, su sesión se cerrará automáticamente en:
        </p>

        <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-950/80 py-4 px-6 border border-slate-800 mb-6">
          <Clock className="h-5 w-5 text-amber-400 animate-pulse" />
          <span className="font-mono text-3xl font-bold tracking-wider text-amber-300">
            {formattedTime}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onExtend}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            <CheckCircle2 className="h-4 w-4" />
            Mantener Sesión
          </button>
          <button
            onClick={onLogout}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Cerrar Ahora
          </button>
        </div>
      </div>
    </div>
  );
}
