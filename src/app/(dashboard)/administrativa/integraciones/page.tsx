export default function IntegracionesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>
          Integraciones
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>
          Conecta SMA con sistemas externos como SIIMED, ARUS, bancos y plataformas de nómina.
        </p>
      </div>
      <div
        className="rounded-xl p-12 text-center animate-fade-in"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "2px dashed var(--color-border)",
        }}
      >
        <p className="text-4xl mb-3">🔌</p>
        <p className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
          Centro de Integraciones — Próximamente
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--color-text-tertiary)" }}>
          Configuración de APIs, tokens y credenciales de portales de servicios.
        </p>
      </div>
    </div>
  );
}
