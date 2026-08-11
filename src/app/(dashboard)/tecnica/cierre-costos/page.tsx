"use client";

import React, { useState, useCallback } from "react";
import { 
  UploadCloud, 
  FileSpreadsheet, 
  Loader2, 
  AlertTriangle, 
  Search, 
  Info, 
  TrendingUp, 
  TrendingDown,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Download,
  CheckCircle2,
  XCircle
} from "lucide-react";

interface Resource {
  insumo: string;
  name: string;
  unit: string;
  base_qty: number;
  base_unit_qty: number;
  base_price: number;
  base_subtotal: number;
  ejec_qty: number;
  ejec_unit_qty: number;
  ejec_price: number;
  ejec_subtotal: number;
  excel_faltante_qty: number;
  excel_faltante_unit_qty: number;
  excel_faltante_price: number;
  excel_faltante_subtotal: number;
  proj_theo: {
    qty: number;
    cost: number;
    dev_qty: number;
    dev_cost: number;
  };
  proj_hist: {
    qty: number;
    cost: number;
    dev_qty: number;
    dev_cost: number;
  };
}

interface ConcreteValidationItem {
  apu_code: string;
  apu_name: string;
  ficha_title: string;
  cemento_reg: number;
  arena_reg: number;
  triturado_reg: number;
  cemento_expected_arena: number;
  cemento_expected_triturado: number;
  dev_pct_arena: number;
  dev_pct_triturado: number;
  status: "OK" | "Revisar";
}

interface APUItem {
  code: string;
  name: string;
  unit: string;
  base_qty: number;
  ejec_qty: number;
  faltante_qty_teorica: number;
  obra_faltante_qty: number;
  resources: Resource[];
}

interface CostsResult {
  summary: {
    project_name: string;
    total_base: number;
    total_ejec: number;
    total_proj_theo: number;
    total_proj_hist: number;
    dev_proj_theo: number;
    dev_proj_hist: number;
    total_items: number;
    total_alerts: number;
    total_reutilizations: number;
    total_concrete_audits?: number;
  };
  alerts: {
    type: "danger" | "warning";
    title: string;
    message: string;
    apu_code: string;
    insumo_code: string;
  }[];
  reutilizaciones: {
    insumo_code: string;
    insumo_name: string;
    unit: string;
    from_apu_code: string;
    from_apu_name: string;
    to_apu_code: string;
    to_apu_name: string;
    qty: number;
    message: string;
  }[];
  concrete_validation?: ConcreteValidationItem[];
  details: APUItem[];
  excel_b64?: string;
}

