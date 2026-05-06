"use client";

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
      className="rounded-xl p-5 transition-all duration-200 animate-fade-in"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-sm)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "var(--shadow-md)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "var(--shadow-sm)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {title}
          </p>
          <p
            className="text-2xl font-bold mt-1"
            style={{ color: "var(--color-text-primary)" }}
          >
            {value}
          </p>
        </div>
        <div
          className="p-2.5 rounded-lg"
          style={{ backgroundColor: "var(--color-primary-light)" }}
        >
          <span style={{ color: "var(--color-primary)" }}>{icon}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
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
