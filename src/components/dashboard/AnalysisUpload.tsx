"use client";

import React, { useState, useCallback } from "react";
import { UploadCloud, FileSpreadsheet, Loader2, CheckCircle } from "lucide-react";

interface AnalysisDataPoint {
  date: string;
  budget_required: number;
  task_name: string;
  chapter?: string;
  process_name?: string;
}

interface AnalysisResult {
  analysis: string;
  dataPoints: AnalysisDataPoint[];
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
      className="rounded-xl p-6 sm:p-8 animate-fade-in flex-1 flex flex-col min-h-[520px]"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <div className="flex-grow flex flex-col">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold mb-2" style={{ color: "var(--color-text-primary)" }}>
            Cargar Documentos de Proyecto
          </h2>
          <p className="text-sm mb-6" style={{ color: "var(--color-text-secondary)" }}>
            Sube el cronograma (XLSX exportado de MS Project) y el presupuesto de obra (XLSX) para correlacionarlos mediante IA.
          </p>

          {error && (
            <div 
              className="mb-6 p-4 rounded-lg text-sm border" 
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6 flex-1 min-h-[200px]">
          {/* Schedule Upload Dropzone */}
          <div
            className={`relative border border-dashed rounded-xl p-6 text-center transition-all duration-300 flex flex-col justify-center items-center flex-1 h-full min-h-[160px] ${
              scheduleFile 
                ? "bg-primary/5" 
                : "hover:bg-white/5"
            }`}
            style={{
              borderColor: scheduleFile ? "var(--color-primary)" : "var(--color-border)",
              backgroundColor: scheduleFile ? "var(--color-primary-light)" : "transparent"
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleFileDrop(e, "schedule")}
          >
            {scheduleFile ? (
              <div className="flex flex-col items-center justify-center flex-grow w-full h-full">
                <CheckCircle className="w-10 h-10 mb-3 flex-shrink-0" style={{ color: "var(--color-primary)" }} />
                <span className="font-semibold mb-1 text-sm break-all" style={{ color: "var(--color-text-primary)" }}>{scheduleFile.name}</span>
                <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>Cronograma (XLSX)</span>
                <button 
                  onClick={() => setScheduleFile(null)} 
                  className="mt-5 text-xs font-black hover:underline transition-colors cursor-pointer"
                  style={{ color: "var(--color-error)" }}
                >
                  Eliminar archivo
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center flex-grow w-full h-full">
                <div 
                  className="w-14 h-14 rounded-full flex items-center justify-center mb-4 flex-shrink-0"
                  style={{ backgroundColor: "var(--color-surface-hover)" }}
                >
                  <FileSpreadsheet className="w-7 h-7" style={{ color: "var(--color-text-tertiary)" }} />
                </div>
                <p className="text-sm font-bold mb-1" style={{ color: "var(--color-text-primary)" }}>Cronograma de Obra</p>
                <p className="text-xs mb-5" style={{ color: "var(--color-text-tertiary)" }}>Formato .xlsx</p>
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => handleFileSelect(e, "schedule")}
                  className="hidden"
                  id="schedule-upload"
                />
                <label
                  htmlFor="schedule-upload"
                  className="inline-flex items-center justify-center px-10 py-3 rounded-full text-xs font-black min-w-[140px] cursor-pointer transition-all hover:scale-105 active:scale-95 whitespace-nowrap select-none border border-[var(--color-border)] text-[var(--color-text-primary)] bg-[var(--color-surface-hover)] shadow-sm"
                >
                  Seleccionar
                </label>
              </div>
            )}
          </div>

          {/* Budget Upload Dropzone */}
          <div
            className={`relative border border-dashed rounded-xl p-6 text-center transition-all duration-300 flex flex-col justify-center items-center flex-1 h-full min-h-[160px] ${
              budgetFile 
                ? "bg-warning/5" 
                : "hover:bg-white/5"
            }`}
            style={{
              borderColor: budgetFile ? "var(--color-warning)" : "var(--color-border)",
              backgroundColor: budgetFile ? "rgba(255, 102, 0, 0.05)" : "transparent"
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleFileDrop(e, "budget")}
          >
            {budgetFile ? (
              <div className="flex flex-col items-center justify-center flex-grow w-full h-full">
                <CheckCircle className="w-10 h-10 mb-3 flex-shrink-0" style={{ color: "var(--color-warning)" }} />
                <span className="font-semibold mb-1 text-sm break-all" style={{ color: "var(--color-text-primary)" }}>{budgetFile.name}</span>
                <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>Presupuesto (XLSX)</span>
                <button 
                  onClick={() => setBudgetFile(null)} 
                  className="mt-5 text-xs font-black hover:underline transition-colors cursor-pointer"
                  style={{ color: "var(--color-error)" }}
                >
                  Eliminar archivo
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center flex-grow w-full h-full">
                <div 
                  className="w-14 h-14 rounded-full flex items-center justify-center mb-4 flex-shrink-0"
                  style={{ backgroundColor: "var(--color-surface-hover)" }}
                >
                  <FileSpreadsheet className="w-7 h-7" style={{ color: "var(--color-text-tertiary)" }} />
                </div>
                <p className="text-sm font-bold mb-1" style={{ color: "var(--color-text-primary)" }}>Presupuesto de Obra</p>
                <p className="text-xs mb-5" style={{ color: "var(--color-text-tertiary)" }}>Formato .xlsx</p>
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => handleFileSelect(e, "budget")}
                  className="hidden"
                  id="budget-upload"
                />
                <label
                  htmlFor="budget-upload"
                  className="inline-flex items-center justify-center px-10 py-3 rounded-full text-xs font-black min-w-[140px] cursor-pointer transition-all hover:scale-105 active:scale-95 whitespace-nowrap select-none border border-[var(--color-border)] text-[var(--color-text-primary)] bg-[var(--color-surface-hover)] shadow-sm"
                >
                  Seleccionar
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Panel de Parámetros de Flujo Gerencial */}
        <div 
          className="p-4 rounded-xl mb-6 border bg-[var(--color-surface-hover)]/30 flex flex-col gap-3"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div className="text-xs font-black uppercase tracking-wider text-[var(--color-primary)]">
            ⚙️ PARÁMETROS DE FLUJO GERENCIAL (DOCUMENTO DIST. COSTOS FLUJO)
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Prorratear ítems sin asignar */}
            <div className="flex items-center gap-3 select-none">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={prorateOrphans}
                  onChange={(e) => setProrateOrphans(e.target.checked)}
                  className="sr-only peer"
                  disabled={loading}
                />
                <div className="w-10 h-5 bg-white/10 rounded-full peer peer-focus:ring-2 peer-focus:ring-[var(--color-primary)]/50 peer-checked:bg-[var(--color-primary)] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold" style={{ color: "var(--color-text-primary)" }}>
                  Prorratear ítems sin asignar
                </span>
                <span className="text-[10px]" style={{ color: "var(--color-text-secondary)" }}>
                  Reasociar huérfanos entre las tareas del capítulo
                </span>
              </div>
            </div>

            {/* Distribución de Anticipo 30% / 70% */}
            <div className="flex items-center gap-3 select-none">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableAnticipo}
                  onChange={(e) => setEnableAnticipo(e.target.checked)}
                  className="sr-only peer"
                  disabled={loading}
                />
                <div className="w-10 h-5 bg-white/10 rounded-full peer peer-focus:ring-2 peer-focus:ring-[var(--color-primary)]/50 peer-checked:bg-[var(--color-primary)] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold" style={{ color: "var(--color-text-primary)" }}>
                  Desembolso de Anticipo ({anticipoPercentage}% / {100 - anticipoPercentage}%)
                </span>
                <span className="text-[10px]" style={{ color: "var(--color-text-secondary)" }}>
                  Anticipar insumos N meses antes de la tarea
                </span>
              </div>
            </div>
          </div>

          {/* Opciones adicionales cuando el anticipo está activo */}
          {enableAnticipo && (
            <div className="mt-2 pt-3 border-t grid grid-cols-1 sm:grid-cols-2 gap-4 select-none animate-fade-in" style={{ borderColor: "var(--color-border)" }}>
              <div>
                <label className="block text-[11px] font-bold mb-1" style={{ color: "var(--color-text-secondary)" }}>
                  Porcentaje de Anticipo Inicial:
                </label>
                <select
                  value={anticipoPercentage}
                  onChange={(e) => setAnticipoPercentage(Number(e.target.value))}
                  disabled={loading}
                  className="w-full text-xs font-bold p-2 rounded-lg border bg-[var(--color-surface)] text-[var(--color-text-primary)] cursor-pointer"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <option value={30}>30% Anticipo / 70% Ejecución (Estándar % Flujo)</option>
                  <option value={20}>20% Anticipo / 80% Ejecución</option>
                  <option value={40}>40% Anticipo / 60% Ejecución</option>
                  <option value={50}>50% Anticipo / 50% Ejecución</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold mb-1" style={{ color: "var(--color-text-secondary)" }}>
                  ¿Cuántos meses antes se desembolsa el anticipo?
                </label>
                <select
                  value={anticipoMonths}
                  onChange={(e) => setAnticipoMonths(Number(e.target.value))}
                  disabled={loading}
                  className="w-full text-xs font-bold p-2 rounded-lg border bg-[var(--color-surface)] text-[var(--color-text-primary)] cursor-pointer"
                  style={{ borderColor: "var(--color-border)" }}
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

      <div className="flex flex-col sm:flex-row justify-end items-stretch sm:items-center pt-6 border-t mt-auto gap-4" style={{ borderColor: "var(--color-border)" }}>
        <button
          onClick={handleSubmit}
          disabled={!scheduleFile || !budgetFile || loading}
          className="w-full sm:w-auto flex items-center justify-center px-12 py-4 rounded-full font-black text-sm shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed whitespace-nowrap select-none cursor-pointer"
          style={{ 
            backgroundColor: "var(--color-primary)",
            color: "white",
            boxShadow: "0 10px 20px -5px rgba(1, 92, 50, 0.4)"
          }}
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 mr-3 animate-spin flex-shrink-0" />
              Analizando...
            </>
          ) : (
            <>
              <UploadCloud className="w-5 h-5 mr-3 flex-shrink-0" />
              Correlacionar Proyecto
            </>
          )}
        </button>
      </div>
    </div>
  );
}
