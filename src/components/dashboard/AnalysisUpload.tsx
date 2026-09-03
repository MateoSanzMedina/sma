"use client";

import React, { useState, useCallback } from "react";
import { UploadCloud, FileSpreadsheet, Loader2, CheckCircle } from "lucide-react";
import { DataPoint } from "@/lib/anticipoUtils";

export interface AnalysisResult {
  analysis: string;
  dataPoints: DataPoint[];
  totalBudget: number;
  directBudget?: number;
  isOfflineFallback?: boolean;
}

interface AnalysisUploadProps {
  onAnalysisComplete: (data: AnalysisResult) => void;
}

export default function AnalysisUpload({ onAnalysisComplete }: AnalysisUploadProps) {
  const [scheduleFile, setScheduleFile] = useState<File | null>(null);
  const [budgetFile, setBudgetFile] = useState<File | null>(null);
  const [prorateOrphans, setProrateOrphans] = useState(true);
  const [enableAnticipo, setEnableAnticipo] = useState(true);
  const [anticipoPercentage, setAnticipoPercentage] = useState(30);
  const [anticipoMonths, setAnticipoMonths] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, type: "schedule" | "budget") => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) {
        if (type === "schedule" && (file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || file.name.endsWith(".xlsx"))) {
          setScheduleFile(file);
        } else if (
          type === "budget" &&
          (file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
            file.name.endsWith(".xlsx"))
        ) {
          setBudgetFile(file);
        } else {
          setError(`Formato incorrecto para el archivo de ${type === "schedule" ? "cronograma (se requiere XLSX)" : "presupuesto (se requiere XLSX)"}.`);
        }
      }
    },
    []
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: "schedule" | "budget") => {
    const file = e.target.files?.[0];
    if (file) {
      if (type === "schedule") setScheduleFile(file);
      if (type === "budget") setBudgetFile(file);
    }
  };

  const handleSubmit = async () => {
    if (!scheduleFile || !budgetFile) {
      setError("Por favor sube ambos archivos antes de analizar.");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("schedule", scheduleFile);
    formData.append("budget", budgetFile);
    formData.append("prorateOrphans", String(prorateOrphans));
    formData.append("enableAnticipo", String(enableAnticipo));
    formData.append("anticipoPercentage", String(anticipoPercentage));
    formData.append("anticipoMonths", String(anticipoMonths));

    try {
      const response = await fetch("/api/analysis/process", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Ocurrió un error al procesar los archivos.");
      }

      onAnalysisComplete(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error al procesar los archivos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      style={{
        padding: "2rem",
        borderRadius: "24px",
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-sm)",
      }}
      className="animate-fade-in flex flex-col w-full"
    >
      <div className="flex flex-col">
        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-2" style={{ color: "var(--color-text-primary)" }}>
            Cargar Documentos de Proyecto
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            Sube el cronograma (XLSX exportado de MS Project) y el presupuesto de obra (XLSX) para correlacionarlos mediante IA.
          </p>

          {error && (
            <div 
              className="mt-4 p-4 rounded-xl text-sm border" 
              style={{ 
                backgroundColor: "rgba(239, 68, 68, 0.1)", 
                color: "var(--color-error)",
                borderColor: "rgba(239, 68, 68, 0.2)"
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6 min-h-[180px]">
          {/* Schedule Upload Dropzone */}
          <div
            className={`relative border border-dashed rounded-2xl p-6 text-center transition-all duration-300 flex flex-col justify-center items-center flex-1 min-h-[160px] ${
              scheduleFile 
                ? "bg-emerald-500/5 border-emerald-500" 
                : "border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-white/5"
            }`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleFileDrop(e, "schedule")}
          >
            {scheduleFile ? (
              <div className="flex flex-col items-center justify-center w-full">
                <CheckCircle className="w-10 h-10 mb-3 flex-shrink-0 text-[#11a542]" />
                <span className="font-bold mb-1 text-sm break-all text-slate-900 dark:text-white">{scheduleFile.name}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">Cronograma (XLSX)</span>
                <button 
                  onClick={() => setScheduleFile(null)} 
                  className="mt-4 text-xs font-bold text-rose-500 hover:underline cursor-pointer"
                >
                  Eliminar archivo
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center w-full">
                <div 
                  className="w-13 h-13 rounded-2xl flex items-center justify-center mb-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                >
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold mb-0.5 text-slate-900 dark:text-white">Cronograma de Obra</p>
                <p className="text-xs mb-4 text-slate-400">Formato .xlsx (Project)</p>
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => handleFileSelect(e, "schedule")}
                  className="hidden"
                  id="schedule-upload"
                />
                <label
                  htmlFor="schedule-upload"
                  style={{ borderRadius: "9999px" }}
                  className="inline-flex items-center justify-center px-6 py-2.5 text-xs font-bold cursor-pointer transition-all hover:scale-105 active:scale-95 whitespace-nowrap select-none border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white bg-slate-100 dark:bg-slate-800 shadow-sm"
                >
                  Seleccionar
                </label>
              </div>
            )}
          </div>

          {/* Budget Upload Dropzone */}
          <div
            className={`relative border border-dashed rounded-2xl p-6 text-center transition-all duration-300 flex flex-col justify-center items-center flex-1 min-h-[160px] ${
              budgetFile 
                ? "bg-emerald-500/5 border-emerald-500" 
                : "border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-white/5"
            }`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleFileDrop(e, "budget")}
          >
            {budgetFile ? (
              <div className="flex flex-col items-center justify-center w-full">
                <CheckCircle className="w-10 h-10 mb-3 flex-shrink-0 text-[#11a542]" />
                <span className="font-bold mb-1 text-sm break-all text-slate-900 dark:text-white">{budgetFile.name}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">Presupuesto (XLSX)</span>
                <button 
                  onClick={() => setBudgetFile(null)} 
                  className="mt-4 text-xs font-bold text-rose-500 hover:underline cursor-pointer"
                >
                  Eliminar archivo
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center w-full">
                <div 
                  className="w-13 h-13 rounded-2xl flex items-center justify-center mb-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                >
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold mb-0.5 text-slate-900 dark:text-white">Presupuesto de Obra</p>
                <p className="text-xs mb-4 text-slate-400">Formato .xlsx</p>
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => handleFileSelect(e, "budget")}
                  className="hidden"
                  id="budget-upload"
                />
                <label
                  htmlFor="budget-upload"
                  style={{ borderRadius: "9999px" }}
                  className="inline-flex items-center justify-center px-6 py-2.5 text-xs font-bold cursor-pointer transition-all hover:scale-105 active:scale-95 whitespace-nowrap select-none border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white bg-slate-100 dark:bg-slate-800 shadow-sm"
                >
                  Seleccionar
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Panel de Parámetros de Flujo Gerencial con Espaciado Generoso */}
        <div 
          style={{
            padding: "1.25rem 1.5rem",
            borderRadius: "18px",
          }}
          className="border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 flex flex-col gap-4 shadow-sm"
        >
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#11a542]">
            <span>⚙️ Parámetros de Flujo Gerencial (Dist. Costos Flujo)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Prorratear ítems sin asignar */}
            <div 
              style={{ padding: "0.85rem 1.15rem", borderRadius: "14px" }}
              className="flex items-center gap-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 select-none shadow-sm"
            >
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={prorateOrphans}
                  onChange={(e) => setProrateOrphans(e.target.checked)}
                  className="sr-only peer"
                  disabled={loading}
                />
                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-focus:ring-2 peer-focus:ring-[#11a542]/40 peer-checked:bg-[#11a542] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full shadow-inner"></div>
              </label>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold leading-tight text-slate-900 dark:text-white">
                  Prorratear ítems sin asignar
                </span>
                <span className="text-[11px] leading-tight mt-0.5 text-slate-500 dark:text-slate-400">
                  Reasociar huérfanos entre las tareas del capítulo
                </span>
              </div>
            </div>

            {/* Distribución de Anticipo */}
            <div 
              style={{ padding: "0.85rem 1.15rem", borderRadius: "14px" }}
              className="flex items-center gap-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 select-none shadow-sm"
            >
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={enableAnticipo}
                  onChange={(e) => setEnableAnticipo(e.target.checked)}
                  className="sr-only peer"
                  disabled={loading}
                />
                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-focus:ring-2 peer-focus:ring-[#11a542]/40 peer-checked:bg-[#11a542] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full shadow-inner"></div>
              </label>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold leading-tight text-slate-900 dark:text-white">
                  Desembolso de Anticipo ({anticipoPercentage}% / {100 - anticipoPercentage}%)
                </span>
                <span className="text-[11px] leading-tight mt-0.5 text-slate-500 dark:text-slate-400">
                  Anticipar insumos N meses antes de la tarea
                </span>
              </div>
            </div>
          </div>

          {/* Opciones adicionales cuando el anticipo está activo */}
          {enableAnticipo && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
              <div>
                <label className="block text-[11px] font-bold mb-1.5 text-slate-600 dark:text-slate-400">
                  Porcentaje de Anticipo Inicial:
                </label>
                <select
                  value={anticipoPercentage}
                  onChange={(e) => setAnticipoPercentage(Number(e.target.value))}
                  disabled={loading}
                  style={{ height: "2.75rem", borderRadius: "12px", padding: "0 0.75rem" }}
                  className="w-full text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#11a542]/20"
                >
                  <option value={30}>30% Anticipo / 70% Ejecución (Estándar)</option>
                  <option value={20}>20% Anticipo / 80% Ejecución</option>
                  <option value={40}>40% Anticipo / 60% Ejecución</option>
                  <option value={50}>50% Anticipo / 50% Ejecución</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold mb-1.5 text-slate-600 dark:text-slate-400">
                  ¿Cuántos meses antes se desembolsa?
                </label>
                <select
                  value={anticipoMonths}
                  onChange={(e) => setAnticipoMonths(Number(e.target.value))}
                  disabled={loading}
                  style={{ height: "2.75rem", borderRadius: "12px", padding: "0 0.75rem" }}
                  className="w-full text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#11a542]/20"
                >
                  <option value={1}>1 Mes de anticipación (30 días antes)</option>
                  <option value={2}>2 Meses de anticipación (60 días antes)</option>
                  <option value={3}>3 Meses de anticipación (90 días antes)</option>
                  <option value={4}>4 Meses de anticipación (120 días antes)</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Botón de Acción con Margen y Espacio Completo */}
      <div 
        style={{
          marginTop: "1.5rem",
          paddingTop: "1.5rem",
          borderTop: "1px solid var(--color-border)",
        }}
        className="flex justify-end"
      >
        <button
          onClick={handleSubmit}
          disabled={!scheduleFile || !budgetFile || loading}
          style={{
            borderRadius: "9999px",
            padding: "0.85rem 2.25rem",
            height: "3.25rem",
            background: (!scheduleFile || !budgetFile || loading) 
              ? undefined 
              : "linear-gradient(135deg, #015c32 0%, #11a542 100%)",
            boxShadow: (!scheduleFile || !budgetFile || loading)
              ? undefined
              : "0 6px 20px rgba(17, 165, 66, 0.35)",
          }}
          className={`w-full sm:w-auto inline-flex items-center justify-center font-bold text-sm text-white transition-all cursor-pointer border-none ${
            (!scheduleFile || !budgetFile || loading)
              ? "bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed opacity-60"
              : "hover:scale-[1.02] active:scale-[0.98]"
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2.5 animate-spin flex-shrink-0" />
              <span>Analizando con IA...</span>
            </>
          ) : (
            <>
              <UploadCloud className="w-5 h-5 mr-2.5 flex-shrink-0" />
              <span>Correlacionar Proyecto</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
