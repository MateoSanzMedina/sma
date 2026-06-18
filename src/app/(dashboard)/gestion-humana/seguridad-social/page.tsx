"use client";

import React, { useState, useCallback } from "react";
import { 
  UploadCloud, 
  FileSpreadsheet, 
  Loader2, 
  AlertTriangle, 
  Search, 
  ArrowRightLeft, 
  Info, 
  Users, 
  DollarSign,
  UserCheck,
  UserMinus,
  Check
} from "lucide-react";

interface EmployeeDetails {
  id: string;
  name: string;
  present_in_siimed: boolean;
  present_in_arus: boolean;
  siimed: {
    ibc_salud: number;
    ibc_pension: number;
    ibc_arl: number;
    ibc_ccf: number;
    val_salud: number;
    val_pension: number;
    val_arl: number;
    val_ccf: number;
    total: number;
  };
  arus: {
    ibc_salud: number;
    ibc_pension: number;
    ibc_arl: number;
    ibc_ccf: number;
    val_salud: number;
    val_pension: number;
    val_arl: number;
    val_ccf: number;
    total: number;
  };
  diff: {
    ibc_salud: number;
    ibc_pension: number;
    ibc_arl: number;
    ibc_ccf: number;
    total: number;
  };
  has_discrepancy: boolean;
}

interface ComparisonResult {
  summary: {
    total_siimed: number;
    total_arus: number;
    total_discrepancies: number;
    cotizantes_siimed: number;
    cotizantes_arus: number;
    is_demo: boolean;
    message: string;
  };
  details: EmployeeDetails[];
}

