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
    <div className="min-h-screen w-full flex items-center justify-center bg-[#070B12] px-4 py-12 relative overflow-hidden selection:bg-[#11a542]/30 selection:text-white">
      {/* Resplandor Ambiental Minimalista - Paleta Serving (Verde Esmeralda Sutil) */}
      <div 
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full blur-[140px] opacity-20"
        style={{ background: "radial-gradient(circle, #11a542 0%, #015c32 45%, transparent 70%)" }}
      />
      <div 
        className="pointer-events-none absolute -bottom-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-[140px] opacity-10"
        style={{ background: "radial-gradient(circle, #015c32 0%, transparent 65%)" }}
      />

      {/* Contenedor Principal con Espaciado Generoso */}
      <div className="w-full max-w-[440px] flex flex-col items-center gap-8 relative z-10">
        
        {/* Cabecera de Marca Serving S.A.S. */}
        <div className="flex flex-col items-center text-center gap-3.5">
          {/* Emblema con bordes redondeados orgánicos */}
          <div 
            className="flex h-16 w-16 items-center justify-center rounded-[22px] shadow-2xl transition-all duration-300 hover:scale-105"
            style={{ 
              background: "linear-gradient(135deg, #015c32 0%, #11a542 100%)",
              boxShadow: "0 10px 30px -5px rgba(17, 165, 66, 0.4)"
            }}
          >
            <span className="font-display text-2xl font-black text-white tracking-wider drop-shadow-sm">
              S
            </span>
          </div>
          
          <div className="flex flex-col gap-1.5 mt-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Constructora Serving S.A.S.
            </h1>
            <p className="text-xs sm:text-sm font-normal text-slate-400">
              Sistema de Gestión Integral &amp; Control de Obras (SMA)
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-[#11a542]/25 bg-[#015c32]/25 px-4 py-1.5 text-xs font-medium text-[#11a542] backdrop-blur-md">
            <ShieldCheck className="h-3.5 w-3.5 text-[#11a542]" />
            <span>Acceso Corporativo Cifrado</span>
          </div>
        </div>

        {/* Tarjeta Ejecutiva Minimalista con Curvatura 'rounded-[28px]' */}
        <div 
          className="w-full rounded-[28px] border border-white/[0.08] bg-[#0c1220]/80 p-8 sm:p-10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] backdrop-blur-2xl flex flex-col gap-6"
        >
          {/* Notificación de Error */}
          {error && (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-xs sm:text-sm font-medium text-rose-300 animate-in fade-in duration-200">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-6 w-full">
            
            {/* Campo: Usuario o Correo */}
            <div className="flex flex-col gap-2 w-full text-left">
              <label 
                htmlFor="user-ident"
                className="text-xs font-medium tracking-wide text-slate-300 ml-1"
              >
                Usuario o Correo
              </label>
              
              <div className="relative flex items-center w-full">
                {/* Icono perfectamente ubicado y centrado verticalmente */}
                <div className="absolute left-4 flex items-center justify-center pointer-events-none text-slate-400 z-10">
                  <UserIcon className="h-4.5 w-4.5 text-slate-400" />
                </div>
                
                {/* Input con padding-left inline explícito de 52px (3.25rem) para evitar cualquier solapamiento */}
                <input
                  id="user-ident"
                  type="text"
                  autoComplete="username"
                  required
                  placeholder="ChainPoint o usuario@serving.com.co"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={{ paddingLeft: "3.25rem", paddingRight: "1.25rem" }}
                  className="w-full h-13 rounded-2xl border border-white/[0.08] bg-[#070b14] text-sm text-white placeholder:text-slate-500 transition-all duration-200 focus:border-[#11a542] focus:bg-[#070b14] focus:outline-none focus:ring-4 focus:ring-[#11a542]/15"
                />
              </div>
            </div>

            {/* Campo: Contraseña */}
            <div className="flex flex-col gap-2 w-full text-left">
              <label 
                htmlFor="password-ident"
                className="text-xs font-medium tracking-wide text-slate-300 ml-1"
              >
                Contraseña
              </label>
              
              <div className="relative flex items-center w-full">
                {/* Icono de candado centrado */}
                <div className="absolute left-4 flex items-center justify-center pointer-events-none text-slate-400 z-10">
                  <Lock className="h-4.5 w-4.5 text-slate-400" />
                </div>
                
                {/* Input con paddings explícitos izquierda y derecha */}
                <input
                  id="password-ident"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingLeft: "3.25rem", paddingRight: "3.25rem" }}
                  className="w-full h-13 rounded-2xl border border-white/[0.08] bg-[#070b14] text-sm text-white placeholder:text-slate-500 transition-all duration-200 focus:border-[#11a542] focus:bg-[#070b14] focus:outline-none focus:ring-4 focus:ring-[#11a542]/15"
                />

                {/* Botón Ver/Ocultar con espacio independiente */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer flex items-center justify-center"
                  title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                >
                  {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
            </div>

            {/* Botón Principal: Píldora Ejecutiva en Verde Serving */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 w-full h-13 rounded-full text-white font-semibold text-sm tracking-wide transition-all duration-300 flex items-center justify-center gap-2.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] hover:-translate-y-0.5"
              style={{
                background: "linear-gradient(135deg, #015c32 0%, #11a542 100%)",
                boxShadow: "0 8px 25px -4px rgba(17, 165, 66, 0.45)"
              }}
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Autenticando...</span>
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

        {/* Footer Minimalista */}
        <p className="text-center text-xs text-slate-500 font-light">
          &copy; {new Date().getFullYear()} Constructora Serving S.A.S. &bull; Todos los derechos reservados.
        </p>

      </div>
    </div>
  );
}
