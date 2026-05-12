"use client";

import KpiCard from "@/components/dashboard/KpiCard";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import ProjectsOverview from "@/components/dashboard/ProjectsOverview";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight" style={{ color: "var(--color-text-primary)" }}>
          Dashboard
        </h1>
        <p className="text-base mt-2" style={{ color: "var(--color-text-secondary)" }}>
          Bienvenido de vuelta. Aquí tienes el resumen de Constructora Serving.
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <KpiCard
          title="Proyectos Activos"
          value="7"
          change="2 nuevos"
          changeType="positive"
          subtitle="este trimestre"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7-6H4a2 2 0 0 0-2 2v16z"/><path d="M14 2v6h6"/></svg>
          }
        />
        <KpiCard
          title="Unidades Vendidas"
          value="84"
          change="+12%"
          changeType="positive"
          subtitle="vs. mes anterior"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
          }
        />
        <KpiCard
          title="Ingresos del Mes"
          value="$2.4B"
          change="+8.3%"
          changeType="positive"
          subtitle="COP"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          }
        />
        <KpiCard
          title="Leads Activos"
          value="156"
          change="-3%"
          changeType="negative"
          subtitle="requieren seguimiento"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          }
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Projects Overview - 3 columns */}
        <div className="lg:col-span-3">
          <ProjectsOverview />
        </div>

        {/* Activity Feed - 2 columns */}
        <div className="lg:col-span-2">
          <ActivityFeed />
        </div>
      </div>

      {/* Quick Actions */}
      <div
        className="rounded-xl p-5 animate-fade-in"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
          Acciones Rápidas
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Nuevo Proyecto", icon: "➕", color: "var(--color-primary)" },
            { label: "Agregar Lead", icon: "👤", color: "var(--color-accent)" },
            { label: "Subir Documento", icon: "📄", color: "var(--color-warning)" },
            { label: "Generar Reporte", icon: "📊", color: "var(--color-info)" },
          ].map((action) => (
            <button
              key={action.label}
              className="flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer"
              style={{
                border: "1px solid var(--color-border)",
                color: "var(--color-text-primary)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = action.color;
                e.currentTarget.style.boxShadow = "var(--shadow-md)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--color-border)";
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <span className="text-lg">{action.icon}</span>
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
