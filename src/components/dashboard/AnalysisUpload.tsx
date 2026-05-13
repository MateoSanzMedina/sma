"use client";

import React, { useState, useCallback } from "react";
import { UploadCloud, FileSpreadsheet, FileText, Loader2, CheckCircle } from "lucide-react";

interface AnalysisUploadProps {
  onAnalysisComplete: (data: any) => void;
}

export default function AnalysisUpload({ onAnalysisComplete }: AnalysisUploadProps) {
  const [scheduleFile, setScheduleFile] = useState<File | null>(null);
  const [budgetFile, setBudgetFile] = useState<File | null>(null);
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="rounded-xl p-6 sm:p-8 animate-fade-in"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <h2 className="text-xl sm:text-2xl font-bold mb-2" style={{ color: "var(--color-text-primary)" }}>
        Cargar Documentos de Proyecto
      </h2>
      <p className="text-sm mb-8" style={{ color: "var(--color-text-secondary)" }}>
        Sube el cronograma (XLSX exportado de MS Project) y el presupuesto de obra (XLSX) para correlacionarlos mediante IA.
      </p>

      {error && (
        <div 
          className="mb-8 p-4 rounded-lg text-sm border" 
          style={{ 
            backgroundColor: "rgba(239, 68, 68, 0.1)", 
            color: "var(--color-error)",
            borderColor: "rgba(239, 68, 68, 0.2)"
          }}
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
        {/* Schedule Upload Dropzone */}
        <div
          className={`relative border border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
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
            <div className="flex flex-col items-center">
              <CheckCircle className="w-10 h-10 mb-3" style={{ color: "var(--color-primary)" }} />
              <span className="font-semibold mb-1 text-sm break-all" style={{ color: "var(--color-text-primary)" }}>{scheduleFile.name}</span>
              <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>Cronograma (XLSX)</span>
              <button 
                onClick={() => setScheduleFile(null)} 
                className="mt-5 text-xs font-medium hover:underline transition-colors"
                style={{ color: "var(--color-error)" }}
              >
                Eliminar archivo
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div 
                className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
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
                className="px-6 py-2.5 rounded-lg text-sm font-bold cursor-pointer transition-all hover:scale-105 active:scale-95"
                style={{ 
                  backgroundColor: "var(--color-surface-hover)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-primary)"
                }}
              >
                Seleccionar
              </label>
            </div>
          )}
        </div>

        {/* Budget Upload Dropzone */}
        <div
          className={`relative border border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
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
            <div className="flex flex-col items-center">
              <CheckCircle className="w-10 h-10 mb-3" style={{ color: "var(--color-warning)" }} />
              <span className="font-semibold mb-1 text-sm break-all" style={{ color: "var(--color-text-primary)" }}>{budgetFile.name}</span>
              <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>Presupuesto (XLSX)</span>
              <button 
                onClick={() => setBudgetFile(null)} 
                className="mt-5 text-xs font-medium hover:underline transition-colors"
                style={{ color: "var(--color-error)" }}
              >
                Eliminar archivo
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div 
                className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
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
                className="px-6 py-2.5 rounded-lg text-sm font-bold cursor-pointer transition-all hover:scale-105 active:scale-95"
                style={{ 
                  backgroundColor: "var(--color-surface-hover)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-primary)"
                }}
              >
                Seleccionar
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-6 border-t" style={{ borderColor: "var(--color-border)" }}>
        <button
          onClick={handleSubmit}
          disabled={!scheduleFile || !budgetFile || loading}
          className="flex items-center px-8 py-3 rounded-xl font-bold shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed"
          style={{ 
            backgroundColor: "var(--color-primary)",
            color: "white",
            boxShadow: "0 10px 20px -5px rgba(1, 92, 50, 0.4)"
          }}
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 mr-3 animate-spin" />
              Analizando...
            </>
          ) : (
            <>
              <UploadCloud className="w-5 h-5 mr-3" />
              Correlacionar Proyecto
            </>
          )}
        </button>
      </div>
    </div>
  );
}
