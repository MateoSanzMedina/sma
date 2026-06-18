export default function CrmPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>
          CRM Comercial
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>
          Gestión de clientes, leads y oportunidades comerciales de Constructora Serving S.A.S.
        </p>
      </div>
      <div
        className="rounded-xl p-12 text-center animate-fade-in"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "2px dashed var(--color-border)",
        }}
      >
        <p className="text-4xl mb-3">🤝</p>
        <p className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
          Módulo Comercial (CRM) — Próximamente
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--color-text-tertiary)" }}>
          Seguimiento de ventas, cotizaciones, y base de datos de clientes interesados en proyectos urbanísticos.
        </p>
      </div>
    </div>
  );
}
