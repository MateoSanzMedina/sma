"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ShieldCheck, Lock, User as UserIcon, Eye, EyeOff, ArrowRight, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUser = username.trim();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setError("Por favor ingrese su usuario y contraseña.");
      return;
    }

    setIsSubmitting(true);
    const res = await login(cleanUser, cleanPass);
    setIsSubmitting(false);

    if (res.success) {
      router.replace("/dashboard");
    } else {
      setError(res.error || "Credenciales de acceso incorrectas.");
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#070B12] px-4 py-8 relative overflow-hidden selection:bg-[#11a542]/30 selection:text-white">
      {/* Resplandores de Fondo con Paleta Oficial Serving S.A.S. (Verde Bosque & Verde Esmeralda) */}
      <div 
        className="pointer-events-none absolute -top-48 left-1/2 -translate-x-1/2 w-[650px] h-[650px] rounded-full blur-[120px] opacity-25"
        style={{ background: "radial-gradient(circle, #11a542 0%, #015c32 55%, transparent 75%)" }}
      />
      <div 
        className="pointer-events-none absolute -bottom-48 left-1/2 -translate-x-1/2 w-[550px] h-[550px] rounded-full blur-[120px] opacity-15"
        style={{ background: "radial-gradient(circle, #015c32 0%, #0B1910 60%, transparent 80%)" }}
      />

      {/* Contenedor Principal */}
      <div className="w-full max-w-[420px] flex flex-col items-center gap-7 relative z-10">
        
        {/* Emblema y Título Corporativo Serving S.A.S. */}
        <div className="flex flex-col items-center text-center gap-3">
          {/* Logo Emblema Oficial con 'S' de Serving */}
          <div 
            className="flex h-16 w-16 items-center justify-center rounded-2xl shadow-xl shadow-[#015c32]/30 border border-[#11a542]/40 transition-transform hover:scale-105"
            style={{ background: "linear-gradient(135deg, #015c32 0%, #11a542 100%)" }}
          >
            <span className="font-display text-2xl font-black text-white tracking-wider">
              S
            </span>
          </div>
          
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Constructora Serving S.A.S.
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-400">
              Sistema de Gestión Integral &amp; Control de Obras (SMA)
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#11a542]/30 bg-[#015c32]/20 px-3.5 py-1 text-xs font-semibold text-[#11a542] mt-0.5 backdrop-blur-md">
            <ShieldCheck className="h-3.5 w-3.5 text-[#11a542]" />
            Acceso Corporativo Cifrado (OWASP Top 10)
          </div>
        </div>

        {/* Tarjeta Ejecutiva de Inicio de Sesión */}
        <div className="w-full rounded-2xl border border-white/10 bg-slate-900/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl flex flex-col gap-6">
          
          {/* Mensaje de Error si aplica */}
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs sm:text-sm font-medium text-rose-300 animate-in fade-in duration-200">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full">
            
            {/* Campo: Usuario o Correo */}
            <div className="flex flex-col gap-2 w-full text-left">
              <label 
                htmlFor="user-ident"
                className="text-[11px] font-bold uppercase tracking-wider text-slate-300"
              >
                Usuario o Correo
              </label>
              
              <div className="relative flex items-center w-full">
                {/* Icono perfectamente centrado */}
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center justify-center pointer-events-none text-slate-400">
                  <UserIcon className="h-4 w-4" />
                </div>
                <input
                  id="user-ident"
                  type="text"
                  autoComplete="username"
                  required
                  placeholder="ChainPoint o usuario@serving.com.co"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full h-12 rounded-xl border border-slate-700/80 bg-slate-950/90 pl-11 pr-4 text-sm text-white placeholder:text-slate-500 transition-all focus:border-[#11a542] focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-[#11a542]/20"
                />
              </div>
            </div>

            {/* Campo: Contraseña */}
            <div className="flex flex-col gap-2 w-full text-left">
              <label 
                htmlFor="password-ident"
                className="text-[11px] font-bold uppercase tracking-wider text-slate-300"
              >
                Contraseña
              </label>
              
              <div className="relative flex items-center w-full">
                {/* Icono perfectamente centrado */}
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center justify-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password-ident"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 rounded-xl border border-slate-700/80 bg-slate-950/90 pl-11 pr-11 text-sm text-white placeholder:text-slate-500 transition-all focus:border-[#11a542] focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-[#11a542]/20"
                />
                {/* Botón ver/ocultar contraseña perfectamente centrado */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Botón de Ingreso con Paleta Verde Serving */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 w-full h-12 rounded-xl text-white font-bold text-sm tracking-wide shadow-lg active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                background: "linear-gradient(135deg, #015c32 0%, #11a542 100%)",
                boxShadow: "0 4px 15px rgba(17, 165, 66, 0.25)"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "linear-gradient(135deg, #014d2a 0%, #14c750 100%)";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(17, 165, 66, 0.35)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "linear-gradient(135deg, #015c32 0%, #11a542 100%)";
                e.currentTarget.style.boxShadow = "0 4px 15px rgba(17, 165, 66, 0.25)";
              }}
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Validando credenciales...</span>
                </>
              ) : (
                <>
                  <span>Ingresar a SMA</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

        </div>

        {/* Footer Legal Corporativo */}
        <p className="text-center text-xs text-slate-500">
          &copy; {new Date().getFullYear()} Constructora Serving S.A.S. &bull; Todos los derechos reservados.
        </p>

      </div>
    </div>
  );
}