export default function SeguridadSocialPage() {
  const [siimedFile, setSiimedFile] = useState<File | null>(null);
  const [arusFile, setArusFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [onlyDiscrepancies, setOnlyDiscrepancies] = useState(false);

  // Drag and drop handlers
  const handleFileDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, type: "siimed" | "arus") => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) {
        if (type === "siimed") {
          setSiimedFile(file);
        } else {
          setArusFile(file);
        }
      }
    },
    []
  );

  const handleSubmit = async () => {
    if (!siimedFile || !arusFile) {
      setError("Por favor, sube ambos archivos (SIIMED y ARUS) antes de comparar.");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("siimed", siimedFile);
    formData.append("arus", arusFile);

    try {
      const response = await fetch("/api/payroll/compare", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Ocurrió un error al comparar las planillas.");
      }

      setResult(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error al procesar la comparación.");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0
    }).format(val);
  };

  // Filtrado de empleados
  const filteredDetails = result
    ? result.details.filter((emp) => {
        const matchesSearch =
          emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          emp.id.includes(searchTerm);
        const matchesDiscrepancy = !onlyDiscrepancies || emp.has_discrepancy;
        return matchesSearch && matchesDiscrepancy;
      })
    : [];

  return (
    <div className="space-y-8 max-w-full">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <span 
            className="material-symbols-outlined text-4xl"
            style={{ color: "var(--color-primary)" }}
          >
            badge
          </span>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight" style={{ color: "var(--color-text-primary)" }}>
            Liquidación de Seguridad Social
          </h1>
        </div>
        <p className="text-base mt-2" style={{ color: "var(--color-text-secondary)" }}>
          Carga y compara automáticamente la planilla de nómina (SIIMED) contra la autoliquidación generada (ARUS).
        </p>
      </div>

      {/* Upload Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
        <div className="xl:col-span-2 flex flex-col">
          <div 
            className="rounded-xl p-6 sm:p-8 flex flex-col justify-between min-h-[460px]"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              boxShadow: "var(--shadow-md)",
            }}
          >
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>
                  Cargar Archivos de Nómina
                </h2>
                <p className="text-xs mt-1" style={{ color: "var(--color-text-secondary)" }}>
                  Sube los dos reportes de Excel para validar diferencias en IBCs y aportes liquidados.
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

              {/* SIIMED Dropzone */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)" }}>
                  1. Reporte de SIIMED (Nómina / Novedades)
                </label>
                <div
                  className={`relative border border-dashed rounded-xl p-4 text-center transition-all duration-300 flex flex-col justify-center items-center h-28 cursor-pointer ${
                    siimedFile ? "bg-emerald-500/5" : "hover:bg-white/5"
                  }`}
                  style={{
                    borderColor: siimedFile ? "var(--color-primary)" : "var(--color-border)",
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleFileDrop(e, "siimed")}
                  onClick={() => document.getElementById("siimed-input")?.click()}
                >
                  <input
                    id="siimed-input"
                    type="file"
                    className="hidden"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setSiimedFile(file);
                    }}
                  />
                  {siimedFile ? (
                    <div className="flex items-center gap-3 text-left w-full">
                      <div className="p-2.5 rounded-lg bg-emerald-500/10 text-[var(--color-primary)]">
                        <FileSpreadsheet className="w-6 h-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate" style={{ color: "var(--color-text-primary)" }}>{siimedFile.name}</p>
                        <p className="text-[10px]" style={{ color: "var(--color-text-secondary)" }}>Archivo de Nómina cargado</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <UploadCloud className="w-7 h-7 mb-1.5" style={{ color: "var(--color-text-tertiary)" }} />
                      <p className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>Arrastra o haz clic para subir</p>
                      <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>XLSX, XLS o CSV</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ARUS Dropzone */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)" }}>
                  2. Planilla de Autoliquidación (ARUS Excel)
                </label>
                <div
                  className={`relative border border-dashed rounded-xl p-4 text-center transition-all duration-300 flex flex-col justify-center items-center h-28 cursor-pointer ${
                    arusFile ? "bg-emerald-500/5" : "hover:bg-white/5"
                  }`}
                  style={{
                    borderColor: arusFile ? "var(--color-primary)" : "var(--color-border)",
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleFileDrop(e, "arus")}
                  onClick={() => document.getElementById("arus-input")?.click()}
                >
                  <input
                    id="arus-input"
                    type="file"
                    className="hidden"
                    accept=".xlsx,.xls"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setArusFile(file);
                    }}
                  />
                  {arusFile ? (
                    <div className="flex items-center gap-3 text-left w-full">
                      <div className="p-2.5 rounded-lg bg-emerald-500/10 text-[var(--color-primary)]">
                        <FileSpreadsheet className="w-6 h-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate" style={{ color: "var(--color-text-primary)" }}>{arusFile.name}</p>
                        <p className="text-[10px]" style={{ color: "var(--color-text-secondary)" }}>Planilla ARUS cargada</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <UploadCloud className="w-7 h-7 mb-1.5" style={{ color: "var(--color-text-tertiary)" }} />
                      <p className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>Arrastra o haz clic para subir</p>
                      <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>Excel (XLSX, XLS)</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading || !siimedFile || !arusFile}
              className="w-full mt-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed select-none text-white shadow-sm"
              style={{
                background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Comparando Planillas...
                </>
              ) : (
                <>
                  <ArrowRightLeft className="w-5 h-5" />
                  Ejecutar Comparación
                </>
              )}
            </button>
          </div>
        </div>

        {/* Info panel / Instructions */}
        <div className="xl:col-span-3 flex flex-col">
          {!result ? (
            <div 
              className="rounded-xl p-8 flex-1 flex flex-col items-center justify-center text-center relative overflow-hidden group min-h-[460px]"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                boxShadow: "var(--shadow-md)",
              }}
            >
              <div className="w-20 h-20 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                <ArrowRightLeft className="w-10 h-10" style={{ color: "var(--color-primary)" }} />
              </div>
              <h3 className="text-xl font-bold mb-2" style={{ color: "var(--color-text-primary)" }}>
                Esperando Archivos
              </h3>
              <p className="text-sm max-w-md leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                Sube el reporte de nómina de SIIMED y el Excel descargado del operador de aportes ARUS. Cruzaremos la información por cédula de forma automática.
              </p>
              <div className="mt-8 flex gap-4 text-xs font-semibold text-left max-w-sm rounded-lg p-3 bg-emerald-500/5 border border-emerald-500/10" style={{ color: "var(--color-text-secondary)" }}>
                <Info className="w-5 h-5 flex-shrink-0 text-[var(--color-primary)]" />
                <span>Si no dispones de los archivos reales en este momento, puedes subir cualquier archivo vacío para ver un demo con datos simulados.</span>
              </div>
            </div>
          ) : (
            // Summary Dashboard
            <div className="space-y-6 flex-1 flex flex-col justify-between">
              {/* Demo Notice */}
              {result.summary.is_demo && (
                <div 
                  className="p-4 rounded-xl border flex items-center gap-3"
                  style={{
                    backgroundColor: "rgba(255, 102, 0, 0.05)",
                    borderColor: "rgba(255, 102, 0, 0.2)",
                  }}
                >
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 text-orange-500" />
                  <div className="text-xs">
                    <p className="font-bold text-[var(--color-text-primary)]">Modo Demostración Local Activo</p>
                    <p style={{ color: "var(--color-text-secondary)" }}>{result.summary.message}</p>
                  </div>
                </div>
              )}

              {/* KPI Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div 
                  className="rounded-xl p-5 border flex items-center justify-between"
                  style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
                >
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)" }}>SIIMED Nómina</p>
                    <p className="text-2xl font-black mt-1" style={{ color: "var(--color-text-primary)" }}>{formatCurrency(result.summary.total_siimed)}</p>
                    <p className="text-[10px] mt-1" style={{ color: "var(--color-text-tertiary)" }}>{result.summary.cotizantes_siimed} cotizantes</p>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-500/10 text-[var(--color-primary)]">
                    <DollarSign className="w-6 h-6" />
                  </div>
                </div>

                <div 
                  className="rounded-xl p-5 border flex items-center justify-between"
                  style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
                >
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)" }}>ARUS PILA</p>
                    <p className="text-2xl font-black mt-1" style={{ color: "var(--color-text-primary)" }}>{formatCurrency(result.summary.total_arus)}</p>
                    <p className="text-[10px] mt-1" style={{ color: "var(--color-text-tertiary)" }}>{result.summary.cotizantes_arus} cotizantes</p>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-500/10 text-[var(--color-primary)]">
                    <DollarSign className="w-6 h-6" />
                  </div>
                </div>

                <div 
                  className="rounded-xl p-5 border flex items-center justify-between"
                  style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
                >
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)" }}>Discrepancias</p>
                    <p className="text-2xl font-black mt-1" style={{ color: result.summary.total_discrepancies > 0 ? "var(--color-error)" : "var(--color-success)" }}>
                      {result.summary.total_discrepancies}
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: "var(--color-text-tertiary)" }}>Empleados con diferencias</p>
                  </div>
                  <div className={`p-3 rounded-xl ${result.summary.total_discrepancies > 0 ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-[var(--color-primary)]"}`}>
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                </div>

                <div 
                  className="rounded-xl p-5 border flex items-center justify-between"
                  style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
                >
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)" }}>Coincidencia</p>
                    <p className="text-2xl font-black mt-1" style={{ color: "var(--color-text-primary)" }}>
                      {result.summary.cotizantes_siimed > 0 
                        ? `${Math.round(((result.summary.cotizantes_siimed - result.summary.total_discrepancies) / result.summary.cotizantes_siimed) * 100)}%`
                        : "0%"}
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: "var(--color-text-tertiary)" }}>Cruce exacto de datos</p>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-500/10 text-[var(--color-primary)]">
                    <Users className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* Quick Actions Panel */}
              <div 
                className="rounded-xl p-4 border flex items-center justify-between"
                style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
              >
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-[var(--color-primary)]" />
                  <span className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
                    {result.summary.total_discrepancies === 0 
                      ? "Planilla validada sin discrepancias de nómina. Lista para envío a Tesorería."
                      : `Se encontraron ${result.summary.total_discrepancies} diferencias. Por favor revisa el listado detallado abajo.`}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Details Table Section */}
      {result && (
        <div 
          className="rounded-xl border p-6 space-y-6"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          {/* Filters and search */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <h3 className="text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>
              Detalle por Empleado
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
                  placeholder="Buscar cédula o nombre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent focus:outline-none w-full text-xs"
                />
              </div>

              {/* Filter Discrepancies */}
              <label className="flex items-center gap-2 text-xs font-semibold select-none cursor-pointer" style={{ color: "var(--color-text-secondary)" }}>
                <input
                  type="checkbox"
                  checked={onlyDiscrepancies}
                  onChange={(e) => setOnlyDiscrepancies(e.target.checked)}
                  className="rounded border-[var(--color-border)] focus:ring-0 text-[var(--color-primary)] cursor-pointer"
                />
                Solo discrepancias
              </label>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--color-border)" }}>
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[var(--color-surface-hover)] border-b" style={{ borderColor: "var(--color-border)" }}>
                <tr>
                  <th className="px-4 py-3 font-extrabold uppercase text-[var(--color-text-secondary)]">Empleado</th>
                  <th className="px-4 py-3 font-extrabold uppercase text-[var(--color-text-secondary)] text-right">IBC Salud</th>
                  <th className="px-4 py-3 font-extrabold uppercase text-[var(--color-text-secondary)] text-right">IBC Pensión</th>
                  <th className="px-4 py-3 font-extrabold uppercase text-[var(--color-text-secondary)] text-right">IBC ARL</th>
                  <th className="px-4 py-3 font-extrabold uppercase text-[var(--color-text-secondary)] text-right">IBC CCF</th>
                  <th className="px-4 py-3 font-extrabold uppercase text-[var(--color-text-secondary)] text-right">SIIMED Aporte</th>
                  <th className="px-4 py-3 font-extrabold uppercase text-[var(--color-text-secondary)] text-right">ARUS Aporte</th>
                  <th className="px-4 py-3 font-extrabold uppercase text-[var(--color-text-secondary)] text-right">Diferencia</th>
                  <th className="px-4 py-3 font-extrabold uppercase text-[var(--color-text-secondary)] text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--color-border)" }}>
                {filteredDetails.length > 0 ? (
                  filteredDetails.map((emp) => {
                    const diffVal = emp.diff.total;
                    const isMissingArus = !emp.present_in_arus;
                    const isMissingSiimed = !emp.present_in_siimed;

                    return (
                      <tr 
                        key={emp.id} 
                        className={`hover:bg-[var(--color-surface-hover)]/40 transition-colors duration-150 ${
                          emp.has_discrepancy ? "bg-red-500/[0.02]" : ""
                        }`}
                      >
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-[var(--color-text-primary)] uppercase">{emp.name}</div>
                          <div className="text-[10px] mt-0.5" style={{ color: "var(--color-text-secondary)" }}>CC {emp.id}</div>
                        </td>
                        
                        {/* IBC Salud */}
                        <td className="px-4 py-3.5 text-right font-medium">
                          <div style={{ color: "var(--color-text-primary)" }}>{formatCurrency(emp.siimed.ibc_salud)}</div>
                          <div className="text-[10px]" style={{ color: "var(--color-text-secondary)" }}>{formatCurrency(emp.arus.ibc_salud)}</div>
                          {emp.diff.ibc_salud !== 0 && (
                            <span className="text-[9px] font-bold text-red-400">({formatCurrency(emp.diff.ibc_salud)})</span>
                          )}
                        </td>

                        {/* IBC Pension */}
                        <td className="px-4 py-3.5 text-right font-medium">
                          <div style={{ color: "var(--color-text-primary)" }}>{formatCurrency(emp.siimed.ibc_pension)}</div>
                          <div className="text-[10px]" style={{ color: "var(--color-text-secondary)" }}>{formatCurrency(emp.arus.ibc_pension)}</div>
                          {emp.diff.ibc_pension !== 0 && (
                            <span className="text-[9px] font-bold text-red-400">({formatCurrency(emp.diff.ibc_pension)})</span>
                          )}
                        </td>

                        {/* IBC ARL */}
                        <td className="px-4 py-3.5 text-right font-medium">
                          <div style={{ color: "var(--color-text-primary)" }}>{formatCurrency(emp.siimed.ibc_arl)}</div>
                          <div className="text-[10px]" style={{ color: "var(--color-text-secondary)" }}>{formatCurrency(emp.arus.ibc_arl)}</div>
                          {emp.diff.ibc_arl !== 0 && (
                            <span className="text-[9px] font-bold text-red-400">({formatCurrency(emp.diff.ibc_arl)})</span>
                          )}
                        </td>

                        {/* IBC CCF */}
                        <td className="px-4 py-3.5 text-right font-medium">
                          <div style={{ color: "var(--color-text-primary)" }}>{formatCurrency(emp.siimed.ibc_ccf)}</div>
                          <div className="text-[10px]" style={{ color: "var(--color-text-secondary)" }}>{formatCurrency(emp.arus.ibc_ccf)}</div>
                          {emp.diff.ibc_ccf !== 0 && (
                            <span className="text-[9px] font-bold text-red-400">({formatCurrency(emp.diff.ibc_ccf)})</span>
                          )}
                        </td>

                        {/* SIIMED Aporte Total */}
                        <td className="px-4 py-3.5 text-right font-bold" style={{ color: "var(--color-text-primary)" }}>
                          {formatCurrency(emp.siimed.total)}
                        </td>

                        {/* ARUS Aporte Total */}
                        <td className="px-4 py-3.5 text-right font-bold animate-pulse-subtle" style={{ color: "var(--color-primary)" }}>
                          {formatCurrency(emp.arus.total)}
                        </td>

                        {/* Diferencia */}
                        <td className={`px-4 py-3.5 text-right font-bold ${
                          diffVal !== 0 ? "text-red-500 bg-red-500/[0.02]" : "text-emerald-500"
                        }`}>
                          {formatCurrency(diffVal)}
                        </td>

                        {/* Estado */}
                        <td className="px-4 py-3.5 text-center">
                          {isMissingArus && (
                            <span 
                              className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1"
                              style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", color: "var(--color-error)" }}
                            >
                              <UserMinus className="w-3 h-3" />
                              Sin ARUS
                            </span>
                          )}
                          {isMissingSiimed && (
                            <span 
                              className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1"
                              style={{ backgroundColor: "rgba(255, 102, 0, 0.1)", color: "orange" }}
                            >
                              <UserCheck className="w-3 h-3" />
                              Sin SIIMED
                            </span>
                          )}
                          {!isMissingArus && !isMissingSiimed && (
                            emp.has_discrepancy ? (
                              <span 
                                className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1"
                                style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", color: "var(--color-error)" }}
                              >
                                Diferencias
                              </span>
                            ) : (
                              <span 
                                className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1"
                                style={{ backgroundColor: "rgba(17, 165, 66, 0.1)", color: "var(--color-primary)" }}
                              >
                                Correcto
                              </span>
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-xs font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                      No se encontraron cotizantes que coincidan con la búsqueda.
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
