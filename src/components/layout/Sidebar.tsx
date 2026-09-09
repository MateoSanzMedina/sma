"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  HardHat,
  TrendingUp,
  Receipt,
  Users,
  ShieldCheck,
  UserCog,
  FileText,
  Blocks,
  Settings,
  Pin,
  PinOff,
  type LucideIcon
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    group: "General",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true }
    ]
  },
  {
    group: "Área Técnica",
    items: [
      { label: "Proyectos", href: "/tecnica/proyectos", icon: HardHat },
      { label: "Flujo Gerencia", href: "/tecnica/analisis", icon: TrendingUp },
      { label: "Cierre de Costos", href: "/tecnica/cierre-costos", icon: Receipt }
    ]
  },
  {
    group: "Área Comercial",
    items: [
      { label: "CRM", href: "/comercial/crm", icon: Users }
    ]
  },
  {
    group: "Gestión Humana",
    items: [
      { label: "Seguridad Social", href: "/gestion-humana/seguridad-social", icon: ShieldCheck }
    ]
  },
  {
    group: "Área Administrativa",
    items: [
      { label: "Usuarios & Accesos", href: "/administrativa/usuarios", icon: UserCog },
      { label: "Documentos", href: "/administrativa/documentos", icon: FileText },
      { label: "Integraciones", href: "/administrativa/integraciones", icon: Blocks }
    ]
  }
];

const bottomItems: NavItem[] = [
  { label: "Configuración", href: "/configuracion", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isLocked, setIsLocked] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const locked = localStorage.getItem('sma_sidebar_locked') === 'true';
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLocked(locked);
  }, []);

  const toggleLock = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLocked(prev => {
      const newState = !prev;
      localStorage.setItem('sma_sidebar_locked', String(newState));
      return newState;
    });
  };

  const isExpanded = isLocked || isHovered;

  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', isExpanded ? '16rem' : '5rem');
  }, [isExpanded]);

  return (
    <aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`flex flex-col border-r border-border-color transition-all duration-300 ease-in-out shrink-0 z-40 shadow-subtle h-screen ${isExpanded ? 'w-64' : 'w-20'}`}
      style={{
        backgroundColor: "var(--color-surface)",
        borderColor: "var(--color-border)",
      }}
    >
      <div className="p-4 flex flex-col gap-4">
        <div className={`flex items-center gap-3 px-2 ${!isExpanded ? 'justify-center' : ''}`}>
          <div 
            className="flex items-center justify-center rounded-xl w-10 h-10 shrink-0 overflow-hidden font-bold text-white shadow-sm"
            style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))" }}
          >
            S
          </div>
          {isExpanded && (
            <div className="flex flex-col animate-in fade-in duration-300">
              <h1 className="font-display text-base font-bold leading-none" style={{ color: "var(--color-text-primary)" }}>Serving</h1>
              <p className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: "var(--color-text-secondary)" }}>Management App</p>
            </div>
          )}
        </div>
      </div>

      <nav className="flex flex-col gap-4 mt-4 px-3 flex-1 overflow-y-auto">
        {navGroups.map((group, groupIdx) => (
          <div key={group.group} className="flex flex-col gap-1.5">
            {groupIdx > 0 && !isExpanded && (
              <hr className="border-t opacity-10 my-1" style={{ borderColor: "var(--color-border)" }} />
            )}
            {isExpanded && (
              <p className="text-[10px] font-bold uppercase tracking-wider px-3 mt-2 mb-1" style={{ color: "var(--color-text-tertiary)" }}>
                {group.group}
              </p>
            )}
            {group.items.map((item) => {
              const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={!isExpanded ? item.label : ''}
                  className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 overflow-hidden ${
                    isActive ? 'shadow-sm border border-white/5 font-semibold' : 'hover:bg-black/5 dark:hover:bg-white/5'
                  } ${!isExpanded ? 'justify-center' : ''}`}
                  style={{
                    color: isActive ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                    backgroundColor: isActive ? "var(--color-primary-light)" : "transparent"
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = "var(--color-text-primary)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = "var(--color-text-secondary)";
                    }
                  }}
                >
                  {isActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 rounded-r-md" style={{ backgroundColor: "var(--color-primary)" }} />
                  )}
                  <Icon
                    className="shrink-0 h-5 w-5 transition-colors"
                    style={{ 
                      color: isActive ? "var(--color-primary)" : "inherit"
                    }}
                  />
                  {isExpanded && (
                    <p className="text-sm leading-normal truncate transition-all duration-300">
                      {item.label}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mt-auto p-4 border-t flex flex-col gap-4" style={{ borderColor: "var(--color-border)" }}>
        {bottomItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={!isExpanded ? item.label : ''}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 overflow-hidden ${
                isActive ? 'shadow-sm border border-white/5 font-semibold' : 'hover:bg-black/5 dark:hover:bg-white/5'
              } ${!isExpanded ? 'justify-center' : ''}`}
              style={{
                color: isActive ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                backgroundColor: isActive ? "var(--color-primary-light)" : "transparent"
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = "var(--color-text-primary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = "var(--color-text-secondary)";
                }
              }}
            >
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-r-md" style={{ backgroundColor: "var(--color-primary)" }} />
              )}
              <Icon
                className="shrink-0 h-5 w-5 transition-colors"
                style={{ 
                  color: isActive ? "var(--color-primary)" : "inherit"
                }}
              />
              {isExpanded && <span className="text-sm leading-normal truncate">{item.label}</span>}
            </Link>
          );
        })}
        
        <button
          onClick={toggleLock}
          className={`flex items-center gap-3 px-2 py-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer ${!isExpanded ? 'justify-center' : ''}`}
          style={{ color: "var(--color-text-secondary)" }}
          title={isLocked ? "Desbloquear menú" : "Fijar menú"}
          onMouseEnter={(e) => e.currentTarget.style.color = "var(--color-text-primary)"}
          onMouseLeave={(e) => e.currentTarget.style.color = "var(--color-text-secondary)"}
        >
          {isLocked ? (
            <Pin className="h-5 w-5 shrink-0 text-[#11a542]" />
          ) : (
            <PinOff className="h-5 w-5 shrink-0" />
          )}
          {isExpanded && <span className="text-[11px] font-semibold uppercase tracking-widest whitespace-nowrap overflow-hidden text-ellipsis">Fijar Menú</span>}
        </button>

        <div className={`px-2 ${!isExpanded ? 'text-center' : ''}`}>
          <p className="text-[9px] font-medium leading-tight" style={{ color: "var(--color-text-tertiary)" }}>
            {isExpanded ? '© Serving S.A.S - 2026' : 'SV'}
          </p>
        </div>
      </div>
    </aside>
  );
}
