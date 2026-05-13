"use client";

import React from "react";
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
}

interface BudgetTimelineChartProps {
  data: DataPoint[];
  totalBudget: number;
}

export default function BudgetTimelineChart({ data, totalBudget }: BudgetTimelineChartProps) {
  // Formatear moneda a pesos (COP o genérico)
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(value);
  };

  // 1. Procesar datos para Recharts (Agrupar por fecha y crear llaves por proceso)
  const chartDataMap: { [key: string]: any } = {};
  const processes = new Set<string>();

  data.forEach((dp: any) => {
    if (!chartDataMap[dp.date]) {
      chartDataMap[dp.date] = { date: dp.date };
    }
    // Soportar 'chapter' (nuevo) o 'process_name' (anterior)
    const procName = dp.chapter || dp.process_name || "Otros";
    processes.add(procName);
    
    // Sumar si hay múltiples tareas del mismo proceso en el mismo día
    chartDataMap[dp.date][procName] = (chartDataMap[dp.date][procName] || 0) + dp.budget_required;
    
    // Guardar nombres de tareas para el tooltip
    if (!chartDataMap[dp.date].tasks) chartDataMap[dp.date].tasks = {};
    if (!chartDataMap[dp.date].tasks[procName]) chartDataMap[dp.date].tasks[procName] = [];
    chartDataMap[dp.date].tasks[procName].push(dp.task_name);
  });

  const chartData = Object.values(chartDataMap).sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const processList = Array.from(processes);
  const colors = [
    "var(--color-primary)", 
    "var(--color-accent)", 
    "var(--color-warning)", 
    "#10b981", "#8b5cf6", "#f59e0b", "#06b6d4"
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div 
          className="p-4 rounded-lg shadow-xl max-w-md"
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border-strong)",
          }}
        >
          <p className="font-bold mb-2 border-b border-border pb-2" style={{ color: "var(--color-text-primary)" }}>
            Fecha: {label}
          </p>
          <div className="space-y-3">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex flex-col">
                <div className="flex justify-between items-center gap-4">
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: entry.color }}>
                    {entry.name}
                  </span>
                  <span className="font-mono text-sm" style={{ color: "var(--color-text-primary)" }}>
                    {formatCurrency(entry.value)}
                  </span>
                </div>
                <div className="mt-1 pl-2 border-l-2" style={{ borderColor: entry.color }}>
                  <p className="text-[10px] italic leading-tight" style={{ color: "var(--color-text-secondary)" }}>
                    {chartDataMap[label]?.tasks?.[entry.name]?.join(", ") || "Múltiples tareas"}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-2 border-t border-border flex justify-between">
            <span className="text-xs font-bold" style={{ color: "var(--color-text-secondary)" }}>TOTAL DÍA</span>
            <span className="font-bold" style={{ color: "var(--color-warning)" }}>
              {formatCurrency(payload.reduce((sum: number, e: any) => sum + e.value, 0))}
            </span>
          </div>
        </div>
      );
    }
    return null;
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
      <div className="flex justify-between items-start mb-6 relative z-10">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span className="w-2 h-6 bg-[var(--color-accent)] rounded-full inline-block"></span>
            Flujo de Caja Detallado (Por Día y Proceso)
          </h2>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1 ml-4">
            Análisis granular de inversión basado en cronograma vs. presupuesto.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[var(--color-text-secondary)] uppercase font-semibold tracking-wider mb-1">
            Presupuesto Total
          </p>
          <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)]">
            {formatCurrency(totalBudget)}
          </p>
        </div>
      </div>

      <div className="flex-1 w-full min-h-[450px] relative z-10">
        <ResponsiveContainer width="100%" height="100%">
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
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-surface-hover)', opacity: 0.4 }} />
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
              fill="var(--color-surface)"
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
                animationDuration={1500}
                animationEasing="ease-out"
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
