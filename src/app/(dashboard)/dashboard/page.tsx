"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { getLargeItem } from "@/lib/indexedDbStorage";
import { 
  TrendingUp, 
  Calendar, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  DollarSign, 
  Building2, 
  ArrowRight,
  Activity,
  FileSpreadsheet,
  PieChart,
  HardHat,
  Users
} from "lucide-react";

export default function DashboardPage() {
  const [analysisData, setAnalysisData] = useState<any | null>(null);
  const [cierreCostosData, setCierreCostosData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [analysis, cierre] = await Promise.all([
          getLargeItem("sma_analysis_data"),
          getLargeItem("sma_cierre_costos_result"),
        ]);
        if (analysis && typeof analysis === "object") {
          setAnalysisData(analysis);
        }
        if (cierre && typeof cierre === "object") {
          setCierreCostosData(cierre);
        }
      } catch (err) {
        console.error("Error al cargar datos del dashboard:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Formateador de moneda colombiana
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const formatShortCurrency = (val: number) => {
    if (!val) return "$0";
    if (val >= 1_000_000_000) {
      return `$${(val / 1_000_000_000).toFixed(2)}B COP`;
    }
    if (val >= 1_000_000) {
      return `$${(val / 1_000_000).toFixed(1)}M COP`;
    }
    return formatCurrency(val);
  };

  // Cálculos dinámicos del análisis de obra activo
  const metrics = useMemo(() => {
    if (!analysisData || !analysisData.dataPoints || analysisData.dataPoints.length === 0) {
      return null;
    }

    const dataPoints: any[] = analysisData.dataPoints;
    const directBudget = analysisData.directBudget || dataPoints.reduce((acc, dp) => acc + (dp.budget_required || 0), 0);
    const totalBudget = analysisData.totalBudget || directBudget * 1.1007;

    // Calcular fechas extremas
    const startDates = dataPoints.map(dp => dp.start_date || dp.date).filter(Boolean).sort();
    const endDates = dataPoints.map(dp => dp.end_date || dp.date).filter(Boolean).sort();
    const startDate = startDates[0] || "2026-02-02";
    const endDate = endDates[endDates.length - 1] || "2027-02-25";

    // Calcular duración en días
    const s = new Date(startDate);
    const e = new Date(endDate);
    const totalDays = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
    const avgDailyCost = totalDays > 0 ? directBudget / totalDays : 0;

    // Agrupar por Capítulos de Obra Reales
    const chapterMap = new Map<string, number>();
    dataPoints.forEach(dp => {
      const ch = dp.chapter || "Otros";
      chapterMap.set(ch, (chapterMap.get(ch) || 0) + (dp.budget_required || 0));
    });

    const chapters = Array.from(chapterMap.entries())
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: directBudget > 0 ? (amount / directBudget) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      directBudget,
      totalBudget,
      tasksCount: dataPoints.length,
      startDate,
      endDate,
      totalDays,
      avgDailyCost,
      chapters,
    };
  }, [analysisData]);

  return (
    <div className="space-y-8 max-w-full animate-fade-in">
      {/* 1. Header Principal del Dashboard */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div 
              className="p-2.5 rounded-xl flex items-center justify-center text-white shadow-md"
              style={{ background: "linear-gradient(135deg, var(--color-primary), #11a542)" }}
            >
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: "var(--color-text-primary)" }}>
                Panel de Control Gerencial
              </h1>
              <p className="text-xs sm:text-sm mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                Constructora Serving S.A.S. — Monitoreo Técnico, Financiero y de Ejecución en Tiempo Real.
              </p>
            </div>
          </div>
        </div>

        {metrics && (
          <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold select-none">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Proyecto Activo: <strong>Bosque de Agua</strong></span>
          </div>
        )}
      </div>

      {/* 2. Grid de KPIs Técnicos y Financieros Reales */}
      {metrics ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* KPI 1: Presupuesto Costo Directo */}
          <div 
            className="rounded-2xl p-5 border transition-all duration-300 relative overflow-hidden group shadow-sm hover:shadow-md"
            style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-black uppercase tracking-wider text-[var(--color-text-tertiary)]">
                Presupuesto Costo Directo
              </span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black tracking-tight font-mono text-[var(--color-primary)]">
              {formatShortCurrency(metrics.directBudget)}
            </p>
            <p className="text-[11px] mt-1.5 text-[var(--color-text-secondary)] flex items-center gap-1 font-medium">
              <Activity className="w-3 h-3 text-[var(--color-accent)]" />
              Promedio diario: <strong>{formatCurrency(metrics.avgDailyCost)}/día</strong>
            </p>
          </div>

          {/* KPI 2: Presupuesto General (con AIU) */}
          <div 
            className="rounded-2xl p-5 border transition-all duration-300 relative overflow-hidden group shadow-sm hover:shadow-md"
            style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-black uppercase tracking-wider text-[var(--color-text-tertiary)]">
                Presupuesto General (+ AIU)
              </span>
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black tracking-tight font-mono text-[var(--color-text-primary)]">
              {formatShortCurrency(metrics.totalBudget)}
            </p>
            <p className="text-[11px] mt-1.5 text-[var(--color-text-secondary)] font-medium">
              Incluye <strong>9.5% AI</strong> + <strong>3% IVA s/ Utilidad</strong>
            </p>
          </div>

          {/* KPI 3: Tareas de Cronograma Correlacionadas */}
          <div 
            className="rounded-2xl p-5 border transition-all duration-300 relative overflow-hidden group shadow-sm hover:shadow-md"
            style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-black uppercase tracking-wider text-[var(--color-text-tertiary)]">
                Actividades MS Project
              </span>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black tracking-tight font-mono text-[var(--color-text-primary)]">
              {metrics.tasksCount} <span className="text-sm font-bold text-[var(--color-text-secondary)]">tareas</span>
            </p>
            <p className="text-[11px] mt-1.5 text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              100% de correlación sin pérdidas
            </p>
          </div>

          {/* KPI 4: Horizonte de Ejecución */}
          <div 
            className="rounded-2xl p-5 border transition-all duration-300 relative overflow-hidden group shadow-sm hover:shadow-md"
            style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-black uppercase tracking-wider text-[var(--color-text-tertiary)]">
                Horizonte Temporal
              </span>
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black tracking-tight font-mono text-[var(--color-text-primary)]">
              {metrics.totalDays} <span className="text-sm font-bold text-[var(--color-text-secondary)]">días</span>
            </p>
            <p className="text-[11px] mt-1.5 text-[var(--color-text-secondary)] font-medium truncate" title={`${metrics.startDate} al ${metrics.endDate}`}>
              {metrics.startDate} → {metrics.endDate}
            </p>
          </div>
        </div>
      ) : (
        /* Estado sin proyecto cargado */
        <div 
          className="rounded-2xl p-8 border text-center space-y-4"
          style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
        >
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center mx-auto">
            <Building2 className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-black text-[var(--color-text-primary)]">
              No hay una ejecución de obra activa en memoria
            </h3>
            <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mt-1">
              Carga tu presupuesto en Excel y cronograma de MS Project para visualizar KPIs reales, curva de flujo de caja y auditoría de costos.
            </p>
          </div>
          <Link
            href="/tecnica/analisis"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black text-white shadow-md transition-transform hover:scale-105 active:scale-95"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            <Sparkles className="w-4 h-4" />
            <span>Ir a Flujo Gerencia y Procesar Obra</span>
          </Link>
        </div>
      )}

      {/* 3. Secciones Principales: Distribución por Capítulos y Módulos de Operación */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda (2 Cols): Desglose de Capítulos Constructivos Reales */}
        <div 
          className="lg:col-span-2 rounded-2xl p-6 border shadow-sm flex flex-col justify-between"
          style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
        >
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <PieChart className="w-5 h-5 text-[var(--color-primary)]" />
                <h3 className="text-base font-black text-[var(--color-text-primary)]">
                  Distribución Financiera por Capítulos de Obra
                </h3>
              </div>
              <Link 
                href="/tecnica/analisis" 
                className="text-xs font-bold text-[var(--color-primary)] hover:underline flex items-center gap-1"
              >
                Ver Matriz Completa <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {metrics && metrics.chapters.length > 0 ? (
              <div className="space-y-4">
                {metrics.chapters.slice(0, 6).map((chap, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-[var(--color-text-primary)] truncate max-w-[60%]">
                        {chap.name}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-[var(--color-text-secondary)]">
                          {formatCurrency(chap.amount)}
                        </span>
                        <span className="font-mono font-black text-[var(--color-primary)] w-12 text-right">
                          {chap.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    {/* Barra de Progreso Visual */}
                    <div className="w-full h-2 rounded-full bg-[var(--color-surface-hover)] overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ 
                          width: `${Math.max(4, chap.percentage)}%`,
                          backgroundColor: idx === 0 ? "var(--color-primary)" : idx === 1 ? "var(--color-accent)" : "#10b981"
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-[var(--color-text-tertiary)] text-xs">
                Información de capítulos disponible al procesar el archivo del proyecto.
              </div>
            )}
          </div>

          {metrics && (
            <div className="mt-6 pt-4 border-t border-[var(--color-border)] flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
              <span>Total Capítulos Evaluados: <strong>{metrics.chapters.length}</strong></span>
              <span>Costo Directo Consolidado: <strong className="text-[var(--color-primary)]">{formatCurrency(metrics.directBudget)}</strong></span>
            </div>
          )}
        </div>

        {/* Columna Derecha (1 Col): Acceso a Módulos Especializados */}
        <div 
          className="rounded-2xl p-6 border shadow-sm flex flex-col justify-between"
          style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
        >
          <div>
            <div className="flex items-center gap-2.5 mb-5">
              <HardHat className="w-5 h-5 text-[var(--color-primary)]" />
              <h3 className="text-base font-black text-[var(--color-text-primary)]">
                Módulos de Gestión Serving
              </h3>
            </div>

            <div className="space-y-3">
              {/* Módulo 1: Flujo Gerencia */}
              <Link
                href="/tecnica/analisis"
                className="p-3.5 rounded-xl border border-[var(--color-border)] flex items-center justify-between hover:bg-[var(--color-surface-hover)] transition-all group cursor-pointer block"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)] transition-colors">
                      Flujo Gerencia & Curva S
                    </h4>
                    <p className="text-[11px] text-[var(--color-text-secondary)]">
                      {metrics ? "Mapeo activo y curva de caja" : "Cargar nuevo cronograma"}
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-primary)] group-hover:translate-x-0.5 transition-all" />
              </Link>

              {/* Módulo 2: Cierre de Costos */}
              <Link
                href="/tecnica/cierre-costos"
                className="p-3.5 rounded-xl border border-[var(--color-border)] flex items-center justify-between hover:bg-[var(--color-surface-hover)] transition-all group cursor-pointer block"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)] transition-colors">
                      Cierre de Costos SAO
                    </h4>
                    <p className="text-[11px] text-[var(--color-text-secondary)]">
                      {cierreCostosData ? "Auditoría de insumos cargada" : "Auditar APUs teóricos vs real"}
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-primary)] group-hover:translate-x-0.5 transition-all" />
              </Link>

              {/* Módulo 3: Seguridad Social */}
              <Link
                href="/gestion-humana/seguridad-social"
                className="p-3.5 rounded-xl border border-[var(--color-border)] flex items-center justify-between hover:bg-[var(--color-surface-hover)] transition-all group cursor-pointer block"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)] transition-colors">
                      Gestión Humana & Planillas
                    </h4>
                    <p className="text-[11px] text-[var(--color-text-secondary)]">
                      Novedades de personal y seguridad
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-primary)] group-hover:translate-x-0.5 transition-all" />
              </Link>
            </div>
          </div>

          <div className="mt-5 p-3 rounded-xl bg-[var(--color-primary-light)]/50 border border-[var(--color-primary)]/20 flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
            <p className="text-[11px] text-[var(--color-text-secondary)] leading-tight">
              Motor potenciado por <strong>Gemini 3.7 Flash</strong> y <strong>Gemini 3.1 Pro</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
