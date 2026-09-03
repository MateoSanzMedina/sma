export default function DocumentosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>
          Gestión Documental
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>
          Repositorio central de documentos, contratos y plantillas corporativas.
        </p>
      </div>
      <div
        style={{
          padding: "3.5rem 2rem",
          borderRadius: "24px",
          backgroundColor: "var(--color-surface)",
          border: "2px dashed var(--color-border)",
          boxShadow: "var(--shadow-sm)",
        }}
        className="text-center animate-fade-in"
      >
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-4 text-3xl">
          📁
        </div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          Módulo de Documentos &mdash; Próximamente
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
          Búsqueda semántica de minutas, contratos de obra, escrituras y actas del área administrativa.
        </p>
      </div>
    </div>
  );
}
