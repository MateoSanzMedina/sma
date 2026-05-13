"use client";

import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();
  
  let title = 'Dashboard';
  let icon = 'dashboard';

  if (pathname.startsWith('/proyectos')) {
    title = 'Proyectos';
    icon = 'folder_open';
  } else if (pathname.startsWith('/crm')) {
    title = 'CRM';
    icon = 'group';
  } else if (pathname.startsWith('/documentos')) {
    title = 'Documentos';
    icon = 'edit_document';
  } else if (pathname.startsWith('/ai-tools')) {
    title = 'AI Tools';
    icon = 'robot_2';
  } else if (pathname.startsWith('/integraciones')) {
    title = 'Integraciones';
    icon = 'extension';
  } else if (pathname.startsWith('/configuracion')) {
    title = 'Ajustes';
    icon = 'settings';
  }

  return (
    <header 
      className="flex items-center justify-between whitespace-nowrap border-b border-white/5 px-12 md:px-20 lg:px-24 xl:px-32 py-5 sticky top-0 z-10 shrink-0 backdrop-blur-md bg-surface/80"
      style={{
        borderColor: "var(--color-border)",
      }}
    >
      <div className="flex items-center gap-4">
        {/* Title removed to avoid duplication with page content */}
      </div>
      
      <div className="flex flex-1 justify-end gap-4">
        <div className="flex items-center gap-2 mr-4 border-r border-white/5 pr-4">
          <p className="text-sm font-medium hidden sm:block" style={{ color: "var(--color-text-secondary)" }}>
            Hola, <span className="font-bold text-white">Admin</span>
          </p>
          <button
            className="flex items-center justify-center rounded-lg h-10 w-10 transition-colors cursor-pointer hover:bg-white/5"
            title="Cerrar Sesión"
            style={{ color: "var(--color-text-secondary)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--color-error)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--color-text-secondary)";
            }}
          >
            <span className="material-symbols-outlined">logout</span>
          </button>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={() => {
              document.documentElement.classList.toggle('dark');
              const isDark = document.documentElement.classList.contains('dark');
              localStorage.setItem('theme', isDark ? 'dark' : 'light');
            }}
            className="flex cursor-pointer items-center justify-center rounded-xl h-10 w-10 border border-white/5 bg-surface transition-all hover:bg-white/10 hover:shadow-lg hover:-translate-y-0.5"
            style={{ color: "var(--color-text-secondary)" }}
            title="Alternar Modo Oscuro/Claro"
            onMouseEnter={(e) => e.currentTarget.style.color = "var(--color-primary)"}
            onMouseLeave={(e) => e.currentTarget.style.color = "var(--color-text-secondary)"}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>contrast</span>
          </button>

          <button
            className="flex cursor-pointer items-center justify-center rounded-xl h-10 w-10 border border-white/5 bg-surface transition-all hover:bg-white/10 hover:shadow-lg hover:-translate-y-0.5 relative"
            style={{ color: "var(--color-text-secondary)" }}
            onMouseEnter={(e) => e.currentTarget.style.color = "var(--color-primary)"}
            onMouseLeave={(e) => e.currentTarget.style.color = "var(--color-text-secondary)"}
          >
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[var(--color-warning)] animate-pulse"></span>
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>notifications</span>
          </button>
        </div>
      </div>
    </header>
  );
}
