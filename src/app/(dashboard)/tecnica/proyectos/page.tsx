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
        style={{
          padding: "3.5rem 2rem",
          borderRadius: "24px",
          backgroundColor: "var(--color-surface)",
          border: "2px dashed var(--color-border)",
          boxShadow: "var(--shadow-sm)",
        }}
        className="text-center animate-fade-in"
      >
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-[#11a542] flex items-center justify-center mx-auto mb-4 text-3xl">
          🏗️
        </div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          Módulo de Proyectos &mdash; Próximamente
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
          CRUD de proyectos, timeline de obra, hitos y avance.
        </p>
      </div>
    </div>
  );
}
