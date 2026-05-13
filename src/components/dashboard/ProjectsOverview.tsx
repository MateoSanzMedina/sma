"use client";

interface ProjectStatusItem {
  name: string;
  location: string;
  progress: number;
  status: "en-obra" | "preventa" | "entregado" | "planeacion";
  units: { sold: number; total: number };
}

const projects: ProjectStatusItem[] = [
  {
    name: "Riveras del Tambo",
    location: "La Ceja, Antioquia",
    progress: 68,
    status: "en-obra",
    units: { sold: 34, total: 48 },
  },
  {
    name: "Reservas de Juanito Laguna",
    location: "El Retiro",
    progress: 42,
    status: "en-obra",
    units: { sold: 18, total: 36 },
  },
  {
    name: "Llanogrande Hills",
    location: "Rionegro, vía San Antonio",
    progress: 15,
    status: "preventa",
    units: { sold: 8, total: 60 },
  },
  {
    name: "Montemadero",
    location: "San Antonio de Pereira",
    progress: 95,
    status: "entregado",
    units: { sold: 24, total: 24 },
  },
  {
    name: "La Trinidad",
    location: "Pereira, Risaralda",
    progress: 5,
    status: "planeacion",
    units: { sold: 0, total: 40 },
  },
];

const statusConfig = {
  "en-obra": { label: "En Obra", color: "var(--color-info)", bg: "#dbeafe" },
  preventa: { label: "Preventa", color: "var(--color-warning)", bg: "#fef3c7" },
  entregado: { label: "Entregado", color: "var(--color-success)", bg: "#d1fae5" },
  planeacion: { label: "Planeación", color: "#7c3aed", bg: "#ede9fe" },
};

export default function ProjectsOverview() {
  return (
    <div
      className="rounded-xl p-5 sm:p-6 animate-fade-in"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
          Estado de Proyectos
        </h3>
        <button
          className="text-xs font-medium px-2 py-1 rounded-md transition-colors duration-200 cursor-pointer"
          style={{ color: "var(--color-primary)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--color-primary-light)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          Ver todos
        </button>
      </div>

      <div className="space-y-4">
        {projects.map((project, i) => {
          const status = statusConfig[project.status];
          return (
            <div
              key={project.name}
              className="p-3 rounded-lg transition-all duration-200 cursor-pointer"
              style={{ animationDelay: `${i * 60}ms` }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--color-surface-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                    {project.name}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                    {project.location}
                  </p>
                </div>
                <span
                  className="text-[10px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0"
                  style={{ color: status.color, backgroundColor: status.bg }}
                >
                  {status.label}
                </span>
              </div>

              {/* Progress bar */}
              <div className="flex items-center gap-3">
                <div
                  className="flex-1 h-1.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: "var(--color-surface-hover)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${project.progress}%`,
                      backgroundColor: status.color,
                    }}
                  />
                </div>
                <span className="text-xs font-medium tabular-nums" style={{ color: "var(--color-text-secondary)" }}>
                  {project.progress}%
                </span>
              </div>

              {/* Units */}
              <p className="text-xs mt-1.5" style={{ color: "var(--color-text-tertiary)" }}>
                <span className="font-medium" style={{ color: "var(--color-text-secondary)" }}>
                  {project.units.sold}
                </span>
                /{project.units.total} unidades vendidas
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
