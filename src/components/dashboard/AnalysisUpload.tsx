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
        if (type === "schedule" && (file.type === "text/csv" || file.name.endsWith(".csv"))) {
          setScheduleFile(file);
        } else if (
          type === "budget" &&
          (file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
            file.name.endsWith(".xlsx"))
        ) {
          setBudgetFile(file);
        } else {
          setError(`Formato incorrecto para el archivo de ${type === "schedule" ? "cronograma (se requiere CSV)" : "presupuesto (se requiere XLSX)"}.`);
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
    <div className="glass-card p-8">
      <h2 className="text-2xl font-semibold mb-2 text-white">Cargar Documentos de Proyecto</h2>
      <p className="text-sm text-gray-400 mb-8">
        Sube el cronograma (CSV exportado de MS Project) y el presupuesto de obra (XLSX) para correlacionarlos mediante IA.
      </p>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 text-red-400 rounded-lg text-sm border border-red-500/20">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Schedule Upload Dropzone */}
        <div
          className={`relative border border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
            scheduleFile 
              ? "border-primary bg-primary/5" 
              : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-black/40"
          }`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleFileDrop(e, "schedule")}
        >
          {scheduleFile ? (
            <div className="flex flex-col items-center">
              <CheckCircle className="w-10 h-10 text-primary mb-3" />
              <span className="font-medium text-white mb-1">{scheduleFile.name}</span>
              <span className="text-xs text-gray-400">Cronograma (CSV)</span>
              <button onClick={() => setScheduleFile(null)} className="mt-4 text-xs text-red-400 hover:text-red-300 transition-colors">Eliminar archivo</button>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-white mb-1">Cronograma de Obra (.csv)</p>
              <p className="text-xs text-gray-500 mb-6">Arrastra aquí o haz clic para explorar</p>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => handleFileSelect(e, "schedule")}
                className="hidden"
                id="schedule-upload"
              />
              <label
                htmlFor="schedule-upload"
                className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm font-medium text-white cursor-pointer hover:bg-white/10 transition-colors"
              >
                Seleccionar CSV
              </label>
            </div>
          )}
        </div>

        {/* Budget Upload Dropzone */}
        <div
          className={`relative border border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
            budgetFile 
              ? "border-warning bg-warning/5" 
              : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-black/40"
          }`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleFileDrop(e, "budget")}
        >
          {budgetFile ? (
            <div className="flex flex-col items-center">
              <CheckCircle className="w-10 h-10 text-warning mb-3" />
              <span className="font-medium text-white mb-1">{budgetFile.name}</span>
              <span className="text-xs text-gray-400">Presupuesto (XLSX)</span>
              <button onClick={() => setBudgetFile(null)} className="mt-4 text-xs text-red-400 hover:text-red-300 transition-colors">Eliminar archivo</button>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <FileSpreadsheet className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-white mb-1">Presupuesto (.xlsx)</p>
              <p className="text-xs text-gray-500 mb-6">Arrastra aquí o haz clic para explorar</p>
              <input
                type="file"
                accept=".xlsx"
                onChange={(e) => handleFileSelect(e, "budget")}
                className="hidden"
                id="budget-upload"
              />
              <label
                htmlFor="budget-upload"
                className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm font-medium text-white cursor-pointer hover:bg-white/10 transition-colors"
              >
                Seleccionar Excel
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-white/5">
        <button
          onClick={handleSubmit}
          disabled={!scheduleFile || !budgetFile || loading}
          className="flex items-center px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 mr-3 animate-spin" />
              Analizando con Gemini AI...
            </>
          ) : (
            <>
              <UploadCloud className="w-5 h-5 mr-3" />
              Generar Correlación Financiera
            </>
          )}
        </button>
      </div>
    </div>
  );
}
