export default function ProyectosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>
          Proyectos
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>
          Gestiona los proyectos de Constructora Serving.
        </p>
      </div>
      <div
        className="rounded-xl p-12 text-center animate-fade-in"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "2px dashed var(--color-border)",
        }}
      >
        <p className="text-4xl mb-3">🏗️</p>
        <p className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
          Módulo de Proyectos — Próximamente
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--color-text-tertiary)" }}>
          CRUD de proyectos, timeline de obra, hitos y avance.
        </p>
      </div>
    </div>
  );
}
