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

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-panel p-4 rounded-[var(--radius-sm)] shadow-lg">
          <p className="font-bold mb-1">{label}</p>
          <p className="text-sm mb-1 text-[var(--color-text-secondary)]">
            Hito/Tarea: <span className="font-semibold text-[var(--color-text-primary)]">{payload[0].payload.task_name}</span>
          </p>
          <p className="text-sm font-bold text-[var(--color-warning)]">
            Costo: {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="glass-card p-6 rounded-[var(--radius-lg)] h-full flex flex-col relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-primary)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      <div className="flex justify-between items-start mb-6 relative z-10">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span className="w-2 h-6 bg-[var(--color-accent)] rounded-full inline-block"></span>
            Flujo de Presupuesto Proyectado
          </h2>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1 ml-4">
            Correlación inteligente de fechas de obra vs. costos.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[var(--color-text-secondary)] uppercase font-semibold tracking-wider mb-1">
            Presupuesto Analizado
          </p>
          <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)]">
            {formatCurrency(totalBudget)}
          </p>
        </div>
      </div>

      <div className="flex-1 w-full min-h-[400px] relative z-10">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 40, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" strokeOpacity={0.4} />
            <XAxis 
              dataKey="date" 
              tick={{ fill: "var(--color-text-secondary)", fontSize: 12, fontWeight: 500 }}
              tickMargin={12}
              axisLine={{ stroke: "var(--color-border)" }}
              tickLine={false}
            />
            <YAxis 
              tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
              tick={{ fill: "var(--color-text-secondary)", fontSize: 12, fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              tickMargin={12}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-surface-hover)', opacity: 0.4 }} />
            <Legend wrapperStyle={{ paddingTop: "20px" }} />
            <Bar 
              dataKey="budget_required" 
              name="Presupuesto Requerido" 
              fill="var(--color-accent)" 
              radius={[6, 6, 0, 0]}
              animationDuration={1500}
              animationEasing="ease-out"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
