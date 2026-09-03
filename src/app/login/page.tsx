"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ShieldCheck, Lock, User as UserIcon, Eye, EyeOff, ArrowRight, Building2, AlertCircle } from "lucide-react";

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
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0B0F19] px-4 py-8 relative overflow-hidden selection:bg-amber-500/20 selection:text-amber-200">
      {/* Luces de Fondo Ambientales Estilo Construcción / Ingeniería */}
      <div 
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-3xl opacity-20"
        style={{ background: "radial-gradient(circle, #015c32 0%, #ff6600 50%, transparent 70%)" }}
      />
      <div 
        className="pointer-events-none absolute -bottom-40 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full blur-3xl opacity-15"
        style={{ background: "radial-gradient(circle, #11a542 0%, #d97706 60%, transparent 80%)" }}
      />

      {/* Contenedor Central */}
      <div className="w-full max-w-md flex flex-col items-center gap-6 relative z-10">
        
        {/* Cabecera de Marca Corporativa */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 border border-amber-500/30 text-amber-400 shadow-xl shadow-amber-500/10">
            <Building2 className="h-7 w-7" />
          </div>
          
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Constructora Serving S.A.S.
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-400">
              Sistema de Gestión Integral &amp; Control de Obras (SMA)
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 mt-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            Acceso Corporativo Cifrado (OWASP Top 10)
          </div>
        </div>

        {/* Tarjeta de Inicio de Sesión */}
        <div className="w-full rounded-2xl border border-slate-800 bg-slate-900/95 p-6 sm:p-8 shadow-2xl backdrop-blur-xl flex flex-col gap-6">
          
          {/* Mensaje de Error */}
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
                className="text-xs font-bold uppercase tracking-wider text-slate-300"
              >
                Usuario o Correo
              </label>
              <div className="relative flex items-center w-full">
                <div className="pointer-events-none absolute left-3.5 flex items-center text-slate-400">
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
                  className="w-full h-12 rounded-xl border border-slate-700/80 bg-slate-950 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 transition-all focus:border-amber-500 focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>

            {/* Campo: Contraseña */}
            <div className="flex flex-col gap-2 w-full text-left">
              <label 
                htmlFor="password-ident"
                className="text-xs font-bold uppercase tracking-wider text-slate-300"
              >
                Contraseña
              </label>
              <div className="relative flex items-center w-full">
                <div className="pointer-events-none absolute left-3.5 flex items-center text-slate-400">
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
                  className="w-full h-12 rounded-xl border border-slate-700/80 bg-slate-950 pl-10 pr-11 text-sm text-white placeholder:text-slate-500 transition-all focus:border-amber-500 focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer flex items-center justify-center"
                  title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Botón de Ingreso */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-amber-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
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
