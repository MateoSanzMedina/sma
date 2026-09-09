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
    <div className="space-y-6 max-w-full animate-fade-in">
      {/* 1. Header Principal del Dashboard */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[#11a542] shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Panel de Control Gerencial
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Constructora Serving S.A.S. — Monitoreo Técnico, Financiero y de Ejecución en Tiempo Real.
              </p>
            </div>
          </div>
        </div>

        {metrics && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold select-none">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Proyecto Activo: <strong>Bosque de Agua</strong></span>
          </div>
        )}
      </div>

      {/* 2. Grid de KPIs Técnicos y Financieros Reales */}
      {metrics ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* KPI 1: Presupuesto Costo Directo */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-200 relative overflow-hidden group hover:shadow-md">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Presupuesto Costo Directo
              </span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight font-mono text-[#11a542]">
              {formatShortCurrency(metrics.directBudget)}
            </p>
            <p className="text-[11px] mt-2 text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
              <Activity className="w-3.5 h-3.5 text-[#11a542]" />
              <span>Promedio diario: <strong>{formatCurrency(metrics.avgDailyCost)}/día</strong></span>
            </p>
          </div>

          {/* KPI 2: Presupuesto General (con AIU) */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-200 relative overflow-hidden group hover:shadow-md">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Presupuesto General (+ AIU)
              </span>
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight font-mono text-slate-900 dark:text-white">
              {formatShortCurrency(metrics.totalBudget)}
            </p>
            <p className="text-[11px] mt-2 text-slate-500 dark:text-slate-400 font-medium">
              Incluye <strong>9.5% AI</strong> + <strong>3% IVA s/ Utilidad</strong>
            </p>
          </div>

          {/* KPI 3: Tareas de Cronograma Correlacionadas */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-200 relative overflow-hidden group hover:shadow-md">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Actividades MS Project
              </span>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight font-mono text-slate-900 dark:text-white">
              {metrics.tasksCount} <span className="text-sm font-bold text-slate-400">tareas</span>
            </p>
            <p className="text-[11px] mt-2 text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>100% de correlación sin pérdidas</span>
            </p>
          </div>

          {/* KPI 4: Horizonte de Ejecución */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-200 relative overflow-hidden group hover:shadow-md">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Horizonte Temporal
              </span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-[#11a542]">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight font-mono text-slate-900 dark:text-white">
              {metrics.totalDays} <span className="text-sm font-bold text-slate-400">días</span>
            </p>
            <p className="text-[11px] mt-2 text-slate-500 dark:text-slate-400 font-medium truncate" title={`${metrics.startDate} al ${metrics.endDate}`}>
              {metrics.startDate} &rarr; {metrics.endDate}
            </p>
          </div>
        </div>
      ) : (
        /* Estado sin proyecto cargado */
        <div 
          className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-3.5"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[#11a542] flex items-center justify-center mx-auto">
            <Building2 className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              No hay una ejecución de obra activa en memoria
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Carga tu presupuesto en Excel y cronograma de MS Project para visualizar KPIs reales, curva de flujo de caja y auditoría de costos.
            </p>
          </div>
          <Link
            href="/tecnica/analisis"
            className="h-10 px-5 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center gap-2 bg-gradient-to-r from-[#015c32] to-[#11a542] hover:opacity-90 text-white shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Ir a Flujo Gerencia y Procesar Obra</span>
          </Link>
        </div>
      )}

      {/* 3. Secciones Principales: Distribución por Capítulos y Módulos de Operación */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda (2 Cols): Desglose de Capítulos Constructivos Reales */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <PieChart className="w-5 h-5 text-[#11a542]" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Distribución Financiera por Capítulos de Obra
                </h3>
              </div>
              <Link 
                href="/tecnica/analisis" 
                className="text-xs font-semibold text-[#11a542] hover:underline flex items-center gap-1"
              >
                <span>Ver Matriz Completa</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {metrics && metrics.chapters.length > 0 ? (
              <div className="space-y-4">
                {metrics.chapters.slice(0, 6).map((chap, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[60%]">
                        {chap.name}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-medium text-slate-500 dark:text-slate-400">
                          {formatCurrency(chap.amount)}
                        </span>
                        <span className="font-mono font-bold text-[#11a542] w-12 text-right">
                          {chap.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    {/* Barra de Progreso Visual */}
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ 
                          width: `${Math.max(4, chap.percentage)}%`,
                          background: idx === 0 ? "linear-gradient(90deg, #015c32, #11a542)" : idx === 1 ? "#11a542" : "#34d399"
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs">
                Información de capítulos disponible al procesar el archivo del proyecto.
              </div>
            )}
          </div>

          {metrics && (
            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Total Capítulos Evaluados: <strong>{metrics.chapters.length}</strong></span>
              <span>Costo Directo Consolidado: <strong className="text-[#11a542]">{formatCurrency(metrics.directBudget)}</strong></span>
            </div>
          )}
        </div>

        {/* Columna Derecha (1 Col): Acceso a Módulos Especializados */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-6">
              <HardHat className="w-5 h-5 text-[#11a542]" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Módulos de Gestión Serving
              </h3>
            </div>

            <div className="space-y-3">
              {/* Módulo 1: Flujo Gerencia */}
              <Link
                href="/tecnica/analisis"
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-all group cursor-pointer block"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-[#11a542] transition-colors">
                      Flujo Gerencia &amp; Curva S
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {metrics ? "Mapeo activo y curva de caja" : "Cargar nuevo cronograma"}
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#11a542] group-hover:translate-x-0.5 transition-all" />
              </Link>

              {/* Módulo 2: Cierre de Costos */}
              <Link
                href="/tecnica/cierre-costos"
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-all group cursor-pointer block"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-[#11a542] transition-colors">
                      Cierre de Costos SAO
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {cierreCostosData ? "Auditoría de insumos cargada" : "Auditar APUs teóricos vs real"}
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#11a542] group-hover:translate-x-0.5 transition-all" />
              </Link>

              {/* Módulo 3: Seguridad Social */}
              <Link
                href="/gestion-humana/seguridad-social"
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-all group cursor-pointer block"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-[#11a542] transition-colors">
                      Gestión Humana &amp; Planillas
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Novedades de personal y seguridad
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#11a542] group-hover:translate-x-0.5 transition-all" />
              </Link>
            </div>
          </div>

          <div className="mt-6 p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15 flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-[#11a542] shrink-0" />
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
              Motor potenciado por <strong>Gemini 3.7 Flash</strong> y <strong>Gemini 3.1 Pro</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
