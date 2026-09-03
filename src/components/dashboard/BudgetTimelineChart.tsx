"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
  Cell,
} from "recharts";

interface DataPoint {
  date: string;
  start_date?: string;
  end_date?: string;
  working_days?: number;
  budget_required: number;
  task_name: string;
  chapter?: string;
  process_name?: string;
  budget_item_code?: string;
}

interface BudgetTimelineChartProps {
  data: DataPoint[];
  tasks?: DataPoint[];
  totalBudget: number;
}

interface GroupedData {
  date: string;
  originalDate: string;
  tasks: { [key: string]: string[] };
  [key: string]: string | number | { [key: string]: string[] } | undefined;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
  chartDataMap: { [key: string]: GroupedData };
  formatCurrency: (value: number) => string;
}

const CustomTooltip = ({ active, payload, label, chartDataMap, formatCurrency }: CustomTooltipProps) => {
  if (active && payload && payload.length && label) {
    const groupData = chartDataMap[label];
    return (
      <div 
        className="p-4 rounded-lg shadow-xl max-w-xs sm:max-w-md backdrop-blur-md select-text"
        style={{
          backgroundColor: "rgba(17, 24, 39, 0.95)",
          border: "1px solid var(--color-border-strong)",
        }}
      >
        <p className="font-bold mb-2 border-b border-gray-700 pb-2 text-sm text-white">
          Fecha / Período: {label}
        </p>
        <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
          {payload.map((entry, index: number) => {
            const tasksList = groupData?.tasks?.[entry.name] || [];
            const displayedTasks = tasksList.slice(0, 3);
            const remaining = tasksList.length - 3;
            
            const truncateText = (text: string, maxLen = 35) => {
              return text.length > maxLen ? text.substring(0, maxLen) + "..." : text;
            };
            
            const tasksText = displayedTasks.map((t: string) => truncateText(t)).join(", ") + 
              (remaining > 0 ? ` y ${remaining} tareas más...` : "");

            return (
              <div key={index} className="flex flex-col">
                <div className="flex justify-between items-center gap-4">
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: entry.color }}>
                    {entry.name}
                  </span>
                  <span className="font-mono text-sm font-semibold text-white">
                    {formatCurrency(entry.value)}
                  </span>
                </div>
                {tasksText && (
                  <div className="mt-1 pl-2 border-l-2" style={{ borderColor: entry.color }}>
                    <p className="text-[10px] italic leading-tight text-gray-400">
                      {tasksText}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-3 pt-2 border-t border-gray-700 flex justify-between">
          <span className="text-xs font-bold text-gray-400">TOTAL PERÍODO</span>
          <span className="font-bold text-sm text-[var(--color-warning)]">
            {formatCurrency(payload.reduce((sum: number, e) => sum + e.value, 0))}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

// Tooltip específico para el Diagrama de Gantt
const GanttTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    // Al usar una barra apilada, el tooltip recibe payload para la barra transparente y la barra de duración.
    // Extraemos los datos reales del elemento visible (el que tiene dataKey="durationDays")
    const activePayload = payload.find((p: any) => p.dataKey === "durationDays") || payload[0];
    const data = activePayload.payload;
    return (
      <div 
        className="p-4 rounded-xl shadow-2xl backdrop-blur-md text-xs select-text text-white animate-fade-in"
        style={{
          backgroundColor: "rgba(17, 24, 39, 0.95)",
          border: "1px solid var(--color-border-strong)",
        }}
      >
        <p className="font-extrabold mb-1.5 border-b border-gray-700 pb-1.5 text-[var(--color-primary)] uppercase tracking-wider text-[10px]">
          {data.chapter}
        </p>
        <p className="font-bold text-sm mb-3 text-white leading-snug">
          {data.task_name}
        </p>
        <div className="space-y-1.5 font-mono text-gray-400">
          <div className="flex justify-between gap-6">
            <span>Inicio:</span>
            <span className="text-white font-bold">{data.start_date}</span>
          </div>
          <div className="flex justify-between gap-6">
            <span>Fin:</span>
            <span className="text-white font-bold">{data.end_date}</span>
          </div>
          <div className="flex justify-between gap-6">
            <span>Duración:</span>
            <span className="text-[var(--color-warning)] font-bold">{data.working_days} {data.working_days === 1 ? "día" : "días"}</span>
          </div>
          <div className="flex justify-between gap-6 border-t border-gray-800 pt-2 mt-2">
            <span>Presupuesto:</span>
            <span className="text-[var(--color-accent)] font-black">
              {data.budget_required === 0 ? (
                <span className="text-[10px] text-gray-400 italic font-bold">Hito / Sin costo directo</span>
              ) : (
                new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(data.budget_required)
              )}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// Generador de colores dinámicos armónicos basados en el capítulo
function getColorForChapter(chapterName: string): string {
  const clean = (chapterName || "").toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  if (clean.includes("preliminar") || clean.includes("tierra") || clean.includes("descapote") || clean.includes("corte")) return "#3b82f6"; // Azul
  if (clean.includes("ciment") || clean.includes("zapata") || clean.includes("fundac")) return "var(--color-accent)"; // Coral / Rosa
  if (clean.includes("estruct") || clean.includes("viga") || clean.includes("column") || clean.includes("concret") || clean.includes("losa")) return "var(--color-warning)"; // Oro / Amarillo
  if (clean.includes("red") || clean.includes("agua") || clean.includes("hidro") || clean.includes("electr") || clean.includes("pluv") || clean.includes("telecom") || clean.includes("alcantari")) return "#10b981"; // Verde Esmeralda
  if (clean.includes("acabad") || clean.includes("piso") || clean.includes("enchap") || clean.includes("baldosa") || clean.includes("pintur") || clean.includes("estuco")) return "#f97316"; // Naranja
  if (clean.includes("muro") || clean.includes("drywall") || clean.includes("mampost")) return "#06b6d4"; // Cyan
  if (clean.includes("urban") || clean.includes("via") || clean.includes("anden") || clean.includes("bordillo") || clean.includes("sardinel")) return "#14b8a6"; // Turquesa
  
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = ["var(--color-primary)", "#3b82f6", "var(--color-accent)", "#10b981", "#f97316", "#06b6d4", "#14b8a6", "#64748b"];
  return colors[Math.abs(hash) % colors.length];
}

// Helpers matemáticos de fechas
function getDaysDifference(date1Str: string, date2Str: string): number {
  const d1 = new Date(date1Str + "T00:00:00");
  const d2 = new Date(date2Str + "T00:00:00");
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function BudgetTimelineChart({ data, tasks, totalBudget }: BudgetTimelineChartProps) {
  const [chartView, setChartView] = useState<"flow" | "gantt">("gantt"); // Por defecto iniciamos en diagrama de Gantt como solicita el usuario
  const [grouping, setGrouping] = useState<"daily" | "weekly" | "monthly">("daily");
  
  // Filtros para la vista de Gantt
  const [ganttSearch, setGanttSearch] = useState("");
  const [ganttChapter, setGanttChapter] = useState("all");

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getWeekRange = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(date.setDate(diff));
    
    const startDay = String(startOfWeek.getDate()).padStart(2, '0');
    const startMonth = String(startOfWeek.getMonth() + 1).padStart(2, '0');
    return `Sem. ${startDay}/${startMonth}`;
  };

  const getMonthName = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    const months = [
      "Ene", "Feb", "Mar", "Abr", "May", "Jun", 
      "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
    ];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  // ----------------------------------------------------
  // 1. PROCESAR DATOS VISTA: FLUJO DE CAJA (FLOW VIEW)
  // ----------------------------------------------------
  const chartDataMap: { [key: string]: GroupedData } = {};
  const processes = new Set<string>();

  data.forEach((dp) => {
    let groupKey = dp.date;
    if (grouping === "weekly") {
      groupKey = getWeekRange(dp.date);
    } else if (grouping === "monthly") {
      groupKey = getMonthName(dp.date);
    }

    if (!chartDataMap[groupKey]) {
      chartDataMap[groupKey] = { 
        date: groupKey, 
        originalDate: dp.date,
        tasks: {}
      };
    }
    
    const procName = dp.chapter || dp.process_name || "Otros";
    processes.add(procName);
    
    const currentVal = (chartDataMap[groupKey][procName] as number) || 0;
    chartDataMap[groupKey][procName] = currentVal + dp.budget_required;
    
    if (!chartDataMap[groupKey].tasks[procName]) {
      chartDataMap[groupKey].tasks[procName] = [];
    }
    if (!chartDataMap[groupKey].tasks[procName].includes(dp.task_name)) {
      chartDataMap[groupKey].tasks[procName].push(dp.task_name);
    }
  });

  const chartData = Object.values(chartDataMap).sort((a, b) => 
    new Date(a.originalDate).getTime() - new Date(b.originalDate).getTime()
  );

  const processList = Array.from(processes);
  const colors = [
    "var(--color-primary)", 
    "var(--color-accent)", 
    "var(--color-warning)", 
    "#10b981", "#14b8a6", "#f59e0b", "#06b6d4"
  ];

  // ----------------------------------------------------
  // 2. PROCESAR DATOS VISTA: DIAGRAMA DE GANTT (GANTT VIEW)
  // ----------------------------------------------------
  const allTasks = tasks && tasks.length > 0 ? tasks : data;
  
  // Obtener todos los capítulos disponibles para el filtro
  const allChapters = Array.from(new Set(allTasks.map(t => t.chapter || t.process_name || "Otros"))).sort();

  // Encontrar fecha de inicio global del proyecto para determinar el año del proyecto
  const allStartDates = allTasks
    .map(t => t.start_date || t.date)
    .filter(d => d && d.includes("-"));
  const earliestDateStr = allStartDates.length > 0 
    ? allStartDates.reduce((min, d) => d < min ? d : min, allStartDates[0])
    : "2026-02-02";

  // Determinar el año del proyecto y establecer el rango del eje X para todo el año (Ene 1 - Dic 31)
  const projectYear = new Date(earliestDateStr + "T00:00:00").getFullYear() || 2026;
  const projectStartStr = `${projectYear}-01-01`;
  const projectEndStr = `${projectYear}-12-31`;
  const projectDurationDays = getDaysDifference(projectStartStr, projectEndStr) || 365;

  // Calcular las marcas de ticks para el primer día de cada mes del año
  const monthTicks: number[] = [];
  for (let m = 0; m < 12; m++) {
    const monthStr = String(m + 1).padStart(2, '0');
    const diff = getDaysDifference(projectStartStr, `${projectYear}-${monthStr}-01`);
    monthTicks.push(diff);
  }

  // Filtrar actividades de Gantt según los filtros
  const filteredTasks = allTasks.filter(t => {
    const name = (t.task_name || "").toLowerCase();
    const ch = (t.chapter || t.process_name || "Otros");
    
    const matchSearch = name.includes(ganttSearch.toLowerCase());
    const matchChapter = ganttChapter === "all" || ch === ganttChapter;
    
    return matchSearch && matchChapter;
  });

  // Ordenar cronológicamente (por fecha de inicio ascendente, y luego por fecha de fin ascendente)
  filteredTasks.sort((a, b) => {
    const sA = a.start_date || a.date || "9999-12-31";
    const sB = b.start_date || b.date || "9999-12-31";
    if (sA !== sB) {
      return sA.localeCompare(sB);
    }
    const eA = a.end_date || sA;
    const eB = b.end_date || sB;
    return eA.localeCompare(eB);
  });

  // Formatear los registros al esquema de Gantt apilado (Gantt Stacked Bar Pattern) de lista única
  const ganttChartData = filteredTasks.map((t, idx) => {
    const sDate = t.start_date || t.date;
    const eDate = t.end_date || sDate;
    const startDays = getDaysDifference(projectStartStr, sDate);
    const endDays = getDaysDifference(projectStartStr, eDate);
    const durationDays = Math.max(1, endDays - startDays);

    return {
      id: `g-${idx}-${t.budget_item_code || "sin_presupuesto"}`,
      task_name: t.task_name,
      chapter: t.chapter || t.process_name || "Otros",
      startDays: startDays,       // Barra 1: Espaciador transparente
      durationDays: durationDays,   // Barra 2: Duración coloreada
      start_date: sDate,
      end_date: eDate,
      working_days: t.working_days || durationDays,
      budget_required: t.budget_required
    };
  });

  const truncateTaskName = (name: string, maxLen = 22) => {
    return name.length > maxLen ? name.substring(0, maxLen) + "..." : name;
  };

  return (
    <div 
      className="rounded-xl p-6 sm:p-8 h-full flex flex-col relative overflow-hidden group"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-primary)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      
      {/* Cabecera del Panel (Responsive y sin solapamientos) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6 relative z-10 border-b border-[var(--color-border)] pb-5">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-10 bg-[var(--color-primary)] rounded-full"></div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-[var(--color-text-primary)]">
              Cronograma & Flujo de Caja
            </h2>
            <p className="text-[var(--color-text-secondary)] text-[10px] sm:text-xs mt-0.5 ml-0.5">
              {chartView === "flow" 
                ? "Análisis de inversión acumulada a lo largo del tiempo" 
                : "Diagrama de Gantt de actividades y cronograma de obra de MS Project"}
            </p>
          </div>
        </div>

        {/* Controles de la Cabecera */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto">
          {/* Toggles de Vista */}
          <div className="flex items-center gap-1 bg-[var(--color-bg)] p-1 rounded-full border border-[var(--color-border)] justify-center shadow-inner">
            <button
              onClick={() => setChartView("flow")}
              className={`px-4 py-2 rounded-full text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 select-none ${
                chartView === "flow"
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
              }`}
            >
              <span className="material-symbols-outlined text-sm">bar_chart</span>
              Flujo de Caja
            </button>
            <button
              onClick={() => setChartView("gantt")}
              className={`px-4 py-2 rounded-full text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 select-none ${
                chartView === "gantt"
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
              }`}
            >
              <span className="material-symbols-outlined text-sm">stacked_bar_chart</span>
              Diagrama Gantt
            </button>
          </div>

          {/* Presupuesto Total */}
          <div className="text-left sm:text-right border-l sm:border-l-0 sm:border-r border-[var(--color-border)] pl-4 sm:pl-0 sm:pr-4 py-1 flex flex-col justify-center">
            <p className="text-[10px] text-[var(--color-text-secondary)] uppercase font-extrabold tracking-wider">
              Presupuesto Total
            </p>
            <p className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)]">
              {formatCurrency(totalBudget)}
            </p>
          </div>
        </div>
      </div>

      {/* Filtros específicos de Gantt */}
      {chartView === "gantt" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 relative z-10 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/30 animate-fade-in">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-text-tertiary)]">search</span>
            <input
              type="text"
              placeholder="Buscar actividad por nombre..."
              value={ganttSearch}
              onChange={(e) => {
                setGanttSearch(e.target.value);
              }}
              className="w-full pl-9 pr-4 py-2.5 rounded-lg text-xs border outline-none bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-primary)] focus:border-[var(--color-primary)] transition-colors"
            />
          </div>

          <div className="relative">
            <select
              value={ganttChapter}
              onChange={(e) => {
                setGanttChapter(e.target.value);
              }}
              className="w-full px-4 py-2.5 rounded-lg text-xs border outline-none bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-primary)] focus:border-[var(--color-primary)] appearance-none cursor-pointer"
            >
              <option value="all">Filtrar por Capítulo: Todos</option>
              {allChapters.map(ch => (
                <option key={ch} value={ch}>{ch}</option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none text-[var(--color-text-tertiary)]">
              unfold_more
            </span>
          </div>
        </div>
      )}

      {/* Selector de periodo para vista de flujo (Diario/Semanal/Mensual) */}
      {chartView === "flow" && (
        <div className="flex justify-end mb-4 relative z-10 animate-fade-in">
          <div className="flex items-center gap-1 bg-[var(--color-bg)] p-1 rounded-full border border-[var(--color-border)] shadow-inner">
            <button
              onClick={() => setGrouping("daily")}
              className={`px-4 py-1.5 rounded-full text-[10px] font-black transition-all cursor-pointer ${
                grouping === "daily"
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
              }`}
            >
              Diario
            </button>
            <button
              onClick={() => setGrouping("weekly")}
              className={`px-4 py-1.5 rounded-full text-[10px] font-black transition-all cursor-pointer ${
                grouping === "weekly"
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
              }`}
            >
              Semanal
            </button>
            <button
              onClick={() => setGrouping("monthly")}
              className={`px-4 py-1.5 rounded-full text-[10px] font-black transition-all cursor-pointer ${
                grouping === "monthly"
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
              }`}
            >
              Mensual
            </button>
          </div>
        </div>
      )}

      {/* Contenedor del Gráfico */}
      <div className="w-full min-w-0 h-[450px] relative z-10">
        {mounted && (
          chartView === "flow" ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 40, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" strokeOpacity={0.4} />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: "var(--color-text-secondary)", fontSize: 10, fontWeight: 500 }}
                  tickMargin={12}
                  axisLine={{ stroke: "var(--color-border)" }}
                  tickLine={false}
                />
                <YAxis 
                  tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
                  tick={{ fill: "var(--color-text-secondary)", fontSize: 11, fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={12}
                />
                <Tooltip 
                  content={<CustomTooltip chartDataMap={chartDataMap} formatCurrency={formatCurrency} />} 
                  cursor={{ fill: 'var(--color-surface-hover)', opacity: 0.4 }} 
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  iconType="circle"
                  wrapperStyle={{ paddingTop: "20px", fontSize: "12px" }}
                />
                <Brush 
                  dataKey="date" 
                  height={30} 
                  stroke="var(--color-primary)" 
                  fill="var(--color-bg)"
                  travellerWidth={10}
                  gap={5}
                />
                {processList.map((proc, index) => (
                  <Bar 
                    key={proc}
                    dataKey={proc} 
                    name={proc} 
                    stackId="a" 
                    fill={colors[index % colors.length]} 
                    radius={index === processList.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                    animationDuration={1000}
                    animationEasing="ease-out"
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            filteredTasks.length > 0 ? (
              <div className="w-full overflow-auto max-h-[480px] border border-[var(--color-border)]/50 rounded-xl relative bg-[var(--color-surface)]">
                {/* 1. Cabecera Fija de Fechas (Sticky Top, Z-Index 30) */}
                <div className="sticky top-0 z-30 bg-[var(--color-surface)] border-b border-[var(--color-border)] flex" style={{ height: "55px", width: "2400px" }}>
                  {/* Esquina vacía superior izquierda (Sticky Left, Z-Index 40) */}
                  <div className="sticky left-0 z-40 bg-[var(--color-bg)] border-r border-[var(--color-border)] shrink-0" style={{ width: "170px", height: "55px" }} />
                  
                  {/* Timeline del Eje X */}
                  <div className="flex-1 min-w-0" style={{ height: "55px" }}>
                    <ResponsiveContainer width="100%" height={55} minWidth={100} minHeight={55}>
                      <BarChart
                        layout="vertical"
                        data={ganttChartData}
                        margin={{ top: 35, right: 35, left: 0, bottom: 0 }}
                      >
                        <XAxis
                          type="number"
                          domain={[0, projectDurationDays]}
                          ticks={monthTicks}
                          orientation="top"
                          tick={{ fill: "var(--color-text-secondary)", fontSize: 10, fontWeight: 700 }}
                          tickFormatter={(val) => {
                            const formatted = addDaysToDate(projectStartStr, val);
                            const parts = formatted.split("-");
                            return parts.length === 3 ? `${parts[2]}/${parts[1]}` : formatted;
                          }}
                          axisLine={{ stroke: "var(--color-border)" }}
                          tickLine={false}
                          tickMargin={8}
                        />
                        <YAxis type="category" dataKey="id" hide={true} />
                        {/* Dummy transparent bars to trigger axis rendering in Recharts */}
                        <Bar dataKey="startDays" stackId="a" fill="transparent" legendType="none" tooltipType="none" />
                        <Bar dataKey="durationDays" stackId="a" fill="transparent" legendType="none" tooltipType="none" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 2. Cuerpo del Cronograma (Contiene Columna Izquierda Sticky y Gráfico Derecho) */}
                <div className="flex" style={{ width: "2400px", height: `${filteredTasks.length * 36}px` }}>
                  {/* Columna de Tareas Fija (Sticky Left, Z-Index 20) */}
                  <div className="sticky left-0 z-20 bg-[var(--color-surface)] border-r border-[var(--color-border)] shrink-0 flex flex-col justify-start" style={{ width: "170px", height: "100%" }}>
                    {[...ganttChartData].map((t, idx) => (
                      <div 
                        key={t.id} 
                        className="h-[36px] flex items-center px-3 text-[10px] font-bold text-[var(--color-text-primary)] border-b border-[var(--color-border)]/30 truncate hover:bg-[var(--color-surface-hover)] transition-colors select-none"
                        style={{ lineHeight: "36px" }}
                        title={`${idx + 1}. ${t.task_name}`}
                      >
                        <span className="text-[var(--color-text-tertiary)] font-mono text-[9px] mr-1.5 min-w-[18px] inline-block">{idx + 1}.</span>
                        {truncateTaskName(t.task_name, 18)}
                      </div>
                    ))}
                  </div>

                  {/* Cuerpo del Gráfico de Recharts */}
                  <div className="flex-1 min-w-0" style={{ height: "100%" }}>
                    <ResponsiveContainer width="100%" height={Math.max(filteredTasks.length * 36, 100)} minWidth={100} minHeight={100}>
                      <BarChart
                        layout="vertical"
                        data={ganttChartData}
                        margin={{ top: 0, right: 35, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" strokeOpacity={0.4} />
                        <XAxis type="number" domain={[0, projectDurationDays]} hide={true} />
                        <YAxis type="category" dataKey="id" hide={true} />
                        <Tooltip content={<GanttTooltip />} cursor={{ fill: 'var(--color-surface-hover)', opacity: 0.3 }} />
                        
                        {/* Barra 1: Espacio transparent que desplaza la barra flotante al día de inicio de la tarea */}
                        <Bar 
                          dataKey="startDays" 
                          stackId="a" 
                          fill="transparent" 
                          legendType="none"
                          tooltipType="none"
                        />
                        
                        {/* Barra 2: El bloque visible y coloreado que representa la duración real de la tarea */}
                        <Bar 
                          dataKey="durationDays" 
                          stackId="a" 
                          radius={[0, 4, 4, 0]}
                          animationDuration={1000}
                          animationEasing="ease-out"
                        >
                          {ganttChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getColorForChapter(entry.chapter)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center border border-dashed border-[var(--color-border)] rounded-xl bg-[var(--color-bg)]/20 italic text-[var(--color-text-tertiary)] select-none animate-fade-in">
                <span className="material-symbols-outlined text-4xl mb-2">info</span>
                Ninguna actividad coincide con los filtros de búsqueda.
              </div>
            )
          )
        )}
      </div>
    </div>
  );
}