export default function CierreCostosPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CostsResult | null>(null);
  const [projectionMode, setProjectionMode] = useState<"historical" | "theoretical">("historical");
  const [searchTerm, setSearchTerm] = useState("");
  const [onlyAlerts, setOnlyAlerts] = useState(false);
  const [expandedApus, setExpandedApus] = useState<Record<string, boolean>>({});

  const handleFileDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      setError("Por favor sube el archivo de costos de SAO.");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/payroll/costs", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Ocurrió un error al procesar el cierre de costos.");
      }

      setResult(data.data);
      const initialExpanded: Record<string, boolean> = {};
      data.data.details.forEach((apu: APUItem) => {
        initialExpanded[apu.code] = false;
      });
      setExpandedApus(initialExpanded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = () => {
    if (!result?.excel_b64) return;
    try {
      const byteCharacters = atob(result.excel_b64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Cierre_Costos_Procesado_${result.summary.project_name || "SMA"}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      console.error("Error al descargar el archivo Excel:", e);
    }
  };

  const toggleApu = (code: string) => {
    setExpandedApus(prev => ({
      ...prev,
      [code]: !prev[code]
    }));
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0
    }).format(val);
  };

  const filteredApus = result
    ? result.details.filter(apu => {
        const matchesSearch = 
          apu.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
          apu.code.includes(searchTerm) ||
          apu.resources.some(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const hasAlert = apu.resources.some(r => {
          const costDev = projectionMode === "historical" ? r.proj_hist?.dev_cost : r.proj_theo?.dev_cost;
          return costDev && costDev > 500000;
        });

        const matchesAlertFilter = !onlyAlerts || hasAlert;
        return matchesSearch && matchesAlertFilter;
      })
    : [];

  return (
    <div className="space-y-8 max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span 
              className="material-symbols-outlined text-4xl"
              style={{ color: "var(--color-primary)" }}
            >
              construction
            </span>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight" style={{ color: "var(--color-text-primary)" }}>
              Control y Cierre de Costos (SAO)
            </h1>
          </div>
          <p className="text-base mt-2" style={{ color: "var(--color-text-secondary)" }}>
            Monitorea desviaciones de rendimientos unitarios, proyecta sobrantes de materiales y concilia APUs de obra.
          </p>
        </div>

        {result?.excel_b64 && (
          <button
            onClick={downloadExcel}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-white transition-all shadow-md hover:shadow-lg active:scale-95 cursor-pointer shrink-0"
            style={{
              background: "linear-gradient(135deg, #10B981, #059669)",
            }}
          >
            <Download className="w-5 h-5" />
            Descargar Excel Procesado (.xlsx)
          </button>
        )}
      </div>

      {/* Main Upload and Info Section */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
        {/* Upload File Panel */}
        <div className="xl:col-span-2 flex flex-col">
          <div 
            className="rounded-xl p-6 sm:p-8 flex flex-col justify-between min-h-[400px]"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              boxShadow: "var(--shadow-md)",
            }}
          >
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>
                  Cargar Costos por Niveles
                </h2>
                <p className="text-xs mt-1" style={{ color: "var(--color-text-secondary)" }}>
                  Sube la planilla Excel de análisis de costos quincenales para procesar las desviaciones.
                </p>
              </div>

              {error && (
                <div 
                  className="p-4 rounded-lg text-sm border flex items-start gap-2.5" 
                  style={{ 
                    backgroundColor: "rgba(239, 68, 68, 0.05)", 
                    color: "var(--color-error)",
                    borderColor: "rgba(239, 68, 68, 0.15)"
                  }}
                >
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Excel Dropzone */}
              <div className="space-y-1.5">
                <div
                  className={`relative border border-dashed rounded-xl p-6 text-center transition-all duration-300 flex flex-col justify-center items-center h-40 cursor-pointer ${
                    file ? "bg-emerald-500/5" : "hover:bg-white/5"
                  }`}
                  style={{
                    borderColor: file ? "var(--color-primary)" : "var(--color-border)",
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                  onClick={() => document.getElementById("file-input")?.click()}
                >
                  <input
                    id="file-input"
                    type="file"
                    className="hidden"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                  />
                  {file ? (
                    <div className="flex flex-col items-center justify-center text-center">
                      <FileSpreadsheet className="w-10 h-10 mb-3" style={{ color: "var(--color-primary)" }} />
                      <span className="font-bold text-sm truncate max-w-xs" style={{ color: "var(--color-text-primary)" }}>
                        {file.name}
                      </span>
                      <span className="text-[10px] mt-1" style={{ color: "var(--color-text-secondary)" }}>
                        Click para cambiar archivo
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <UploadCloud className="w-9 h-9 mb-2" style={{ color: "var(--color-text-tertiary)" }} />
                      <p className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
                        Arrastra o haz clic para subir Excel
                      </p>
                      <p className="text-[10px] mt-1" style={{ color: "var(--color-text-tertiary)" }}>
                        Planilla SAO Costos por Niveles (XLSX, XLS)
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading || !file}
              className="w-full mt-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed select-none text-white shadow-sm"
              style={{
                background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Procesando Costos...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  Analizar Costos de Obra
                </>
              )}
            </button>

            {result?.excel_b64 && (
              <button
                onClick={downloadExcel}
                className="w-full mt-3 py-3 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 active:scale-95 text-white shadow-md hover:shadow-lg"
                style={{
                  background: "linear-gradient(135deg, #10B981, #059669)",
                }}
              >
                <Download className="w-5 h-5" />
                Descargar Excel Final Procesado (.xlsx)
              </button>
            )}
          </div>
        </div>

        {/* Informative Stats & Config */}
        <div className="xl:col-span-3 flex flex-col">
          {!result ? (
            <div 
              className="rounded-xl p-8 flex-1 flex flex-col items-center justify-center text-center relative overflow-hidden group min-h-[400px]"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                boxShadow: "var(--shadow-md)",
              }}
            >
              <div className="w-16 h-16 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center justify-center mb-6">
                <FileSpreadsheet className="w-8 h-8" style={{ color: "var(--color-primary)" }} />
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: "var(--color-text-primary)" }}>
                Validación de Cierre de Costos
              </h3>
              <p className="text-xs max-w-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                Sube el archivo Excel de control de presupuestos para que el motor detecte desviaciones de obra física, proyecciones de costo a fin de obra y sugiera reutilización de materiales sobrantes.
              </p>
              <div className="mt-6 flex gap-3 text-left max-w-md rounded-xl p-3.5 bg-emerald-500/5 border border-emerald-500/10 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                <Info className="w-5 h-5 flex-shrink-0 text-[var(--color-primary)]" />
                <span>Al procesar el archivo, podrás **descargar la versión completada en Excel** con las 7 columnas de fórmulas y la pestaña de mezclas de concreto.</span>
              </div>
            </div>
          ) : (
            /* Results Summary Dashboard */
            <div className="space-y-6 flex-1 flex flex-col justify-between">
              {/* Dynamic Projection Toggle Card */}
              <div 
                className="rounded-xl p-5 border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Método de Proyección de Cierre</h3>
                    <div className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/10 text-[var(--color-primary)] border border-emerald-500/20">
                      Configurable
                    </div>
                  </div>
                  <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                    {projectionMode === "historical" 
                      ? "Proyección Histórica: Calcula el faltante manteniendo los rendimientos reales de obra ejecutados."
                      : "Proyección Teórica: Calcula el faltante asumiendo rendimientos unitarios ideales del presupuesto base."}
                  </p>
                </div>

                <div className="flex border rounded-xl overflow-hidden shrink-0" style={{ borderColor: "var(--color-border)" }}>
                  <button
                    onClick={() => setProjectionMode("historical")}
                    className={`px-4 py-2 text-xs font-black transition-all cursor-pointer select-none ${
                      projectionMode === "historical" ? "text-white" : "hover:bg-white/5"
                    }`}
                    style={{
                      backgroundColor: projectionMode === "historical" ? "var(--color-primary)" : "transparent",
                    }}
                  >
                    Histórica (Real)
                  </button>
                  <button
                    onClick={() => setProjectionMode("theoretical")}
                    className={`px-4 py-2 text-xs font-black transition-all cursor-pointer select-none ${
                      projectionMode === "theoretical" ? "text-white" : "hover:bg-white/5"
                    }`}
                    style={{
                      backgroundColor: projectionMode === "theoretical" ? "var(--color-primary)" : "transparent",
                    }}
                  >
                    Teórica (Ideal)
                  </button>
                </div>
              </div>

              {/* KPI Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div 
                  className="rounded-xl p-4 border flex flex-col justify-between"
                  style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)" }}>Costo Base Total</p>
                  <p className="text-xl font-black mt-1" style={{ color: "var(--color-text-primary)" }}>{formatCurrency(result.summary.total_base)}</p>
                  <p className="text-[9px] mt-1" style={{ color: "var(--color-text-tertiary)" }}>{result.summary.total_items} actividades APU</p>
                </div>

                <div 
                  className="rounded-xl p-4 border flex flex-col justify-between"
                  style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)" }}>Ejecución Real</p>
                  <p className="text-xl font-black mt-1" style={{ color: "var(--color-text-primary)" }}>{formatCurrency(result.summary.total_ejec)}</p>
                  <p className="text-[9px] mt-1" style={{ color: "var(--color-text-tertiary)" }}>
                    {((result.summary.total_ejec / (result.summary.total_base || 1)) * 100).toFixed(1)}% avance costo
                  </p>
                </div>

                <div 
                  className="rounded-xl p-4 border flex flex-col justify-between"
                  style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)" }}>Proyección Final</p>
                  <p className="text-xl font-black mt-1" style={{ color: "var(--color-text-primary)" }}>
                    {formatCurrency(projectionMode === "historical" ? result.summary.total_proj_hist : result.summary.total_proj_theo)}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    {(() => {
                      const dev = projectionMode === "historical" ? result.summary.dev_proj_hist : result.summary.dev_proj_theo;
                      return (
                        <>
                          {dev > 0 ? (
                            <TrendingUp className="w-3.5 h-3.5 text-red-500" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />
                          )}
                          <span className={`text-[9px] font-bold ${dev > 0 ? "text-red-500" : "text-emerald-500"}`}>
                            {dev > 0 ? "+" : ""}{formatCurrency(dev)} ({((dev / (result.summary.total_base || 1)) * 100).toFixed(1)}%)
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Alert Count Banner */}
              <div 
                className="rounded-xl p-4 border flex items-center justify-between text-xs"
                style={{ 
                  backgroundColor: result.summary.total_alerts > 0 ? "rgba(239, 68, 68, 0.03)" : "rgba(17, 165, 66, 0.03)", 
                  borderColor: result.summary.total_alerts > 0 ? "rgba(239, 68, 68, 0.15)" : "rgba(17, 165, 66, 0.15)" 
                }}
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className={`w-4 h-4 ${result.summary.total_alerts > 0 ? "text-red-500" : "text-[var(--color-primary)]"}`} />
                  <span style={{ color: "var(--color-text-secondary)" }}>
                    {result.summary.total_alerts > 0 
                      ? `Se detectaron ${result.summary.total_alerts} alertas críticas por sobrecosto o desviación en mezclas.`
                      : "No se registran sobrecostos críticos en los insumos."}
                  </span>
                </div>
                {result.summary.total_reutilizations > 0 && (
                  <span className="font-bold text-blue-400">
                    {result.summary.total_reutilizations} materiales reutilizables
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Alertas & Reutilizaciones Panels */}
      {result && (result.reutilizaciones.length > 0 || result.alerts.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Reutilization Recommendations */}
          {result.reutilizaciones.length > 0 && (
            <div 
              className="rounded-xl border p-6 space-y-4"
              style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: "var(--color-text-primary)" }}>
                  <span className="material-symbols-outlined text-blue-400" style={{ fontVariationSettings: "'FILL' 1" }}>recycling</span>
                  Recomendaciones de Reutilización
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Eficiencia de Materiales
                </span>
              </div>
              <div className="space-y-3 max-h-[260px] overflow-y-auto pr-2">
                {result.reutilizaciones.map((tip, idx) => (
                  <div 
                    key={idx}
                    className="p-4 rounded-xl border flex items-start gap-3 text-xs leading-relaxed"
                    style={{ backgroundColor: "rgba(59, 130, 246, 0.03)", borderColor: "rgba(59, 130, 246, 0.15)" }}
                  >
                    <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-[var(--color-text-primary)] uppercase">Transferencia de {tip.insumo_name}</p>
                      <p style={{ color: "var(--color-text-secondary)" }} className="mt-1">{tip.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deviation Alerts */}
          {result.alerts.length > 0 && (
            <div 
              className="rounded-xl border p-6 space-y-4"
              style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: "var(--color-text-primary)" }}>
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  Alertas Críticas de Desviación
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-red-500/10 text-red-400 border border-red-500/20">
                  Sobrecostos
                </span>
              </div>
              <div className="space-y-3 max-h-[260px] overflow-y-auto pr-2">
                {result.alerts.map((al, idx) => (
                  <div 
                    key={idx}
                    className="p-4 rounded-xl border flex items-start gap-3 text-xs leading-relaxed animate-fade-in"
                    style={{ 
                      backgroundColor: al.type === "danger" ? "rgba(239, 68, 68, 0.03)" : "rgba(251, 191, 36, 0.03)", 
                      borderColor: al.type === "danger" ? "rgba(239, 68, 68, 0.15)" : "rgba(251, 191, 36, 0.15)" 
                    }}
                  >
                    <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${al.type === "danger" ? "text-red-500" : "text-yellow-500"}`} />
                    <div>
                      <p className="font-bold text-[var(--color-text-primary)] uppercase">{al.title}</p>
                      <p style={{ color: "var(--color-text-secondary)" }} className="mt-1">{al.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Concrete Mix Validation Section */}
      {result && result.concrete_validation && result.concrete_validation.length > 0 && (
        <div 
          className="rounded-xl border p-6 space-y-6"
          style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-md)" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--color-text-primary)" }}>
                <span className="material-symbols-outlined text-amber-500">water_drop</span>
                Validación de Mezclas de Concreto (Cemento vs. Arena y Triturado)
              </h3>
              <p className="text-xs mt-1" style={{ color: "var(--color-text-secondary)" }}>
                Compara el Cemento registrado en el APU contra el Cemento teórico esperable según las dosificaciones de Arena y Triturado. (Tolerancia: ±15%).
              </p>
            </div>

            <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20">
              {result.concrete_validation.length} APUs Auditados
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--color-border)" }}>
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[var(--color-surface-hover)] border-b" style={{ borderColor: "var(--color-border)" }}>
                <tr>
                  <th className="px-4 py-3 font-extrabold uppercase text-[var(--color-text-secondary)]">Código APU</th>
                  <th className="px-4 py-3 font-extrabold uppercase text-[var(--color-text-secondary)]">Nombre Actividad</th>
                  <th className="px-4 py-3 font-extrabold uppercase text-[var(--color-text-secondary)]">Ficha Usada</th>
                  <th className="px-4 py-3 font-extrabold uppercase text-[var(--color-text-secondary)] text-right">Cemento Reg. (sc)</th>
                  <th className="px-4 py-3 font-extrabold uppercase text-[var(--color-text-secondary)] text-right">Arena Reg. (m³)</th>
                  <th className="px-4 py-3 font-extrabold uppercase text-[var(--color-text-secondary)] text-right">Triturado Reg. (m³)</th>
                  <th className="px-4 py-3 font-extrabold uppercase text-[var(--color-text-secondary)] text-right">Cto. Esp. (Arena)</th>
                  <th className="px-4 py-3 font-extrabold uppercase text-[var(--color-text-secondary)] text-right">Cto. Esp. (Triturado)</th>
                  <th className="px-4 py-3 font-extrabold uppercase text-[var(--color-text-secondary)] text-right">Dif % Arena</th>
                  <th className="px-4 py-3 font-extrabold uppercase text-[var(--color-text-secondary)] text-right">Dif % Triturado</th>
                  <th className="px-4 py-3 font-extrabold uppercase text-[var(--color-text-secondary)] text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--color-border)" }}>
                {result.concrete_validation.map((item, idx) => (
                  <tr key={idx} className="hover:bg-[var(--color-surface-hover)]/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-[var(--color-primary)]">{item.apu_code}</td>
                    <td className="px-4 py-3 uppercase font-medium" style={{ color: "var(--color-text-primary)" }}>{item.apu_name}</td>
                    <td className="px-4 py-3 font-semibold" style={{ color: "var(--color-text-secondary)" }}>{item.ficha_title}</td>
                    <td className="px-4 py-3 text-right font-mono" style={{ color: "var(--color-text-primary)" }}>{item.cemento_reg.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono" style={{ color: "var(--color-text-secondary)" }}>{item.arena_reg.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono" style={{ color: "var(--color-text-secondary)" }}>{item.triturado_reg.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-500 font-semibold">{item.cemento_expected_arena.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-500 font-semibold">{item.cemento_expected_triturado.toFixed(2)}</td>
                    <td className={`px-4 py-3 text-right font-mono font-bold ${Math.abs(item.dev_pct_arena) > 15 ? "text-red-500" : "text-emerald-500"}`}>
                      {item.dev_pct_arena > 0 ? "+" : ""}{item.dev_pct_arena.toFixed(1)}%
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-bold ${Math.abs(item.dev_pct_triturado) > 15 ? "text-red-500" : "text-emerald-500"}`}>
                      {item.dev_pct_triturado > 0 ? "+" : ""}{item.dev_pct_triturado.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.status === "OK" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" /> OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-red-500/10 text-red-500 border border-red-500/20 animate-pulse">
                          <XCircle className="w-3.5 h-3.5" /> Revisar
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* APU Cost Analysis Table */}
      {result && (
        <div 
          className="rounded-xl border p-6 space-y-6"
          style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-md)" }}
        >
          {/* Table Filters */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <h3 className="text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>
              Análisis Unitario y Proyecciones por APU
            </h3>
            
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto items-stretch sm:items-center">
              {/* Search */}
              <div 
                className="relative flex items-center border rounded-xl px-3 py-2 text-sm bg-transparent w-full sm:w-64"
                style={{ borderColor: "var(--color-border)" }}
              >
                <Search className="w-4 h-4 mr-2" style={{ color: "var(--color-text-tertiary)" }} />
                <input
                  type="text"
                  placeholder="Buscar APU o Insumo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent focus:outline-none w-full text-xs"
                />
              </div>

              {/* Filter Alerts */}
              <label className="flex items-center gap-2 text-xs font-semibold select-none cursor-pointer" style={{ color: "var(--color-text-secondary)" }}>
                <input
                  type="checkbox"
                  checked={onlyAlerts}
                  onChange={(e) => setOnlyAlerts(e.target.checked)}
                  className="rounded border-[var(--color-border)] focus:ring-0 text-[var(--color-primary)] cursor-pointer"
                />
                Solo APUs con sobrecosto
              </label>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--color-border)" }}>
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[var(--color-surface-hover)] border-b" style={{ borderColor: "var(--color-border)" }}>
                <tr>
                  <th className="px-4 py-3 font-extrabold uppercase text-[var(--color-text-secondary)]">Código / Insumo</th>
                  <th className="px-4 py-3 font-extrabold uppercase text-[var(--color-text-secondary)]">Actividad / Recurso</th>
                  <th className="px-4 py-3 font-extrabold uppercase text-[var(--color-text-secondary)] text-center">Und</th>
                  <th className="px-4 py-3 font-extrabold uppercase text-[var(--color-text-secondary)] text-right">Cant. Base</th>
                  <th className="px-4 py-3 font-extrabold uppercase text-[var(--color-text-secondary)] text-right">Cant. Ejecutada</th>
                  <th className="px-4 py-3 font-extrabold uppercase text-[var(--color-text-secondary)] text-right">Cant. Faltante</th>
                  <th className="px-4 py-3 font-extrabold uppercase text-[var(--color-text-secondary)] text-right">Rendimiento Unit.</th>
                  <th className="px-4 py-3 font-extrabold uppercase text-[var(--color-text-secondary)] text-right">Precio Unit.</th>
                  <th className="px-4 py-3 font-extrabold uppercase text-[var(--color-text-secondary)] text-right">Costo Base</th>
                  <th className="px-4 py-3 font-extrabold uppercase text-[var(--color-text-secondary)] text-right">Costo Proyectado</th>
                  <th className="px-4 py-3 font-extrabold uppercase text-[var(--color-text-secondary)] text-right">Desviación Proyectada</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--color-border)" }}>
                {filteredApus.length > 0 ? (
                  filteredApus.map((apu) => {
                    const isExpanded = !!expandedApus[apu.code];
                    
                    const apuBaseCost = apu.resources.reduce((acc, r) => acc + (r.base_qty * r.base_price), 0);
                    const apuProjCost = apu.resources.reduce((acc, r) => {
                      const cost = projectionMode === "historical" ? r.proj_hist?.cost : r.proj_theo?.cost;
                      return acc + (cost || 0);
                    }, 0);
                    const apuCostDev = apuProjCost - apuBaseCost;

                    return (
                      <React.Fragment key={apu.code}>
                        {/* Parent Activity Row */}
                        <tr 
                          onClick={() => toggleApu(apu.code)}
                          className="hover:bg-[var(--color-surface-hover)]/30 transition-colors duration-150 cursor-pointer font-bold bg-[var(--color-bg)]/20"
                        >
                          <td className="px-4 py-4 text-[var(--color-primary)] flex items-center gap-1.5">
                            {isExpanded ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
                            {apu.code}
                          </td>
                          <td className="px-4 py-4 uppercase text-[var(--color-text-primary)] max-w-sm truncate">
                            {apu.name}
                          </td>
                          <td className="px-4 py-4 text-center font-medium" style={{ color: "var(--color-text-secondary)" }}>
                            {apu.unit}
                          </td>
                          <td className="px-4 py-4 text-right font-mono" style={{ color: "var(--color-text-primary)" }}>
                            {apu.base_qty.toLocaleString("es-CO")}
                          </td>
                          <td className="px-4 py-4 text-right font-mono" style={{ color: "var(--color-text-primary)" }}>
                            {apu.ejec_qty.toLocaleString("es-CO")}
                          </td>
                          <td className="px-4 py-4 text-right font-mono" style={{ color: "var(--color-text-secondary)" }}>
                            {apu.obra_faltante_qty.toLocaleString("es-CO")}
                          </td>
                          <td className="px-4 py-4 text-right">-</td>
                          <td className="px-4 py-4 text-right">-</td>
                          <td className="px-4 py-4 text-right font-mono" style={{ color: "var(--color-text-primary)" }}>
                            {formatCurrency(apuBaseCost)}
                          </td>
                          <td className="px-4 py-4 text-right font-mono text-[var(--color-primary)]">
                            {formatCurrency(apuProjCost)}
                          </td>
                          <td className={`px-4 py-4 text-right font-mono font-black ${
                            apuCostDev > 0 ? "text-red-500 bg-red-500/[0.01]" : "text-emerald-500"
                          }`}>
                            {formatCurrency(apuCostDev)}
                          </td>
                        </tr>

                        {/* Child Resource Rows */}
                        {isExpanded && apu.resources.map((res) => {
                          const resProj = projectionMode === "historical" ? res.proj_hist : res.proj_theo;
                          const resCostProj = resProj?.cost || 0;
                          const resDevCost = resProj?.dev_cost || 0;
                          const hasWarn = resDevCost > 500000;

                          const uBase = res.base_unit_qty;
                          const uReal = res.ejec_unit_qty;

                          return (
                            <tr 
                              key={res.insumo}
                              className={`transition-colors duration-150 ${
                                hasWarn ? "bg-red-500/[0.01] hover:bg-red-500/[0.03]" : "hover:bg-[var(--color-surface-hover)]/30"
                              }`}
                            >
                              <td className="px-4 py-3 pl-8 text-[var(--color-text-tertiary)] font-mono">
                                {res.insumo}
                              </td>
                              <td className="px-4 py-3 text-[var(--color-text-secondary)] max-w-sm truncate uppercase">
                                {res.name}
                              </td>
                              <td className="px-4 py-3 text-center" style={{ color: "var(--color-text-tertiary)" }}>
                                {res.unit}
                              </td>
                              <td className="px-4 py-3 text-right font-mono" style={{ color: "var(--color-text-secondary)" }}>
                                {res.base_qty.toLocaleString("es-CO", { maximumFractionDigits: 1 })}
                              </td>
                              <td className="px-4 py-3 text-right font-mono" style={{ color: "var(--color-text-secondary)" }}>
                                {res.ejec_qty.toLocaleString("es-CO", { maximumFractionDigits: 1 })}
                              </td>
                              <td className="px-4 py-3 text-right font-mono" style={{ color: "var(--color-text-tertiary)" }}>
                                {(resProj?.qty ? (resProj.qty - res.ejec_qty) : 0).toLocaleString("es-CO", { maximumFractionDigits: 1 })}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-[10px]" style={{ color: "var(--color-text-secondary)" }}>
                                <span>{uBase.toFixed(3)}</span>
                                {res.ejec_qty > 0 && (
                                  <span className={`block font-bold ${uReal > uBase * 1.05 ? "text-red-400" : "text-emerald-400"}`}>
                                    {uReal.toFixed(3)}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right font-mono" style={{ color: "var(--color-text-secondary)" }}>
                                {formatCurrency(res.base_price)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono" style={{ color: "var(--color-text-secondary)" }}>
                                {formatCurrency(res.base_qty * res.base_price)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono" style={{ color: "var(--color-text-secondary)" }}>
                                {formatCurrency(resCostProj)}
                              </td>
                              <td className={`px-4 py-3 text-right font-mono font-bold ${
                                resDevCost > 0 ? "text-red-400 bg-red-500/[0.01]" : "text-emerald-500"
                              }`}>
                                {formatCurrency(resDevCost)}
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-xs font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                      No se encontraron actividades APU que coincidan con la búsqueda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
