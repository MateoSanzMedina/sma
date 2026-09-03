"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useMemo } from "react";
import { Search, Download, ChevronLeft, ChevronRight } from "lucide-react";

interface DataPoint {
  date: string;
  start_date?: string;
  end_date?: string;
  working_days?: number;
  budget_required: number;
  daily_budget?: number;
  task_name: string;
  chapter?: string;
  process_name?: string;
  budget_item_code?: string;
  budget_item_desc?: string;
}

interface NormalizedDataPoint {
  date: string;
  start_date: string;
  end_date: string;
  working_days: number;
  budget_required: number;
  daily_budget: number;
  task_name: string;
  chapter: string;
  budget_item_code?: string;
  budget_item_desc?: string;
}

interface AnalysisTableProps {
  dataPoints: DataPoint[];
  distributedDataPoints?: any[];
  analysis?: string;
  directBudget?: number;
  totalBudget?: number;
}

export default function AnalysisTable({ dataPoints, distributedDataPoints, analysis, directBudget, totalBudget }: AnalysisTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedChapter, setSelectedChapter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortField, setSortField] = useState<"date" | "budget_required" | "task_name" | "chapter">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Normalizar los datos de entrada garantizando que chapter no sea undefined
  const normalizedDataPoints = useMemo<NormalizedDataPoint[]>(() => {
    return dataPoints.map((dp) => {
      const sDate = dp.start_date || dp.date || "";
      const eDate = dp.end_date || sDate || "";
      const days = dp.working_days || 0;
      const daily = dp.daily_budget || (days > 0 ? dp.budget_required / days : 0);

      return {
        date: sDate,
        start_date: sDate,
        end_date: eDate,
        working_days: days,
        budget_required: dp.budget_required,
        daily_budget: daily,
        task_name: dp.task_name,
        chapter: dp.chapter || dp.process_name || "Otros",
        budget_item_code: dp.budget_item_code || "",
        budget_item_desc: dp.budget_item_desc || dp.task_name || "",
      };
    });
  }, [dataPoints]);

  // Formatear moneda a pesos (COP)
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Obtener capítulos únicos
  const chapters = useMemo(() => {
    const set = new Set<string>();
    normalizedDataPoints.forEach((dp) => {
      if (dp.chapter) set.add(dp.chapter);
    });
    return Array.from(set).sort();
  }, [normalizedDataPoints]);

  // Manejar ordenamiento
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  // Filtrar y ordenar datos
  const filteredAndSortedData = useMemo(() => {
    let result = [...normalizedDataPoints];

    // Filtrar por término de búsqueda
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (dp) =>
          dp.task_name.toLowerCase().includes(term) ||
          dp.chapter.toLowerCase().includes(term)
      );
    }

    // Filtrar por capítulo
    if (selectedChapter !== "all") {
      result = result.filter((dp) => dp.chapter === selectedChapter);
    }

    // Ordenar
    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === "date") {
        const timeA = a.date ? new Date(a.date).getTime() : 0;
        const timeB = b.date ? new Date(b.date).getTime() : 0;
        comparison = timeA - timeB;
      } else if (sortField === "budget_required") {
        comparison = a.budget_required - b.budget_required;
      } else {
        comparison = a[sortField].localeCompare(b[sortField]);
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [normalizedDataPoints, searchTerm, selectedChapter, sortField, sortOrder]);

  // Paginación
  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedData, currentPage, itemsPerPage]);

  // Exportar a CSV
  const exportToCSV = () => {
    const headers = ["Fecha Inicio", "Fecha Fin", "Duracion (Dias)", "Capitulo", "Item de Obra / Tarea", "Presupuesto Total (COP)", "Presupuesto Diario (COP)"];
    const rows = filteredAndSortedData.map((dp) => [
      dp.start_date,
      dp.end_date,
      dp.working_days,
      `"${dp.chapter.replace(/"/g, '""')}"`,
      `"${dp.task_name.replace(/"/g, '""')}"`,
      dp.budget_required,
      Math.round(dp.daily_budget),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `flujo_caja_mapeado_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [isExporting, setIsExporting] = useState(false);

  // Exportar a Excel (.xlsx) interactuando con el endpoint Next.js
  const exportToExcel = async () => {
    try {
      setIsExporting(true);
      const response = await fetch("/api/analysis/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dataPoints: normalizedDataPoints,
          distributedDataPoints: distributedDataPoints || [],
          analysis: analysis || "",
          directBudget: directBudget || 8969704298.66,
          totalBudget: totalBudget || 9872953521.53,
        }),
      });

      if (!response.ok) {
        throw new Error("Error en la respuesta de exportación.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `informe_flujo_caja_serving_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error al exportar Excel:", error);
      alert("No se pudo generar el archivo Excel. Por favor intenta de nuevo.");
    } finally {
      setIsExporting(false);
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
      className="animate-fade-in w-full transition-all duration-300"
    >
      {/* Header del panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <span className="material-symbols-outlined text-[#11a542]">table_chart</span>
            Detalle Mapeado de Ítems ({filteredAndSortedData.length} registros)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Revisa el desglose granular del presupuesto mapeado contra el cronograma.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={exportToCSV}
            style={{ borderRadius: "9999px", padding: "0.6rem 1.25rem" }}
            className="flex items-center gap-2 text-xs font-bold shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 select-none shrink-0"
          >
            <Download className="w-4 h-4 text-[#11a542]" />
            <span>CSV</span>
          </button>

          <button
            onClick={exportToExcel}
            disabled={isExporting}
            style={{
              borderRadius: "9999px",
              padding: "0.6rem 1.35rem",
              background: "linear-gradient(135deg, #015c32 0%, #11a542 100%)",
              boxShadow: "0 4px 15px rgba(17, 165, 66, 0.3)",
            }}
            className="flex items-center gap-2 text-xs font-bold text-white hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border-none select-none shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4 text-white" />
            <span>{isExporting ? "Generando..." : "Descargar Excel (.xlsx)"}</span>
          </button>
        </div>
      </div>

      {/* Controles de Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Barra de Búsqueda con Espaciado Perfecto de Lupa */}
        <div className="relative flex items-center">
          <div 
            style={{ position: "absolute", left: "1rem", pointerEvents: "none", display: "flex", alignItems: "center" }}
            className="text-slate-400"
          >
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Buscar ítem o capítulo..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              paddingLeft: "3rem",
              paddingRight: "1rem",
              height: "2.85rem",
              borderRadius: "14px",
            }}
            className="w-full text-xs font-medium border bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#11a542] focus:ring-2 focus:ring-[#11a542]/20 transition-all"
          />
        </div>

        {/* Selector de Capítulo */}
        <div className="relative">
          <select
            value={selectedChapter}
            onChange={(e) => {
              setSelectedChapter(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              height: "2.85rem",
              borderRadius: "14px",
              paddingLeft: "1rem",
              paddingRight: "2.25rem",
            }}
            className="w-full text-xs font-semibold border bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#11a542]/20"
          >
            <option value="all">Filtrar por Capítulo: Todos</option>
            {chapters.map((ch) => (
              <option key={ch} value={ch}>
                {ch}
              </option>
            ))}
          </select>
          <span className="material-symbols-outlined absolute right-3.5 top-1/2 -translate-y-1/2 text-sm pointer-events-none text-slate-400">
            unfold_more
          </span>
        </div>

        {/* Elementos por Página */}
        <div className="relative">
          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            style={{
              height: "2.85rem",
              borderRadius: "14px",
              paddingLeft: "1rem",
              paddingRight: "2.25rem",
            }}
            className="w-full text-xs font-semibold border bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#11a542]/20"
          >
            <option value={10}>Mostrar 10 registros</option>
            <option value={25}>Mostrar 25 registros</option>
            <option value={50}>Mostrar 50 registros</option>
            <option value={100}>Mostrar 100 registros</option>
          </select>
          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none text-[var(--color-text-tertiary)]">
            unfold_more
          </span>
        </div>
      </div>

      {/* Tabla de Resultados */}
      <div className="overflow-x-auto border border-[var(--color-border)] rounded-xl bg-[var(--color-bg)]">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr
              style={{
                backgroundColor: "var(--color-surface-hover)",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              <th
                onClick={() => handleSort("date")}
                className="p-4 font-semibold text-xs uppercase tracking-wider cursor-pointer select-none text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  Intervalo de Fechas
                  {sortField === "date" && (
                    <span className="text-[10px]">{sortOrder === "asc" ? "▲" : "▼"}</span>
                  )}
                </div>
              </th>
              <th
                className="p-4 font-semibold text-xs uppercase tracking-wider select-none text-[var(--color-text-secondary)]"
              >
                Duración
              </th>
              <th
                onClick={() => handleSort("chapter")}
                className="p-4 font-semibold text-xs uppercase tracking-wider cursor-pointer select-none text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  Capítulo
                  {sortField === "chapter" && (
                    <span className="text-[10px]">{sortOrder === "asc" ? "▲" : "▼"}</span>
                  )}
                </div>
              </th>
              <th
                onClick={() => handleSort("task_name")}
                className="p-4 font-semibold text-xs uppercase tracking-wider cursor-pointer select-none text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  Ítem de Obra / Tarea
                  {sortField === "task_name" && (
                    <span className="text-[10px]">{sortOrder === "asc" ? "▲" : "▼"}</span>
                  )}
                </div>
              </th>
              <th
                onClick={() => handleSort("budget_required")}
                className="p-4 font-semibold text-xs uppercase tracking-wider cursor-pointer select-none text-right text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors"
              >
                <div className="flex items-center justify-end gap-1.5">
                  Costo Total
                  {sortField === "budget_required" && (
                    <span className="text-[10px]">{sortOrder === "asc" ? "▲" : "▼"}</span>
                  )}
                </div>
              </th>
              <th
                className="p-4 font-semibold text-xs uppercase tracking-wider text-right text-[var(--color-text-secondary)]"
              >
                Costo Diario
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]" style={{ backgroundColor: "var(--color-surface)" }}>
            {paginatedData.length > 0 ? (
              paginatedData.map((dp, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-[var(--color-surface-hover)] transition-colors duration-150 group"
                >
                  <td className="p-4 whitespace-nowrap font-mono text-xs text-[var(--color-text-secondary)]">
                    {dp.chapter === "Presupuesto Sin Asignar / Huérfano" ? (
                      <span className="text-xs text-[var(--color-text-tertiary)] italic">—</span>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-[var(--color-text-primary)]">{dp.start_date}</span>
                        <span className="text-[10px] opacity-70">hasta {dp.end_date}</span>
                      </div>
                    )}
                  </td>
                  <td className="p-4 whitespace-nowrap font-medium text-xs text-[var(--color-text-primary)]">
                    {dp.chapter === "Presupuesto Sin Asignar / Huérfano" ? (
                      <span className="text-xs text-[var(--color-text-tertiary)] italic">—</span>
                    ) : (
                      `${dp.working_days} ${dp.working_days === 1 ? "día" : "días"}`
                    )}
                  </td>
                  <td className="p-4 font-medium text-xs">
                    <span
                      className="px-2.5 py-1 rounded-full text-[10px] font-bold"
                      style={{
                        backgroundColor: dp.chapter === "Presupuesto Sin Asignar / Huérfano" ? "rgba(239, 68, 68, 0.1)" : "var(--color-primary-light)",
                        color: dp.chapter === "Presupuesto Sin Asignar / Huérfano" ? "var(--color-error)" : "var(--color-primary)",
                      }}
                    >
                      {dp.chapter}
                    </span>
                  </td>
                  <td className="p-4 text-[var(--color-text-primary)] font-medium leading-snug max-w-md break-words">
                    {dp.task_name}
                  </td>
                  <td className="p-4 text-right font-mono font-bold text-[var(--color-text-primary)] transition-colors">
                    {dp.budget_required === 0 ? (
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] border border-[var(--color-border)]">
                        Hito (Sin costo)
                      </span>
                    ) : (
                      formatCurrency(dp.budget_required)
                    )}
                  </td>
                  <td className="p-4 text-right font-mono font-extrabold text-[var(--color-warning)] transition-colors">
                    {dp.budget_required === 0 || dp.chapter === "Presupuesto Sin Asignar / Huérfano" ? (
                      <span className="text-xs text-[var(--color-text-tertiary)] italic font-normal">—</span>
                    ) : (
                      formatCurrency(dp.daily_budget)
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="p-12 text-center text-[var(--color-text-tertiary)] italic">
                  Ningún registro coincide con los filtros aplicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6 pt-6 border-t" style={{ borderColor: "var(--color-border)" }}>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Mostrando registros del <strong>{((currentPage - 1) * itemsPerPage) + 1}</strong> al{" "}
            <strong>{Math.min(currentPage * itemsPerPage, filteredAndSortedData.length)}</strong> de un total de{" "}
            <strong>{filteredAndSortedData.length}</strong>.
          </p>

          <div className="flex items-center gap-2 select-none">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="flex items-center justify-center p-2 rounded-lg border transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--color-surface-hover)]"
              style={{ borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              // Mostrar páginas alrededor de la actual
              let pageNum = i + 1;
              if (currentPage > 3 && totalPages > 5) {
                if (currentPage + 2 <= totalPages) {
                  pageNum = currentPage - 3 + i;
                } else {
                  pageNum = totalPages - 4 + i;
                }
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-9 h-9 rounded-lg border text-xs font-bold transition-all duration-200 cursor-pointer ${
                    currentPage === pageNum
                      ? "shadow-sm"
                      : "hover:bg-[var(--color-surface-hover)]"
                  }`}
                  style={{
                    backgroundColor: currentPage === pageNum ? "var(--color-primary)" : "transparent",
                    color: currentPage === pageNum ? "white" : "var(--color-text-primary)",
                    borderColor: currentPage === pageNum ? "var(--color-primary)" : "var(--color-border)",
                  }}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="flex items-center justify-center p-2 rounded-lg border transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--color-surface-hover)]"
              style={{ borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
