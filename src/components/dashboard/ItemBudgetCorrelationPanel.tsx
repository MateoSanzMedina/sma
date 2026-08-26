"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useMemo } from "react";
import { 
  Search, 
  ChevronDown, 
  ChevronRight, 
  Layers, 
  ListFilter, 
  Calendar, 
  Clock, 
  Tag, 
  CheckCircle2, 
  ArrowUpDown,
  FileSpreadsheet,
  Download
} from "lucide-react";

export interface CorrelationDataPoint {
  task_name: string;
  start_date?: string;
  end_date?: string;
  date?: string;
  working_days?: number;
  budget_required: number;
  daily_budget?: number;
  chapter?: string;
  budget_item_code?: string;
  budget_item_desc?: string;
}

interface ItemBudgetCorrelationPanelProps {
  dataPoints: CorrelationDataPoint[];
  distributedDataPoints?: any[];
  analysis?: string;
  totalBudget?: number;
  directBudget?: number;
}

interface BudgetItemGroup {
  code: string;
  desc: string;
  chapter: string;
  totalBudget: number;
  tasks: CorrelationDataPoint[];
  startDate: string;
  endDate: string;
  totalDays: number;
}

export default function ItemBudgetCorrelationPanel({
  dataPoints,
  distributedDataPoints,
  analysis,
  totalBudget,
  directBudget,
}: ItemBudgetCorrelationPanelProps) {
  const [selectedChapter, setSelectedChapter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");
  const [expandedCodes, setExpandedCodes] = useState<Record<string, boolean>>({});
  const [sortField, setSortField] = useState<"budget" | "code" | "tasks">("budget");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [isExporting, setIsExporting] = useState(false);

  const exportToExcel = async () => {
    try {
      setIsExporting(true);
      const response = await fetch("/api/analysis/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataPoints,
          distributedDataPoints: distributedDataPoints || [],
          analysis: analysis || "",
          directBudget: directBudget || 0,
          totalBudget: totalBudget || 0,
        }),
      });

      if (!response.ok) {
        throw new Error("Error en la respuesta del servidor");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `matriz_correlacion_serving_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Error al exportar a Excel:", err);
    } finally {
      setIsExporting(false);
    }
  };

  // Formatear moneda colombiana (COP)
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  // 1. Obtener lista consolidada de capítulos con sus métricas
  const chapterList = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();

    dataPoints.forEach((dp) => {
      const ch = dp.chapter || "Otros";
      const current = map.get(ch) || { count: 0, total: 0 };
      current.count += 1;
      current.total += dp.budget_required || 0;
      map.set(ch, current);
    });

    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        count: data.count,
        total: data.total,
      }))
      .sort((a, b) => b.total - a.total);
  }, [dataPoints]);

  // 2. Agrupar dataPoints por Código de Ítem de Presupuesto
  const groupedByBudgetItem = useMemo<BudgetItemGroup[]>(() => {
    const groupMap = new Map<string, BudgetItemGroup>();

    dataPoints.forEach((dp) => {
      const code = String(dp.budget_item_code || "sin_codigo").trim();
      const ch = dp.chapter || "Otros";
      const sDate = dp.start_date || dp.date || "";
      const eDate = dp.end_date || sDate;
      const days = dp.working_days || 1;
      const desc = dp.budget_item_desc || dp.task_name;

      if (!groupMap.has(code)) {
        groupMap.set(code, {
          code,
          desc,
          chapter: ch,
          totalBudget: 0,
          tasks: [],
          startDate: sDate,
          endDate: eDate,
          totalDays: 0,
        });
      }

      const grp = groupMap.get(code)!;
      grp.totalBudget += dp.budget_required || 0;
      grp.totalDays += days;
      grp.tasks.push(dp);

      if (sDate && (!grp.startDate || sDate < grp.startDate)) grp.startDate = sDate;
      if (eDate && (!grp.endDate || eDate > grp.endDate)) grp.endDate = eDate;
    });

    return Array.from(groupMap.values());
  }, [dataPoints]);

  // 3. Filtrar y ordenar los grupos
  const filteredGroups = useMemo(() => {
    return groupedByBudgetItem
      .filter((grp) => {
        const matchesChapter = selectedChapter === "all" || grp.chapter === selectedChapter;
        const q = searchTerm.toLowerCase().trim();
        const matchesSearch =
          !q ||
          grp.code.toLowerCase().includes(q) ||
          grp.desc.toLowerCase().includes(q) ||
          grp.chapter.toLowerCase().includes(q) ||
          grp.tasks.some((t) => t.task_name.toLowerCase().includes(q));

        return matchesChapter && matchesSearch;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === "budget") {
          cmp = a.totalBudget - b.totalBudget;
        } else if (sortField === "code") {
          cmp = a.code.localeCompare(b.code);
        } else if (sortField === "tasks") {
          cmp = a.tasks.length - b.tasks.length;
        }
        return sortOrder === "desc" ? -cmp : cmp;
      });
  }, [groupedByBudgetItem, selectedChapter, searchTerm, sortField, sortOrder]);

  // 4. Métricas del capítulo activo
  const activeChapterMetrics = useMemo(() => {
    if (selectedChapter === "all") {
      const tot = dataPoints.reduce((acc, dp) => acc + (dp.budget_required || 0), 0);
      return {
        name: "Todos los Capítulos",
        total: tot,
        taskCount: dataPoints.length,
        itemCount: groupedByBudgetItem.length,
      };
    }
    const found = chapterList.find((c) => c.name === selectedChapter);
    const itemsInChap = groupedByBudgetItem.filter((g) => g.chapter === selectedChapter);
    return {
      name: selectedChapter,
      total: found?.total || 0,
      taskCount: found?.count || 0,
      itemCount: itemsInChap.length,
    };
  }, [selectedChapter, dataPoints, chapterList, groupedByBudgetItem]);

  // Toggle accordion expand
  const toggleExpand = (code: string) => {
    setExpandedCodes((prev) => ({
      ...prev,
      [code]: !prev[code],
    }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    filteredGroups.forEach((g) => {
      all[g.code] = true;
    });
    setExpandedCodes(all);
  };

  const collapseAll = () => {
    setExpandedCodes({});
  };

  return (
    <div 
      className="rounded-xl p-6 sm:p-8 animate-fade-in w-full transition-all duration-300"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      {/* 1. Header y Título */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-[var(--color-border)]">
        <div>
          <div className="flex items-center gap-3">
            <div 
              className="p-2.5 rounded-xl flex items-center justify-center text-white"
              style={{ background: "linear-gradient(135deg, var(--color-primary), #11a542)" }}
            >
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight" style={{ color: "var(--color-text-primary)" }}>
                Matriz de Correlación Ítem a Ítem
              </h2>
              <p className="text-xs sm:text-sm mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                Inspecciona cómo cada actividad del cronograma de obra se asocia a los códigos y partidas del presupuesto.
              </p>
            </div>
          </div>
        </div>

        {/* Switch de Modo de Vista y Exportación */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center p-1 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)]">
            <button
              onClick={() => setViewMode("grouped")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "grouped"
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Por Ítems / Jerárquico
            </button>
            <button
              onClick={() => setViewMode("flat")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "flat"
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Matriz Plana (1 a 1)
            </button>
          </div>

          <button
            onClick={exportToExcel}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm text-white disabled:opacity-50"
            style={{ backgroundColor: "var(--color-primary)" }}
            title="Descargar Libro Completo en Excel (.xlsx)"
          >
            <Download className={`w-3.5 h-3.5 ${isExporting ? "animate-bounce" : ""}`} />
            <span>{isExporting ? "Generando..." : "Descargar Excel (.xlsx)"}</span>
          </button>
        </div>
      </div>

      {/* 2. Tarjeta Resumen del Capítulo Seleccionado */}
      <div 
        className="my-6 p-4 sm:p-5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        style={{
          backgroundColor: "var(--color-surface-hover)",
          borderColor: "var(--color-border)",
        }}
      >
        <div className="space-y-1">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--color-accent)] flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5" />
            Capítulo en Vista
          </span>
          <h3 className="text-base sm:text-lg font-black text-[var(--color-text-primary)]">
            {activeChapterMetrics.name}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-4 sm:gap-8">
          <div>
            <p className="text-[10px] uppercase font-bold text-[var(--color-text-tertiary)]">Presupuesto Asignado</p>
            <p className="text-base sm:text-lg font-black text-[var(--color-primary)] font-mono">
              {formatCurrency(activeChapterMetrics.total)}
            </p>
          </div>
          <div className="border-l border-[var(--color-border)] pl-4">
            <p className="text-[10px] uppercase font-bold text-[var(--color-text-tertiary)]">Ítems de Presupuesto</p>
            <p className="text-base sm:text-lg font-black text-[var(--color-text-primary)]">
              {activeChapterMetrics.itemCount}
            </p>
          </div>
          <div className="border-l border-[var(--color-border)] pl-4">
            <p className="text-[10px] uppercase font-bold text-[var(--color-text-tertiary)]">Tareas de Obra</p>
            <p className="text-base sm:text-lg font-black text-[var(--color-text-primary)]">
              {activeChapterMetrics.taskCount}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Barra de Filtros por Capítulo (Chips Scrolleables) */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-[var(--color-text-secondary)] flex items-center gap-1.5">
            <ListFilter className="w-3.5 h-3.5 text-[var(--color-primary)]" />
            Filtrar por Capítulo de Obra:
          </span>
          {viewMode === "grouped" && (
            <div className="flex items-center gap-2">
              <button
                onClick={expandAll}
                className="text-[11px] font-bold text-[var(--color-accent)] hover:underline cursor-pointer"
              >
                Expandir Todos
              </button>
              <span className="text-[var(--color-text-tertiary)]">•</span>
              <button
                onClick={collapseAll}
                className="text-[11px] font-bold text-[var(--color-text-secondary)] hover:underline cursor-pointer"
              >
                Colapsar Todos
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          <button
            onClick={() => setSelectedChapter("all")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 border ${
              selectedChapter === "all"
                ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-sm"
                : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
            }`}
          >
            Todos ({dataPoints.length})
          </button>
          {chapterList.map((ch) => (
            <button
              key={ch.name}
              onClick={() => setSelectedChapter(ch.name)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 border flex items-center gap-2 ${
                selectedChapter === ch.name
                  ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-sm"
                  : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
              }`}
            >
              <span>{ch.name}</span>
              <span 
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                  selectedChapter === ch.name
                    ? "bg-white/20 text-white"
                    : "bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]"
                }`}
              >
                {ch.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 4. Buscador y Ordenamiento */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
          <input
            type="text"
            placeholder="Buscar por código, tarea o insumo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-medium border bg-[var(--color-surface)] border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)] text-[var(--color-text-primary)]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-[var(--color-text-secondary)] font-medium">Ordenar por:</span>
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as any)}
            className="px-3 py-2 rounded-xl text-xs font-bold border bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-primary)] cursor-pointer focus:outline-none"
          >
            <option value="budget">Mayor Presupuesto</option>
            <option value="code">Código de Ítem</option>
            <option value="tasks">Cantidad de Tareas</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="p-2 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] cursor-pointer"
            title={`Orden ${sortOrder === "asc" ? "Ascendente" : "Descendente"}`}
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 5. VISTA 1: AGRUPADA POR ÍTEM DE PRESUPUESTO */}
      {viewMode === "grouped" && (
        <div className="space-y-4">
          {filteredGroups.length === 0 ? (
            <div className="p-12 text-center border border-dashed rounded-xl border-[var(--color-border)] text-[var(--color-text-secondary)]">
              <p className="text-sm font-medium">No se encontraron ítems que coincidan con la búsqueda.</p>
            </div>
          ) : (
            filteredGroups.map((group) => {
              const isExpanded = !!expandedCodes[group.code];
              const pctOfTotal = directBudget && directBudget > 0 ? (group.totalBudget / directBudget) * 100 : 0;

              return (
                <div
                  key={group.code}
                  className="rounded-xl border transition-all duration-200 overflow-hidden"
                  style={{
                    backgroundColor: "var(--color-surface)",
                    borderColor: isExpanded ? "var(--color-primary)" : "var(--color-border)",
                  }}
                >
                  {/* Encabezado del Ítem */}
                  <div
                    onClick={() => toggleExpand(group.code)}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-[var(--color-surface-hover)]/60 transition-colors select-none"
                  >
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <div className="mt-0.5 text-[var(--color-primary)]">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 transition-transform" />
                        ) : (
                          <ChevronRight className="w-5 h-5 transition-transform" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-mono font-black bg-[var(--color-primary-light)] text-[var(--color-primary)] border border-[var(--color-primary)]/20">
                            {group.code}
                          </span>
                          <span className="text-[11px] font-bold text-[var(--color-text-secondary)]">
                            {group.chapter}
                          </span>
                        </div>
                        <h4 className="text-sm sm:text-base font-extrabold text-[var(--color-text-primary)] leading-snug">
                          {group.desc}
                        </h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 sm:gap-8 justify-between sm:justify-end shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-[var(--color-border)]">
                      <div className="text-left sm:text-right">
                        <p className="text-[10px] uppercase font-bold text-[var(--color-text-tertiary)]">Monto Presupuestado</p>
                        <p className="text-sm sm:text-base font-black text-[var(--color-primary)] font-mono">
                          {formatCurrency(group.totalBudget)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase font-bold text-[var(--color-text-tertiary)]">% Presupuesto</p>
                        <p className="text-xs sm:text-sm font-bold text-[var(--color-text-primary)] font-mono">
                          {pctOfTotal.toFixed(2)}%
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] border border-[var(--color-border)]">
                        {group.tasks.length} {group.tasks.length === 1 ? "tarea" : "tareas"}
                      </span>
                    </div>
                  </div>

                  {/* Detalle Desplegable: Actividades Asociadas */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 bg-[var(--color-bg)]/40 border-t border-[var(--color-border)] space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-[var(--color-text-secondary)] flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          Actividades del Cronograma (MS Project) Correlacionadas:
                        </span>
                        <span className="text-[11px] text-[var(--color-text-tertiary)] font-medium">
                          Periodo: {group.startDate || "N/A"} al {group.endDate || "N/A"}
                        </span>
                      </div>

                      <div className="divide-y divide-[var(--color-border)]/60 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
                        {group.tasks.map((task, tIdx) => {
                          const daily = task.daily_budget || (task.working_days && task.working_days > 0 ? task.budget_required / task.working_days : task.budget_required);
                          const isPrereq = task.task_name.startsWith("[PRERREQUISITO");

                          return (
                            <div 
                              key={tIdx}
                              className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[var(--color-surface-hover)]/50 transition-colors"
                            >
                              <div className="flex items-start gap-3">
                                <span className="w-5 h-5 rounded-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[10px] font-bold text-[var(--color-text-tertiary)] flex items-center justify-center shrink-0 mt-0.5">
                                  {tIdx + 1}
                                </span>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs sm:text-sm font-bold text-[var(--color-text-primary)]">
                                      {task.task_name}
                                    </p>
                                    {isPrereq && (
                                      <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                        Prerrequisito
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-[var(--color-text-secondary)]">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3 text-[var(--color-accent)]" />
                                      {task.start_date || task.date} al {task.end_date || task.date}
                                    </span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-[var(--color-text-tertiary)]" />
                                      {task.working_days || 1} días calendario
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-6 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-[var(--color-border)]/40">
                                <div className="text-left sm:text-right">
                                  <p className="text-[10px] uppercase font-bold text-[var(--color-text-tertiary)]">Costo Directo</p>
                                  <p className="text-xs sm:text-sm font-bold text-[var(--color-primary)] font-mono">
                                    {formatCurrency(task.budget_required)}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[10px] uppercase font-bold text-[var(--color-text-tertiary)]">Costo / Día</p>
                                  <p className="text-xs font-semibold text-[var(--color-text-secondary)] font-mono">
                                    {formatCurrency(daily)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 6. VISTA 2: MATRIZ PLANA (1 A 1) */}
      {viewMode === "flat" && (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[var(--color-surface-hover)] border-b border-[var(--color-border)]">
              <tr>
                <th className="px-4 py-3.5 font-extrabold uppercase tracking-wider text-[var(--color-text-primary)]">N°</th>
                <th className="px-4 py-3.5 font-extrabold uppercase tracking-wider text-[var(--color-text-primary)]">Código Presupuesto</th>
                <th className="px-4 py-3.5 font-extrabold uppercase tracking-wider text-[var(--color-text-primary)]">Capítulo</th>
                <th className="px-4 py-3.5 font-extrabold uppercase tracking-wider text-[var(--color-text-primary)]">Descripción Ítem Presupuesto</th>
                <th className="px-4 py-3.5 font-extrabold uppercase tracking-wider text-[var(--color-text-primary)]">Actividad MS Project</th>
                <th className="px-4 py-3.5 font-extrabold uppercase tracking-wider text-[var(--color-text-primary)] text-center">Fechas</th>
                <th className="px-4 py-3.5 font-extrabold uppercase tracking-wider text-[var(--color-text-primary)] text-center">Días</th>
                <th className="px-4 py-3.5 font-extrabold uppercase tracking-wider text-[var(--color-text-primary)] text-right">Costo Directo</th>
                <th className="px-4 py-3.5 font-extrabold uppercase tracking-wider text-[var(--color-text-primary)] text-right">Costo / Día</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
              {(() => {
                let globalIdx = 0;
                return filteredGroups.flatMap((grp) =>
                  grp.tasks.map((task, tIdx) => {
                    globalIdx++;
                    const currentRowNum = globalIdx;
                    const daily = task.daily_budget || (task.working_days && task.working_days > 0 ? task.budget_required / task.working_days : task.budget_required);

                    return (
                      <tr key={`${grp.code}-${tIdx}`} className="hover:bg-[var(--color-surface-hover)]/40 transition-colors">
                        <td className="px-4 py-3 text-[var(--color-text-tertiary)] font-mono font-bold">
                          {currentRowNum}
                          <span className="block text-[9px] font-normal text-[var(--color-text-tertiary)]/70">
                            ({tIdx + 1}/{grp.tasks.length})
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded font-mono font-bold bg-[var(--color-primary-light)] text-[var(--color-primary)] text-[10px]">
                            {grp.code}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-[var(--color-text-secondary)]">{grp.chapter}</td>
                        <td className="px-4 py-3 font-medium text-[var(--color-text-primary)] max-w-xs truncate" title={grp.desc}>
                          {grp.desc}
                        </td>
                        <td className="px-4 py-3 font-bold text-[var(--color-text-primary)] max-w-sm truncate" title={task.task_name}>
                          {task.task_name}
                        </td>
                        <td className="px-4 py-3 text-center text-[var(--color-text-secondary)] whitespace-nowrap">
                          {task.start_date || task.date} → {task.end_date || task.date}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-[var(--color-text-primary)]">
                          {task.working_days || 1}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-[var(--color-primary)]">
                          {formatCurrency(task.budget_required)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[var(--color-text-secondary)]">
                          {formatCurrency(daily)}
                        </td>
                      </tr>
                    );
                  })
                );
              })()}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
