"use client";

export default function Header() {
  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between px-6 border-b glass"
      style={{
        height: "var(--header-height)",
        borderColor: "var(--color-border)",
      }}
    >
      {/* Search */}
      <div className="flex items-center gap-3 flex-1 max-w-lg">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg w-full transition-all duration-200"
          style={{
            backgroundColor: "var(--color-surface-hover)",
            border: "1px solid var(--color-border)",
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Buscar proyectos, clientes, documentos..."
            className="bg-transparent text-sm outline-none w-full"
            style={{ color: "var(--color-text-primary)" }}
          />
          <kbd
            className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono"
            style={{
              backgroundColor: "var(--color-surface)",
              color: "var(--color-text-tertiary)",
              border: "1px solid var(--color-border)",
            }}
          >
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <button
          className="relative p-2 rounded-lg transition-all duration-200 cursor-pointer"
          style={{ color: "var(--color-text-secondary)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--color-surface-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
          aria-label="Notificaciones"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          {/* Notification dot */}
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
            style={{ backgroundColor: "var(--color-error)" }}
          />
        </button>

        {/* Divider */}
        <div className="h-6 w-px" style={{ backgroundColor: "var(--color-border)" }} />

        {/* User Avatar */}
        <button
          className="flex items-center gap-2 p-1.5 rounded-lg transition-all duration-200 cursor-pointer"
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--color-surface-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
            style={{
              background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
              color: "white",
            }}
          >
            SS
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-sm font-medium leading-tight" style={{ color: "var(--color-text-primary)" }}>
              Admin
            </p>
            <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
              Serving S.A.S.
            </p>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--color-text-tertiary)" }} className="hidden sm:block">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </button>
      </div>
    </header>
  );
}
