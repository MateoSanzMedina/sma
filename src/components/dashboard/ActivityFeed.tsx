"use client";

interface ActivityItem {
  id: string;
  user: string;
  action: string;
  target: string;
  time: string;
  avatar: string;
}

const recentActivity: ActivityItem[] = [
  {
    id: "1",
    user: "Carlos Méndez",
    action: "actualizó el avance de",
    target: "Riveras del Tambo",
    time: "Hace 12 min",
    avatar: "CM",
  },
  {
    id: "2",
    user: "Ana Gómez",
    action: "agregó un nuevo lead en",
    target: "CRM",
    time: "Hace 34 min",
    avatar: "AG",
  },
  {
    id: "3",
    user: "Luis Restrepo",
    action: "subió documentos a",
    target: "Llanogrande Hills",
    time: "Hace 1 hora",
    avatar: "LR",
  },
  {
    id: "4",
    user: "María Torres",
    action: "generó reporte de",
    target: "Ventas Q2",
    time: "Hace 2 horas",
    avatar: "MT",
  },
  {
    id: "5",
    user: "Santiago Sanz",
    action: "sincronizó datos con",
    target: "Siigo",
    time: "Hace 3 horas",
    avatar: "SS",
  },
];

const gradients = [
  "linear-gradient(135deg, #667eea, #764ba2)",
  "linear-gradient(135deg, #f093fb, #f5576c)",
  "linear-gradient(135deg, #4facfe, #00f2fe)",
  "linear-gradient(135deg, #43e97b, #38f9d7)",
  "linear-gradient(135deg, #fa709a, #fee140)",
];

export default function ActivityFeed() {
  return (
    <div
      className="rounded-xl p-5 animate-fade-in"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
          Actividad Reciente
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
          Ver todo
        </button>
      </div>

      <div className="space-y-3">
        {recentActivity.map((item, i) => (
          <div
            key={item.id}
            className="flex items-start gap-3 p-2.5 rounded-lg transition-all duration-200"
            style={{ animationDelay: `${i * 50}ms` }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-surface-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
              style={{ background: gradients[i % gradients.length] }}
            >
              {item.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm leading-snug">
                <span className="font-medium" style={{ color: "var(--color-text-primary)" }}>
                  {item.user}
                </span>{" "}
                <span style={{ color: "var(--color-text-secondary)" }}>{item.action}</span>{" "}
                <span className="font-medium" style={{ color: "var(--color-primary)" }}>
                  {item.target}
                </span>
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>
                {item.time}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
