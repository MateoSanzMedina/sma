"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { resilientFetch } from "@/lib/apiConfig";
import { ShieldCheck, ShieldAlert, KeyRound, Copy, Check, QrCode, AlertCircle, Loader2 } from "lucide-react";

export function TwoFactorSetupCard() {
  const { user, token, refreshUser } = useAuth();
  const [step, setStep] = useState<"idle" | "setup" | "disabling">("idle");
  const [secret, setSecret] = useState<string>("");
  const [otpauthUrl, setOtpauthUrl] = useState<string>("");
  const [verifyCode, setVerifyCode] = useState<string>("");
  const [disablePassword, setDisablePassword] = useState<string>("");
  const [disableCode, setDisableCode] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isEnabled = Boolean(user?.totp_enabled);

  // Iniciar configuración de 2FA
  const handleStartSetup = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await resilientFetch("/api/v1/auth/2fa/setup", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      if (res.ok && data.secret) {
        setSecret(data.secret);
        setOtpauthUrl(data.otpauth_url);
        setStep("setup");
      } else {
        setError(data.detail || "No se pudo generar la clave de autenticación.");
      }
    } catch {
      setError("Error de conexión al generar la clave 2FA.");
    } finally {
      setLoading(false);
    }
  };

  // Confirmar y habilitar 2FA
  const handleEnable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyCode.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await resilientFetch("/api/v1/auth/2fa/enable", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: verifyCode.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg("¡2FA activado con éxito! A partir de tu próximo inicio de sesión se solicitará el código.");
        setStep("idle");
        setVerifyCode("");
        await refreshUser();
      } else {
        setError(data.detail || "Código incorrecto o expirado. Verifica la hora de tu celular.");
      }
    } catch {
      setError("Error de conexión al activar 2FA.");
    } finally {
      setLoading(false);
    }
  };

  // Desactivar 2FA
  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disablePassword || !disableCode) return;

    setLoading(true);
    setError(null);
    try {
      const res = await resilientFetch("/api/v1/auth/2fa/disable", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: disablePassword,
          code: disableCode.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg("Autenticación en dos pasos desactivada.");
        setStep("idle");
        setDisablePassword("");
        setDisableCode("");
        await refreshUser();
      } else {
        setError(data.detail || "Contraseña o código 2FA incorrectos.");
      }
    } catch {
      setError("Error de conexión al desactivar 2FA.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopySecret = () => {
    if (!secret) return;
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const qrImageUrl = otpauthUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(otpauthUrl)}`
    : "";

  return (
    <div
      style={{ padding: "1.75rem", borderRadius: "20px" }}
      className="border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-5"
    >
      {/* Encabezado */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {isEnabled ? (
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-amber-500" />
            )}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Autenticación en Dos Pasos (2FA / TOTP)
              {isEnabled && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  ACTIVO
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Protege tu cuenta con Google Authenticator, Microsoft Authenticator o Authy.
            </p>
          </div>
        </div>
      </div>

      {/* Alertas */}
      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          {successMsg}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-600 dark:text-rose-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Estado: INACTIVO (Vista Principal) */}
      {!isEnabled && step === "idle" && (
        <div className="flex flex-col gap-4">
          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/15 text-xs text-slate-600 dark:text-slate-300 flex flex-col gap-1.5">
            <p className="font-bold text-amber-600 dark:text-amber-400">
              Tu cuenta actualmente solo requiere contraseña para acceder.
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Activar la autenticación de dos factores (RFC 6238 TOTP) añade una capa obligatoria de defensa contra filtración de credenciales. Cada vez que inicies sesión deberás ingresar el código temporal generado en tu teléfono móvil.
            </p>
          </div>

          <button
            onClick={handleStartSetup}
            disabled={loading}
            style={{ borderRadius: "9999px" }}
            className="self-start px-5 py-2.5 bg-gradient-to-r from-[#015c32] to-[#11a542] hover:opacity-90 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-600/20"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            <span>Activar Verificación en Dos Pasos</span>
          </button>
        </div>
      )}

      {/* Estado: CONFIGURANDO 2FA (Paso a Paso con QR) */}
      {!isEnabled && step === "setup" && (
        <div className="flex flex-col gap-5">
          <div className="text-xs text-slate-600 dark:text-slate-300 flex flex-col gap-3">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <span className="h-5 w-5 rounded-full bg-[#11a542] text-white flex items-center justify-center text-[10px]">1</span>
              <span>Escanea este código QR con tu aplicación de autenticación:</span>
            </div>

            {/* QR Code Container */}
            <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800">
              {qrImageUrl && (
                <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrImageUrl}
                    alt="Código QR para 2FA"
                    width={160}
                    height={160}
                    className="block rounded-lg"
                  />
                </div>
              )}

              <div className="flex flex-col gap-2.5 max-w-sm">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Abre <strong>Google Authenticator</strong> o <strong>Microsoft Authenticator</strong> en tu celular y escanea el código. Si no puedes escanearlo, ingresa esta clave secreta manualmente:
                </p>

                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <code className="text-xs font-mono font-bold text-[#11a542] select-all tracking-wider">
                    {secret}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopySecret}
                    className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors ml-auto"
                    title="Copiar Clave Secreta"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white mt-2">
              <span className="h-5 w-5 rounded-full bg-[#11a542] text-white flex items-center justify-center text-[10px]">2</span>
              <span>Ingresa el código de 6 dígitos que aparece en tu app:</span>
            </div>

            <form onSubmit={handleEnable2FA} className="flex flex-col sm:flex-row gap-3 items-center max-w-md">
              <input
                type="text"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="w-full sm:w-44 text-center tracking-[0.3em] font-mono text-lg font-bold py-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#11a542]"
                autoFocus
              />

              <button
                type="submit"
                disabled={loading || verifyCode.length < 6}
                style={{ borderRadius: "9999px" }}
                className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-[#015c32] to-[#11a542] hover:opacity-90 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-600/20"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                <span>Verificar y Activar</span>
              </button>

              <button
                type="button"
                onClick={() => { setStep("idle"); setError(null); }}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline underline-offset-4 cursor-pointer"
              >
                Cancelar
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Estado: ACTIVO (Vista Principal) */}
      {isEnabled && step === "idle" && (
        <div className="flex flex-col gap-4">
          <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15 text-xs text-slate-600 dark:text-slate-300 flex flex-col gap-1.5">
            <p className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <Check className="h-4 w-4" />
              Tu cuenta está plenamente protegida con 2FA.
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Cada inicio de sesión en SMA validará tu contraseña más el código de 6 dígitos emitido por tu aplicación autenticadora.
            </p>
          </div>

          <button
            onClick={() => { setStep("disabling"); setError(null); }}
            className="self-start text-xs font-semibold text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 underline underline-offset-4 cursor-pointer"
          >
            Desactivar Autenticación en Dos Pasos
          </button>
        </div>
      )}

      {/* Estado: DESACTIVAR 2FA */}
      {isEnabled && step === "disabling" && (
        <form onSubmit={handleDisable2FA} className="flex flex-col gap-3 p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 max-w-lg">
          <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
            Confirmar Desactivación de 2FA
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Por seguridad, ingresa tu contraseña actual y un código vigente de tu app autenticadora.
          </p>

          <div className="flex flex-col gap-2">
            <input
              type="password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              placeholder="Contraseña actual"
              className="py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
            />
            <input
              type="text"
              maxLength={6}
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
              placeholder="Código de 6 dígitos"
              className="py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white font-mono"
            />
          </div>

          <div className="flex items-center gap-2 mt-1">
            <button
              type="submit"
              disabled={loading || !disablePassword || disableCode.length < 6}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
            >
              {loading ? "Verificando..." : "Desactivar 2FA"}
            </button>
            <button
              type="button"
              onClick={() => { setStep("idle"); setError(null); }}
              className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
