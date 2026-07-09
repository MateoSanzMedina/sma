"use client";

import React, { useState, useCallback, useEffect } from "react";
import { 
  UploadCloud, 
  FileSpreadsheet, 
  Loader2, 
  AlertTriangle, 
  Check, 
  Download, 
  Trash2, 
  Settings, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp,
  FileText
} from "lucide-react";

interface TemplateInfo {
  name: string;
  exists: boolean;
  size: number;
  last_modified: string;
}

export default function SeguridadSocialPage() {
  // --- LISTA DINÁMICA DE INFORMES SIIMED ---
  const [siimedFiles, setSiimedFiles] = useState<File[]>([]);

  // --- CONFIGURACIÓN DE PLANTILLAS EN MEMORIA ---
  const [showConfig, setShowConfig] = useState(false);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [uploadingTemplate, setUploadingTemplate] = useState<string | null>(null);

  // --- ESTADOS DE CONTROL ---
  const [genLoading, setGenLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Cargar metadatos de plantillas desde el backend
  const fetchTemplatesInfo = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const response = await fetch("/api/payroll/templates");
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error("Error al cargar plantillas:", err);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTemplatesInfo();
  }, [fetchTemplatesInfo]);

  // Subir plantilla para actualización
  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "ingresos" | "novedades") => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingTemplate(type);
    setError(null);
    setSuccessMessage(null);

    const formData = new FormData();
    formData.append("type", type);
    formData.append("file", file);

    try {
      const response = await fetch("/api/payroll/templates", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("No se pudo actualizar la plantilla en el servidor.");
      }

      setSuccessMessage(`La plantilla de ${type} se actualizó correctamente en la memoria.`);
      await fetchTemplatesInfo();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir la plantilla.");
    } finally {
      setUploadingTemplate(null);
      e.target.value = ""; // Reset file input
    }
  };

  // Drag and drop handler general
  const handleFileDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;
      setSiimedFiles(prev => [...prev, ...files]);
      setError(null);
      setSuccessMessage(null);
    },
    []
  );

  // Remoción de archivos de la lista
  const removeFile = (index: number) => {
    setSiimedFiles(prev => prev.filter((_, i) => i !== index));
    setError(null);
    setSuccessMessage(null);
  };

  // Acción para generar planillas vacías estructuradas
  const handleGenerate = async (endpoint: string, defaultFilename: string) => {
    if (siimedFiles.length === 0) {
      setError("Por favor, sube al menos un informe de SIIMED para poder generar las planillas.");
      return;
    }

    setGenLoading(true);
    setError(null);
    setSuccessMessage(null);

    const formData = new FormData();
    siimedFiles.forEach(file => {
      formData.append("files", file);
    });

    try {
      const response = await fetch(`/api/payroll/generate/${endpoint}`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Error generando planilla: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = defaultFilename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      setSuccessMessage(`¡Planilla "${defaultFilename}" generada y descargada exitosamente!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error al generar el archivo.");
    } finally {
      setGenLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="space-y-8 max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span 
              className="material-symbols-outlined text-4xl"
              style={{ color: "var(--color-primary)" }}
            >
              badge
            </span>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight" style={{ color: "var(--color-text-primary)" }}>
              Generación de Seguridad Social
            </h1>
          </div>
          <p className="text-base mt-2" style={{ color: "var(--color-text-secondary)" }}>
            Sube múltiples informes de SIIMED y genera automáticamente las planillas ARUS pobladas de datos.
          </p>
        </div>

        {/* Botón de Configuración de Plantillas */}
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all duration-200 select-none cursor-pointer hover:border-[var(--color-primary)] text-[var(--color-text-primary)]"
          style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface)" }}
        >
          <Settings className="w-4 h-4" />
          Plantillas en Memoria
          {showConfig ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* SECCIÓN CONFIGURACIÓN PLANTILLAS (MEMORIA) */}
      {showConfig && (
        <div 
          className="p-6 rounded-xl border space-y-6 animate-in slide-in-from-top-4 duration-300"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
            boxShadow: "var(--shadow-md)"
          }}
        >
          <div>
            <h3 className="text-sm font-black text-[var(--color-text-primary)]">⚙️ Plantillas de Estructura ARUS Guardadas</h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Estas plantillas en blanco se conservan en el servidor para generar los archivos de Ingresos y Novedades sin que tengas que subirlas cada mes. Puedes actualizarlas aquí si cambian de formato.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {templates.map((t) => {
              const type = t.name.includes("INGRESOS") ? "ingresos" : "novedades";
              const isUploading = uploadingTemplate === type;

              return (
                <div 
                  key={t.name}
                  className="p-4 rounded-xl border flex flex-col justify-between h-36 bg-[var(--color-surface-hover)]/30"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <div className="flex items-start gap-3">
                    <FileSpreadsheet className="w-9 h-9 text-[var(--color-primary)] shrink-0" />
                    <div>
                      <p className="text-xs font-extrabold text-[var(--color-text-primary)]">{t.name}</p>
                      <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
                        Tamaño: {formatBytes(t.size)}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-secondary)]">
                        Última actualización: {t.last_modified}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t pt-3" style={{ borderColor: "var(--color-border)" }}>
                    <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      Activa en memoria
                    </span>

                    <button
                      onClick={() => document.getElementById(`update-tpl-${type}`)?.click()}
                      disabled={isUploading || loadingTemplates}
                      className="px-3 py-1.5 rounded-lg border text-[10px] font-bold cursor-pointer transition-all active:scale-95 text-[var(--color-text-primary)] hover:border-[var(--color-primary)] flex items-center gap-1"
                      style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface)" }}
                    >
                      {isUploading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                      Actualizar
                    </button>
                    <label htmlFor={`update-tpl-${type}`} className="sr-only">
                      Actualizar plantilla de {type}
                    </label>
                    <input
                      id={`update-tpl-${type}`}
                      type="file"
                      className="hidden"
                      accept=".xlsx"
                      onChange={(e) => handleTemplateUpload(e, type)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <div 
          className="p-4 rounded-xl text-sm border flex items-start gap-2.5 animate-in fade-in" 
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

      {successMessage && (
        <div 
          className="p-4 rounded-xl text-sm border flex items-start gap-2.5 animate-in fade-in bg-emerald-500/5 text-emerald-500" 
          style={{ 
            borderColor: "rgba(16, 185, 129, 0.15)"
          }}
        >
          <Check className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-500" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main Grid: SIIMED Uploader and Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* COL 1-3: SIIMED DYNAMIC UPLOADER */}
        <div 
          className="lg:col-span-3 rounded-xl p-6 sm:p-8 space-y-6 flex flex-col justify-between"
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>
                Cargar Informes de SIIMED
              </h2>
              <p className="text-xs mt-1 text-[var(--color-text-secondary)]">
                Arrastra y sube cualquier cantidad de informes de SIIMED (horas extras, vacaciones, incapacidades, licencias, etc.). El sistema los clasificará automáticamente.
              </p>
            </div>

            {/* Dropzone único múltiple */}
            <div
              className="relative border border-dashed rounded-xl p-8 text-center transition-all duration-300 flex flex-col justify-center items-center h-36 cursor-pointer hover:bg-white/5"
              style={{ borderColor: "var(--color-border)" }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => document.getElementById("siimed-files-input")?.click()}
            >
              <label htmlFor="siimed-files-input" className="sr-only">
                Seleccionar informes de SIIMED
              </label>
              <input
                id="siimed-files-input"
                type="file"
                className="hidden"
                multiple
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length > 0) {
                    setSiimedFiles(prev => [...prev, ...files]);
                    setError(null);
                    setSuccessMessage(null);
                  }
                }}
              />
              <UploadCloud className="w-9 h-9 mb-2 text-[var(--color-text-tertiary)] animate-pulse" />
              <p className="text-xs font-bold text-[var(--color-text-secondary)]">Arrastra tus archivos de informe aquí</p>
              <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1">Haz clic para buscar múltiples archivos (Excel o CSV)</p>
            </div>

            {/* Lista de archivos subidos */}
            {siimedFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Archivos cargados ({siimedFiles.length})
                </p>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {siimedFiles.map((file, idx) => (
                    <div 
                      key={`${file.name}-${idx}`}
                      className="flex items-center justify-between p-2.5 rounded-xl border bg-[var(--color-surface-hover)]/30 text-xs animate-in slide-in-from-bottom-2 duration-200"
                      style={{ borderColor: "var(--color-border)" }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <FileSpreadsheet className="w-5 h-5 text-[var(--color-primary)] shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold truncate text-[var(--color-text-primary)]">{file.name}</p>
                          <p className="text-[9px] text-[var(--color-text-secondary)]">{formatBytes(file.size)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(idx)}
                        className="p-1 rounded-md text-red-400 hover:bg-red-500/10 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* COL 4-5: GENERATE ACTIONS PANEL */}
        <div 
          className="lg:col-span-2 rounded-xl p-6 sm:p-8 flex flex-col justify-between min-h-[320px]"
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>
                Exportar Planillas ARUS
              </h2>
              <p className="text-xs mt-1 text-[var(--color-text-secondary)]">
                Selecciona la planilla que deseas generar utilizando las plantillas en memoria del servidor.
              </p>
            </div>

            <div className="space-y-4">
              {/* Generar Ingresos */}
              <button
                onClick={() => handleGenerate("ingresos", "PLANILLA_INGRESOS_ARUS.xlsx")}
                disabled={genLoading || siimedFiles.length === 0}
                className="w-full py-3 px-4 rounded-xl font-bold flex items-center justify-between cursor-pointer transition-all duration-200 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed select-none bg-[var(--color-surface-hover)] border border-[var(--color-border)] hover:border-[var(--color-primary)] text-[var(--color-text-primary)]"
              >
                <span className="flex items-center gap-2.5 text-xs text-left">
                  <FileSpreadsheet className="w-5 h-5 text-[var(--color-primary)] shrink-0" />
                  <div>
                    <p className="font-extrabold">Generar Planilla Ingresos</p>
                    <p className="text-[10px] text-[var(--color-text-secondary)]">Formato ARUS para cotizantes nuevos</p>
                  </div>
                </span>
                <Download className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
              </button>

              {/* Generar Novedades */}
              <button
                onClick={() => handleGenerate("novedades", "PLANILLA_NOVEDADES_ARUS.xlsx")}
                disabled={genLoading || siimedFiles.length === 0}
                className="w-full py-3 px-4 rounded-xl font-bold flex items-center justify-between cursor-pointer transition-all duration-200 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed select-none bg-[var(--color-surface-hover)] border border-[var(--color-border)] hover:border-[var(--color-primary)] text-[var(--color-text-primary)]"
              >
                <span className="flex items-center gap-2.5 text-xs text-left">
                  <FileSpreadsheet className="w-5 h-5 text-[var(--color-primary)] shrink-0" />
                  <div>
                    <p className="font-extrabold">Generar Planilla Novedades</p>
                    <p className="text-[10px] text-[var(--color-text-secondary)]">Formato ARUS para ausencias y vacaciones</p>
                  </div>
                </span>
                <Download className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
              </button>

              {/* Generar Autoliquidación */}
              <button
                onClick={() => handleGenerate("final", "Planilla_seguridad_social_final.xlsx")}
                disabled={genLoading || siimedFiles.length === 0}
                className="w-full py-3 px-4 rounded-xl font-bold flex items-center justify-between cursor-pointer transition-all duration-200 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed select-none bg-[var(--color-surface-hover)] border border-[var(--color-border)] hover:border-[var(--color-primary)] text-[var(--color-text-primary)]"
              >
                <span className="flex items-center gap-2.5 text-xs text-left">
                  <FileText className="w-5 h-5 text-[var(--color-primary)] shrink-0" />
                  <div>
                    <p className="font-extrabold">Generar Autoliquidación Final</p>
                    <p className="text-[10px] text-[var(--color-text-secondary)]">Planilla final oficial (formato 98 columnas)</p>
                  </div>
                </span>
                <Download className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
              </button>
            </div>
          </div>

          {genLoading && (
            <div className="mt-6 flex items-center justify-center gap-2 text-xs font-semibold text-[var(--color-primary)] animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Procesando informes y poblando plantillas...</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
