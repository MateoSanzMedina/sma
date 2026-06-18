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
        className="rounded-xl p-12 text-center animate-fade-in"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "2px dashed var(--color-border)",
        }}
      >
        <p className="text-4xl mb-3">📁</p>
        <p className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
          Módulo de Documentos — Próximamente
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--color-text-tertiary)" }}>
          Búsqueda semántica de minutas, contratos de obra, escrituras y actas del área administrativa.
        </p>
      </div>
    </div>
  );
}
