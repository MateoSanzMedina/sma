"use client";

import React, { useState } from "react";
import AnalysisUpload from "@/components/dashboard/AnalysisUpload";
import BudgetTimelineChart from "@/components/dashboard/BudgetTimelineChart";
import { Sparkles, FileText } from "lucide-react";

export default function AnalysisPage() {
  const [analysisData, setAnalysisData] = useState<any | null>(null);

  const handleAnalysisComplete = (data: any) => {
    setAnalysisData(data);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl sm:text-4xl font-black flex items-center gap-4 tracking-tight">
            <span 
              className="material-symbols-outlined text-4xl flex-shrink-0"
              style={{ color: "var(--color-primary)" }}
            >
              analytics
            </span>
            <span style={{ color: "var(--color-text-primary)" }}>Análisis de Proyectos (IA)</span>
          </h1>
          <p className="text-base mt-2 max-w-2xl leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            Correlaciona presupuestos con cronogramas automáticamente utilizando inteligencia artificial.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
        <div className="xl:col-span-2 space-y-6">
          <AnalysisUpload onAnalysisComplete={handleAnalysisComplete} />
          
          {analysisData && (
            <div 
              className="rounded-xl p-6 sm:p-8 animate-fade-in"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                boxShadow: "var(--shadow-md)",
              }}
            >
              <h3 className="text-lg font-bold flex items-center gap-2 mb-5" style={{ color: "var(--color-primary)" }}>
                <Sparkles className="w-5 h-5 flex-shrink-0" />
                Conclusiones de la IA
              </h3>
              <div className="space-y-4">
                {analysisData.analysis.split("\n").map((paragraph: string, i: number) => (
                  paragraph.trim() && (
                    <p 
                      key={i} 
                      className="text-sm leading-relaxed select-text cursor-auto"
                      style={{ color: "var(--color-text-primary)", opacity: 0.9 }}
                    >
                      {paragraph}
                    </p>
                  )
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="xl:col-span-3">
          {analysisData ? (
            <div className="h-full animate-fade-in">
              <BudgetTimelineChart 
                data={analysisData.dataPoints} 
                totalBudget={analysisData.totalBudget} 
              />
            </div>
          ) : (
            <div 
              className="rounded-xl p-8 h-full min-h-[400px] flex flex-col items-center justify-center relative overflow-hidden group"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-accent)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
              <div className="w-24 h-24 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(0,0,0,0.5)] transform group-hover:scale-105 transition-transform duration-500 relative">
                <div className="absolute inset-0 bg-[var(--color-accent)]/10 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <span className="material-symbols-outlined text-[var(--color-text-tertiary)] group-hover:text-[var(--color-accent)] text-5xl transition-colors duration-500 relative z-10">
                  insights
                </span>
              </div>
              <h3 className="text-2xl font-bold text-[var(--color-text-primary)] mb-3 tracking-tight">Esperando Datos</h3>
              <p className="text-[var(--color-text-secondary)] max-w-md text-center text-sm leading-relaxed">
                Sube tus archivos de cronograma (Project/CSV) y presupuesto (Excel) en el panel lateral para que la IA visualice la distribución del flujo de caja.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
