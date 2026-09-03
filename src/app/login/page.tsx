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
      <div className="w-full max-w-[460px] flex flex-col items-center gap-8 relative z-10">
        
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

        {/* Tarjeta Ejecutiva con Padding Generoso Blindado (Evita que el texto toque el borde) */}
        <div 
          style={{
            padding: "2.75rem 2.25rem",
            borderRadius: "28px",
            backgroundColor: "rgba(12, 18, 32, 0.90)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.7)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            display: "flex",
            flexDirection: "column",
            gap: "1.75rem",
            width: "100%",
          }}
        >
          {/* Notificación de Error */}
          {error && (
            <div 
              style={{ padding: "1rem 1.25rem", borderRadius: "16px" }}
              className="flex items-start gap-3 border border-rose-500/25 bg-rose-500/10 text-xs sm:text-sm font-medium text-rose-300 animate-in fade-in duration-200"
            >
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Formulario con Separación Vertical Amplia */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.5rem", width: "100%" }}>
            
            {/* Campo: Usuario o Correo */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", width: "100%", textAlign: "left" }}>
              <label 
                htmlFor="user-ident"
                style={{ marginLeft: "0.25rem" }}
                className="text-xs font-medium tracking-wide text-slate-300"
              >
                Usuario o Correo
              </label>
              
              <div style={{ position: "relative", display: "flex", alignItems: "center", width: "100%" }}>
                {/* Icono perfectamente ubicado y centrado */}
                <div 
                  style={{ position: "absolute", left: "1.1rem", display: "flex", alignItems: "center", pointerEvents: "none", zIndex: 10 }}
                  className="text-slate-400"
                >
                  <UserIcon className="h-4.5 w-4.5 text-slate-400" />
                </div>
                
                {/* Input con espaciado interno amplio */}
                <input
                  id="user-ident"
                  type="text"
                  autoComplete="username"
                  required
                  placeholder="ChainPoint o usuario@serving.com.co"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={{
                    paddingLeft: "3.25rem",
                    paddingRight: "1.25rem",
                    height: "3.25rem",
                    borderRadius: "16px",
                    backgroundColor: "#070b14",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    color: "#ffffff",
                    fontSize: "0.875rem",
                    width: "100%",
                  }}
                  className="placeholder:text-slate-500 transition-all duration-200 focus:border-[#11a542] focus:bg-[#070b14] focus:outline-none focus:ring-4 focus:ring-[#11a542]/15"
                />
              </div>
            </div>

            {/* Campo: Contraseña */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", width: "100%", textAlign: "left" }}>
              <label 
                htmlFor="password-ident"
                style={{ marginLeft: "0.25rem" }}
                className="text-xs font-medium tracking-wide text-slate-300"
              >
                Contraseña
              </label>
              
              <div style={{ position: "relative", display: "flex", alignItems: "center", width: "100%" }}>
                {/* Icono de candado */}
                <div 
                  style={{ position: "absolute", left: "1.1rem", display: "flex", alignItems: "center", pointerEvents: "none", zIndex: 10 }}
                  className="text-slate-400"
                >
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
                  style={{
                    paddingLeft: "3.25rem",
                    paddingRight: "3.25rem",
                    height: "3.25rem",
                    borderRadius: "16px",
                    backgroundColor: "#070b14",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    color: "#ffffff",
                    fontSize: "0.875rem",
                    width: "100%",
                  }}
                  className="placeholder:text-slate-500 transition-all duration-200 focus:border-[#11a542] focus:bg-[#070b14] focus:outline-none focus:ring-4 focus:ring-[#11a542]/15"
                />

                {/* Botón Ver/Ocultar con espacio independiente */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: "absolute", right: "0.85rem", padding: "0.5rem" }}
                  className="rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer flex items-center justify-center"
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
              style={{
                height: "3.25rem",
                borderRadius: "9999px",
                background: "linear-gradient(135deg, #015c32 0%, #11a542 100%)",
                boxShadow: "0 8px 25px -4px rgba(17, 165, 66, 0.45)",
                marginTop: "0.75rem",
                width: "100%",
                color: "#ffffff",
                fontWeight: 600,
                fontSize: "0.875rem",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.625rem",
                cursor: "pointer",
                transition: "all 300ms ease",
              }}
              className="active:scale-[0.98] hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
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
