"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
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
  module: string;
  exact?: boolean;
  adminOnly?: boolean;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    group: "General",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true, module: "dashboard" }
    ]
  },
  {
    group: "Área Técnica",
    items: [
      { label: "Proyectos", href: "/tecnica/proyectos", icon: HardHat, module: "proyectos" },
      { label: "Flujo Gerencia", href: "/tecnica/analisis", icon: TrendingUp, module: "analisis" },
      { label: "Cierre de Costos", href: "/tecnica/cierre-costos", icon: Receipt, module: "cierre-costos" }
    ]
  },
  {
    group: "Área Comercial",
    items: [
      { label: "CRM", href: "/comercial/crm", icon: Users, module: "crm" }
    ]
  },
  {
    group: "Gestión Humana",
    items: [
      { label: "Seguridad Social", href: "/gestion-humana/seguridad-social", icon: ShieldCheck, module: "seguridad-social" }
    ]
  },
  {
    group: "Área Administrativa",
    items: [
      { label: "Usuarios & Accesos", href: "/administrativa/usuarios", icon: UserCog, module: "usuarios", adminOnly: true },
      { label: "Documentos", href: "/administrativa/documentos", icon: FileText, module: "documentos" },
      { label: "Integraciones", href: "/administrativa/integraciones", icon: Blocks, module: "integraciones" }
    ]
  }
];

const bottomItems: NavItem[] = [
  { label: "Configuración", href: "/configuracion", icon: Settings, module: "configuracion" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, hasAccess } = useAuth();
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

  const isAdmin = user?.rol?.toUpperCase() === "ADMIN";

  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.adminOnly && !isAdmin) return false;
        return hasAccess(item.module);
      })
    }))
    .filter((group) => group.items.length > 0);

  const visibleBottomItems = bottomItems.filter((item) => hasAccess(item.module));

  return (
    <aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`flex flex-col border-r transition-all duration-300 ease-in-out shrink-0 z-40 h-screen bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm ${isExpanded ? 'w-64' : 'w-20'}`}
    >
      {/* 1. Header de Marca / Logo alineado a la altura del Navbar (h-16) */}
      <div className="h-16 px-4 sm:px-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className={`flex items-center gap-3 ${!isExpanded ? 'w-full justify-center' : ''}`}>
          <div 
            className="flex items-center justify-center rounded-xl w-9 h-9 shrink-0 overflow-hidden font-extrabold text-white text-base shadow-sm ring-1 ring-emerald-500/30 bg-gradient-to-br from-[#015c32] to-[#11a542]"
          >
            S
          </div>
          {isExpanded && (
            <div className="flex flex-col min-w-0 animate-in fade-in duration-200">
              <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                Serving
              </span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#11a542] mt-0.5">
                Management App
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Navegación Principal con espaciado generoso (px-3 py-4) */}
      <nav className="flex flex-col gap-4 py-4 px-3 flex-1 overflow-y-auto">
        {visibleGroups.map((group, groupIdx) => (
          <div key={group.group} className="flex flex-col gap-1">
            {groupIdx > 0 && !isExpanded && (
              <hr className="border-t border-slate-200 dark:border-slate-800 my-1 opacity-60" />
            )}
            {isExpanded && (
              <p className="text-[10px] font-bold uppercase tracking-wider px-3 pt-2 pb-1 text-slate-400 dark:text-slate-500 select-none">
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
                  className={`group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-[13px] transition-all duration-150 overflow-hidden ${
                    isActive 
                      ? 'bg-emerald-500/10 dark:bg-emerald-500/15 text-[#015c32] dark:text-emerald-300 font-bold border border-emerald-500/20 dark:border-emerald-500/30 shadow-xs' 
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium border border-transparent'
                  } ${!isExpanded ? 'justify-center px-0' : ''}`}
                >
                  <Icon
                    className={`shrink-0 h-[18px] w-[18px] transition-colors ${
                      isActive 
                        ? 'text-[#11a542] dark:text-[#11a542]' 
                        : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'
                    }`}
                  />
                  {isExpanded && (
                    <span className="leading-normal truncate">
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* 3. Footer / Configuración y Bloqueo */}
      <div className="mt-auto p-3.5 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2 shrink-0">
        {visibleBottomItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={!isExpanded ? item.label : ''}
              className={`group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-[13px] transition-all duration-150 overflow-hidden ${
                isActive 
                  ? 'bg-emerald-500/10 dark:bg-emerald-500/15 text-[#015c32] dark:text-emerald-300 font-bold border border-emerald-500/20 dark:border-emerald-500/30' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium border border-transparent'
              } ${!isExpanded ? 'justify-center px-0' : ''}`}
            >
              <Icon
                className={`shrink-0 h-[18px] w-[18px] transition-colors ${
                  isActive 
                    ? 'text-[#11a542]' 
                    : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'
                }`}
              />
              {isExpanded && <span className="leading-normal truncate">{item.label}</span>}
            </Link>
          );
        })}
        
        <button
          onClick={toggleLock}
          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer ${!isExpanded ? 'justify-center px-0' : ''}`}
          title={isLocked ? "Desbloquear menú" : "Fijar menú"}
        >
          {isLocked ? (
            <Pin className="h-4 w-4 shrink-0 text-[#11a542]" />
          ) : (
            <PinOff className="h-4 w-4 shrink-0 text-slate-400" />
          )}
          {isExpanded && (
            <span className="text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap overflow-hidden text-ellipsis">
              Fijar Menú
            </span>
          )}
        </button>

        <div className={`px-2 pt-1 ${!isExpanded ? 'text-center' : ''}`}>
          <p className="text-[9px] font-medium text-slate-400 dark:text-slate-500">
            {isExpanded ? '© Serving S.A.S - 2026' : 'SV'}
          </p>
        </div>
      </div>
    </aside>
  );
}
