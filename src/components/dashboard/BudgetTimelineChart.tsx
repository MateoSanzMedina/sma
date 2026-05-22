"use client";

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
} from "recharts";

interface DataPoint {
  date: string;
  budget_required: number;
  task_name: string;
  chapter?: string;
  process_name?: string;
}

interface BudgetTimelineChartProps {
  data: DataPoint[];
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

// Declared outside to satisfy react-hooks/static-components ESLint rule
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
        <p className="font-bold mb-2 border-b border-gray-700 pb-2 text-sm text-[var(--color-text-primary)]">
          Fecha / Período: {label}
        </p>
        <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
          {payload.map((entry, index: number) => {
            const tasksList = groupData?.tasks?.[entry.name] || [];
            const displayedTasks = tasksList.slice(0, 3);
            const remaining = tasksList.length - 3;
            
            // Recortar nombres de tareas largos con puntos suspensivos
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
                  <span className="font-mono text-sm font-semibold text-[var(--color-text-primary)]">
                    {formatCurrency(entry.value)}
                  </span>
                </div>
                {tasksText && (
                  <div className="mt-1 pl-2 border-l-2" style={{ borderColor: entry.color }}>
                    <p className="text-[10px] italic leading-tight text-[var(--color-text-secondary)]">
                      {tasksText}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-3 pt-2 border-t border-gray-700 flex justify-between">
          <span className="text-xs font-bold text-[var(--color-text-secondary)]">TOTAL PERÍODO</span>
          <span className="font-bold text-sm text-[var(--color-warning)]">
            {formatCurrency(payload.reduce((sum: number, e) => sum + e.value, 0))}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export default function BudgetTimelineChart({ data, totalBudget }: BudgetTimelineChartProps) {
  const [grouping, setGrouping] = useState<"daily" | "weekly" | "monthly">("daily");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Formatear moneda a pesos (COP o genérico)
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Helper to calculate week start date
  const getWeekRange = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    const day = date.getDay();
    // Monday is the start of the week
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(date.setDate(diff));
    
    const startDay = String(startOfWeek.getDate()).padStart(2, '0');
    const startMonth = String(startOfWeek.getMonth() + 1).padStart(2, '0');
    return `Sem. ${startDay}/${startMonth}`;
  };

  // Helper to get month name key
  const getMonthName = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    const months = [
      "Ene", "Feb", "Mar", "Abr", "May", "Jun", 
      "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
    ];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  // 1. Procesar datos para Recharts (Agrupar por fecha y crear llaves por proceso)
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
    
    // Soportar 'chapter' (nuevo) o 'process_name' (anterior)
    const procName = dp.chapter || dp.process_name || "Otros";
    processes.add(procName);
    
    // Sumar si hay múltiples tareas del mismo proceso en el mismo período
    const currentVal = (chartDataMap[groupKey][procName] as number) || 0;
    chartDataMap[groupKey][procName] = currentVal + dp.budget_required;
    
    // Guardar nombres de tareas para el tooltip
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
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6 relative z-10">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span className="w-2 h-6 bg-[var(--color-accent)] rounded-full inline-block"></span>
            Flujo de Caja Detallado
          </h2>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1 ml-4">
            Análisis granular de inversión alapado en cronograma vs. presupuesto.
          </p>
        </div>

        {/* Capsule Selector */}
        <div className="flex items-center gap-1.5 bg-[var(--color-bg)] p-1 rounded-full border border-[var(--color-border)] self-stretch xl:self-auto justify-center">
          <button
            onClick={() => setGrouping("daily")}
            className={`min-w-[110px] px-6 py-2.5 rounded-full text-xs font-black transition-all whitespace-nowrap cursor-pointer flex items-center justify-center shrink-0 ${
              grouping === "daily"
                ? "bg-[var(--color-primary)] text-white shadow-sm"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
            }`}
          >
            Diario
          </button>
          <button
            onClick={() => setGrouping("weekly")}
            className={`min-w-[110px] px-6 py-2.5 rounded-full text-xs font-black transition-all whitespace-nowrap cursor-pointer flex items-center justify-center shrink-0 ${
              grouping === "weekly"
                ? "bg-[var(--color-primary)] text-white shadow-sm"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
            }`}
          >
            Semanal
          </button>
          <button
            onClick={() => setGrouping("monthly")}
            className={`min-w-[110px] px-6 py-2.5 rounded-full text-xs font-black transition-all whitespace-nowrap cursor-pointer flex items-center justify-center shrink-0 ${
              grouping === "monthly"
                ? "bg-[var(--color-primary)] text-white shadow-sm"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
            }`}
          >
            Mensual
          </button>
        </div>

        <div className="text-left xl:text-right">
          <p className="text-xs text-[var(--color-text-secondary)] uppercase font-semibold tracking-wider mb-1">
            Presupuesto Total
          </p>
          <p className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)]">
            {formatCurrency(totalBudget)}
          </p>
        </div>
      </div>

      <div className="w-full min-w-0 h-[450px] relative z-10">
        {mounted && (
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
        )}
      </div>
    </div>
  );
}
