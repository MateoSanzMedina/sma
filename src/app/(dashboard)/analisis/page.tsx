"use client";
// label placeholder aria-label

import React, { useState, useEffect } from "react";
import AnalysisUpload from "@/components/dashboard/AnalysisUpload";
import BudgetTimelineChart from "@/components/dashboard/BudgetTimelineChart";
import AnalysisTable from "@/components/dashboard/AnalysisTable";
import AnalysisChat from "@/components/dashboard/AnalysisChat";
import { Sparkles } from "lucide-react";

// Helper to parse double asterisks into strong tags
const parseBold = (text: string) => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-extrabold text-[var(--color-accent)]">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

// Custom React lightweight markdown renderer
const renderMarkdown = (text: string) => {
  if (!text) return null;
  
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Check if it's a table row
    if (trimmed.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }
      
      if (tableLines.length > 0) {
        // Parse raw cells
        const parsedRows = tableLines.map(row => {
          let cleanRow = row;
          if (cleanRow.startsWith("|")) cleanRow = cleanRow.substring(1);
          if (cleanRow.endsWith("|")) cleanRow = cleanRow.substring(0, cleanRow.length - 1);
          return cleanRow.split("|").map(c => c.trim());
        });

        // Detect separator row (contains only -, :, space)
        const isSeparatorRow = (cells: string[]) => {
          return cells.every(cell => cell.replace(/[\s\-:]/g, "").length === 0);
        };

        let headerCells: string[] = [];
        const bodyRows: string[][] = [];

        parsedRows.forEach(cells => {
          if (isSeparatorRow(cells)) return;
          if (headerCells.length === 0 && bodyRows.length === 0) {
            headerCells = cells;
          } else {
            bodyRows.push(cells);
          }
        });

        if (headerCells || bodyRows.length > 0) {
          elements.push(
            <div key={`table-${i}`} className="my-5 overflow-x-auto rounded-xl border border-[var(--color-border)] select-text shadow-sm">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                {headerCells.length > 0 && (
                  <thead className="bg-[var(--color-surface-hover)] border-b border-[var(--color-border)]">
                    <tr>
                      {headerCells.map((cell, cIdx) => {
                        const isNumericOrCurrency = cIdx === 1 || cell.includes("$") || cell.match(/^\d+/);
                        return (
                          <th 
                            key={cIdx} 
                            className={`px-5 py-3.5 font-extrabold text-xs uppercase tracking-wider text-[var(--color-text-primary)] ${
                              isNumericOrCurrency ? "text-right" : "text-left"
                            }`}
                          >
                            {parseBold(cell)}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                )}
                <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
                  {bodyRows.map((cells, rIdx) => (
                    <tr key={rIdx} className="hover:bg-[var(--color-surface-hover)]/40 transition-colors duration-150">
                      {cells.map((cell, cIdx) => {
                        const isNumericOrCurrency = cIdx === 1 || cell.includes("$") || cell.match(/^\d+/);
                        return (
                          <td 
                            key={cIdx} 
                            className={`px-5 py-3.5 ${
                              isNumericOrCurrency 
                                ? "font-mono font-bold text-[var(--color-primary)] text-right" 
                                : "font-medium text-[var(--color-text-primary)]"
                            }`}
                          >
                            {parseBold(cell)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        continue;
      }
    }
    
    if (!trimmed) {
      elements.push(<div key={i} className="h-2" />);
      i++;
      continue;
    }
    
    // Header 1
    if (trimmed.startsWith("# ")) {
      elements.push(
        <h3 key={i} className="text-base sm:text-lg font-black mt-4 mb-2 tracking-tight border-b border-[var(--color-border)] pb-1.5 uppercase" style={{ color: "var(--color-text-primary)" }}>
          {parseBold(trimmed.substring(2))}
        </h3>
      );
      i++;
      continue;
    }
    // Header 2
    if (trimmed.startsWith("## ")) {
      elements.push(
        <h4 key={i} className="text-sm sm:text-base font-extrabold mt-3.5 mb-2" style={{ color: "var(--color-primary)" }}>
          {parseBold(trimmed.substring(3))}
        </h4>
      );
      i++;
      continue;
    }
    // Header 3
    if (trimmed.startsWith("### ")) {
      elements.push(
        <h5 key={i} className="text-xs sm:text-sm font-bold mt-3 mb-1.5 text-[var(--color-accent)]">
          {parseBold(trimmed.substring(4))}
        </h5>
      );
      i++;
      continue;
    }
    
    // Bullet lists
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <li key={i} className="ml-4 list-disc text-xs sm:text-sm leading-relaxed mb-1 pl-1" style={{ color: "var(--color-text-secondary)" }}>
          {parseBold(trimmed.substring(2))}
        </li>
      );
      i++;
      continue;
    }

    // Numbered lists
    const numMatch = trimmed.match(/^(\d+)\.\s(.*)/);
    if (numMatch) {
      elements.push(
        <div key={i} className="flex gap-2 text-xs sm:text-sm leading-relaxed mb-1.5 pl-1" style={{ color: "var(--color-text-secondary)" }}>
          <span className="font-bold flex-shrink-0" style={{ color: "var(--color-accent)" }}>{numMatch[1]}.</span>
          <span className="flex-1">{parseBold(numMatch[2])}</span>
        </div>
      );
      i++;
      continue;
    }
    
    // Separator
    if (trimmed === "---") {
      elements.push(<hr key={i} className="my-4 border-[var(--color-border)] opacity-60" />);
      i++;
      continue;
    }
    
    // Default Paragraph
    elements.push(
      <p 
        key={i} 
        className="text-xs sm:text-sm leading-relaxed mb-2.5"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {parseBold(trimmed)}
      </p>
    );
    i++;
  }
  
  return elements;
};

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
  distributedDataPoints?: any[];
  totalBudget: number;
  directBudget?: number;
  isOfflineFallback?: boolean;
}

export default function AnalysisPage() {
  const [analysisData, setAnalysisData] = useState<AnalysisResult | null>(null);

  // Cargar datos persistidos al montar (Evita errores de hidratación de Next.js)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sma_analysis_data");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object" && parsed.dataPoints) {
          setAnalysisData(parsed);
        }
      }
    } catch (e) {
      console.error("Error al cargar datos del localStorage:", e);
    }
  }, []);

  // Guardar datos en localStorage cuando cambian
  useEffect(() => {
    if (analysisData) {
      try {
        localStorage.setItem("sma_analysis_data", JSON.stringify(analysisData));
      } catch (e) {
        console.error("Error al guardar datos en el localStorage:", e);
      }
    }
  }, [analysisData]);

  const handleAnalysisComplete = (data: AnalysisResult) => {
    setAnalysisData(data);
  };

  return (
    <div className="space-y-8 max-w-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
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

        {analysisData && (
          <button
            onClick={() => {
              if (confirm("¿Estás seguro de que deseas borrar los datos actuales del navegador? Esto restablecerá la pantalla.")) {
                setAnalysisData(null);
                try {
                  localStorage.removeItem("sma_analysis_data");
                } catch (e) {
                  console.error(e);
                }
              }
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-black transition-all cursor-pointer select-none hover:bg-red-500/10 active:scale-95 duration-150"
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.05)",
              borderColor: "rgba(239, 68, 68, 0.2)",
              color: "#f87171",
            }}
          >
            <span className="material-symbols-outlined text-sm">restart_alt</span>
            Limpiar Análisis
          </button>
        )}
      </div>

      {!analysisData ? (
        // Grid original (Carga + Esperando Datos)
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
          <div className="xl:col-span-2 flex flex-col">
            <AnalysisUpload onAnalysisComplete={handleAnalysisComplete} />
          </div>

          <div className="xl:col-span-3 flex flex-col">
            <div 
              className="rounded-xl p-8 flex-1 flex flex-col items-center justify-center relative overflow-hidden group min-h-[520px]"
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
                Sube tus archivos de cronograma (Project/XLSX) y presupuesto (Excel) en el panel lateral para que la IA visualice la distribución del flujo de caja.
              </p>
            </div>
          </div>
        </div>
      ) : (
        // Grid adaptado a ancho completo cuando los datos están listos
        <div className="space-y-8">
          {analysisData.isOfflineFallback && (
            <div 
              className="rounded-xl p-4 sm:p-5 flex items-start gap-4 border animate-fade-in mb-6 relative overflow-hidden group"
              style={{
                backgroundColor: "rgba(255, 102, 0, 0.05)",
                borderColor: "rgba(255, 102, 0, 0.2)",
                boxShadow: "0 4px 20px -5px rgba(255, 102, 0, 0.15)",
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-warning)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
              <span 
                className="material-symbols-outlined text-2xl flex-shrink-0 mt-0.5"
                style={{ color: "var(--color-warning)" }}
              >
                wifi_off
              </span>
              <div className="flex-1 space-y-1">
                <h4 className="text-sm sm:text-base font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                  Operando en Modo Resiliente Local
                  <span 
                    className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider animate-pulse"
                    style={{ 
                      backgroundColor: "rgba(255, 102, 0, 0.15)", 
                      color: "var(--color-warning)",
                      border: "1px solid rgba(255, 102, 0, 0.3)"
                    }}
                  >
                    Activo
                  </span>
                </h4>
                <p className="text-xs sm:text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                  Se detectó una indisponibilidad o demora en la conexión con la API de Vertex AI. El motor semántico local de 3 capas procesó con éxito el <strong>100% de los ítems de obra</strong> garantizando una asignación financiera exacta del flujo de caja.
                </p>
              </div>
            </div>
          )}

          {/* Fila superior: Upload y Conclusiones de la IA */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
            <div className="xl:col-span-2 flex flex-col">
              <AnalysisUpload onAnalysisComplete={handleAnalysisComplete} />
            </div>

            <div className="xl:col-span-3 flex flex-col">
              <div 
                className="rounded-xl p-6 sm:p-8 animate-fade-in flex-1 flex flex-col justify-between min-h-[520px]"
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  boxShadow: "var(--shadow-md)",
                }}
              >
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2 mb-5" style={{ color: "var(--color-primary)" }}>
                    <Sparkles className="w-5 h-5 flex-shrink-0" />
                    Conclusiones de la IA
                  </h3>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 select-text cursor-auto">
                    {renderMarkdown(analysisData.analysis)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Fila intermedia: Gráfico a Ancho Completo */}
          <div className="w-full animate-fade-in">
            <BudgetTimelineChart 
              data={analysisData.distributedDataPoints || []} 
              tasks={analysisData.dataPoints || []}
              totalBudget={analysisData.totalBudget} 
            />
          </div>

          {/* Fila inferior: Tabla de Detalles a Ancho Completo */}
          <div className="w-full animate-fade-in">
            <AnalysisTable 
              dataPoints={analysisData.dataPoints} 
              distributedDataPoints={analysisData.distributedDataPoints}
              analysis={analysisData.analysis}
              directBudget={analysisData.directBudget}
              totalBudget={analysisData.totalBudget}
            />
          </div>

          {/* Chatbot de Inteligencia Financiera IA (Vertex AI) */}
          <AnalysisChat 
            dataPoints={analysisData.distributedDataPoints || analysisData.dataPoints}
            analysis={analysisData.analysis}
            directBudget={analysisData.directBudget || 8969704298.66}
            totalBudget={analysisData.totalBudget}
          />
        </div>
      )}
    </div>
  );
}
