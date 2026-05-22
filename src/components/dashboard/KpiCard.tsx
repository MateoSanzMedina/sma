"use client";
// label placeholder aria-label

interface KpiCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: React.ReactNode;
  subtitle?: string;
}

export default function KpiCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon,
  subtitle,
}: KpiCardProps) {
  const changeColors = {
    positive: "var(--color-success)",
    negative: "var(--color-error)",
    neutral: "var(--color-text-tertiary)",
  };

  return (
    <div
      className="rounded-xl p-5 sm:p-6 transition-all duration-300 animate-fade-in relative group"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-md)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "var(--shadow-lg)";
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.borderColor = "var(--color-border-strong)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "var(--shadow-md)";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = "var(--color-border)";
      }}
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--color-primary)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 overflow-hidden"></div>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex flex-col min-w-0">
          <p
            className="text-[11px] font-bold uppercase tracking-wide mb-1 truncate"
            style={{ color: "var(--color-text-tertiary)" }}
            title={title}
          >
            {title}
          </p>
          <p
            className="text-2xl font-black tracking-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            {value}
          </p>
        </div>
        <div
          className="p-2.5 rounded-xl shadow-inner flex-shrink-0"
          style={{ backgroundColor: "var(--color-primary-light)" }}
        >
          <span style={{ color: "var(--color-primary)" }}>{icon}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {change && (
          <span
            className="text-xs font-semibold"
            style={{ color: changeColors[changeType] }}
          >
            {changeType === "positive" ? "↑" : changeType === "negative" ? "↓" : "→"}{" "}
            {change}
          </span>
        )}
        {subtitle && (
          <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
