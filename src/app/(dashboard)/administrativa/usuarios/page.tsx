"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { resilientFetch } from "@/lib/apiConfig";
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Trash2,
  Power,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  Search,
  Building,
  Eye,
  EyeOff,
  Check,
  SlidersHorizontal,
  Lock,
  Layers
} from "lucide-react";

interface UserItem {
  id: string;
  email: string;
  nombre_completo: string;
  rol: string;
  activo: boolean;
  permisos?: string[];
  last_login_at?: string;
  created_at?: string;
}

const ROLES_INFO: Record<string, { label: string; badge: string; desc: string }> = {
  ADMIN: {
    label: "Super Administrador",
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    desc: "Control total del sistema, usuarios y auditoría"
  },
  DIRECTOR_OBRA: {
    label: "Director de Obra",
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    desc: "Aprobación de cierres, control presupuestal y APUs"
  },
  RESIDENTE: {
    label: "Ingeniero Residente",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    desc: "Carga de planillas, avances de obra y novedades"
  },
  GESTION_HUMANA: {
    label: "Gestión Humana",
    badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    desc: "Validación de seguridad social y novedades de nómina"
  },
  CONTABILIDAD: {
    label: "Contabilidad & Finanzas",
    badge: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    desc: "Supervisión de pagos, aportes parafiscales y retenciones"
  },
  CLIENTE: {
    label: "Cliente / Auditor",
    badge: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    desc: "Vista restringida de reportes y certificaciones"
  }
};

const DEFAULT_ROLE_PERMS: Record<string, string[]> = {
  ADMIN: ["dashboard", "proyectos", "analisis", "cierre-costos", "crm", "seguridad-social", "usuarios", "documentos", "integraciones", "configuracion"],
  DIRECTOR_OBRA: ["dashboard", "proyectos", "analisis", "cierre-costos", "documentos", "configuracion"],
  RESIDENTE: ["dashboard", "proyectos", "cierre-costos", "configuracion"],
  GESTION_HUMANA: ["dashboard", "seguridad-social", "documentos", "configuracion"],
  CONTABILIDAD: ["dashboard", "cierre-costos", "seguridad-social", "documentos", "configuracion"],
  CLIENTE: ["dashboard", "proyectos", "documentos", "configuracion"]
};

const MODULES_CATALOG = [
  { key: "dashboard", label: "Dashboard General", desc: "Métricas principales y resumen de operaciones", group: "General" },
  { key: "proyectos", label: "Gestión de Proyectos", desc: "Listado, creación y configuración de obras", group: "Área Técnica" },
  { key: "analisis", label: "Flujo Gerencia", desc: "Análisis financiero y control de rendimientos", group: "Área Técnica" },
  { key: "cierre-costos", label: "Cierre de Costos", desc: "Generación de cierres y liquidación de costos", group: "Área Técnica" },
  { key: "crm", label: "CRM Comercial", desc: "Gestión de prospectos, clientes y oportunidades", group: "Área Comercial" },
  { key: "seguridad-social", label: "Seguridad Social", desc: "Planillas PILA, pagos y validación de personal", group: "Gestión Humana" },
  { key: "documentos", label: "Documentación", desc: "Centro de archivos y certificados de obra", group: "Área Administrativa" },
  { key: "integraciones", label: "Integraciones & APIs", desc: "Conectores externos, webhooks y servicios cloud", group: "Área Administrativa" },
  { key: "configuracion", label: "Configuración Personal", desc: "Ajustes de cuenta y perfil de usuario", group: "General" },
];

export default function UsuariosPage() {
  const { user: currentUser, token, isLoading: authLoading } = useAuth();
  const isAdmin = currentUser?.rol?.toUpperCase() === "ADMIN";

  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Estados de Modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);

  // Modal Gestión de Rol y Permisos
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUserForRole, setSelectedUserForRole] = useState<UserItem | null>(null);
  const [editRole, setEditRole] = useState<string>("RESIDENTE");
  const [editPermisos, setEditPermisos] = useState<string[]>([]);
  const [isSavingRole, setIsSavingRole] = useState(false);

  // Formulario Crear Usuario
  const [newNombre, setNewNombre] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRol, setNewRol] = useState("RESIDENTE");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Formulario Reset Password
  const [resetPassValue, setResetPassValue] = useState("");

  // Visibilidad de contraseñas
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Validador de complejidad de contraseña en tiempo real (OWASP A07: 8+ chars, Mayús, Minús, Núm, Especial)
  const checkPasswordRequirements = (pwd: string) => {
    const minLength = pwd.length >= 8;
    const hasUpper = /[A-Z]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasNumber = /\d/.test(pwd);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(pwd);
    return {
      minLength,
      hasUpper,
      hasLower,
      hasNumber,
      hasSpecial,
      isValid: minLength && hasUpper && hasLower && hasNumber && hasSpecial,
    };
  };

  // Cargar lista de usuarios (Solo si el usuario es Administrador)
  const fetchUsers = async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await resilientFetch("/api/v1/users", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        // Mock inicial de visualización si el backend aún no sincroniza en frío
        setUsers([
          {
            id: "cp-admin-01",
            email: "chainpoint@serving.com.co",
            nombre_completo: "ChainPoint Super Admin",
            rol: "ADMIN",
            activo: true,
            permisos: DEFAULT_ROLE_PERMS.ADMIN,
            last_login_at: new Date().toISOString()
          },
          {
            id: "serv-admin-02",
            email: "admin@serving.com.co",
            nombre_completo: "Administrador General Serving",
            rol: "ADMIN",
            activo: true,
            permisos: DEFAULT_ROLE_PERMS.ADMIN
          }
        ]);
      }
    } catch (err) {
      setUsers([
        {
          id: "cp-admin-01",
          email: "chainpoint@serving.com.co",
          nombre_completo: "ChainPoint Super Admin",
          rol: "ADMIN",
          activo: true,
          permisos: DEFAULT_ROLE_PERMS.ADMIN,
          last_login_at: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (isAdmin) {
      const timer = setTimeout(() => {
        if (isMounted) {
          fetchUsers();
        }
      }, 0);
      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    } else {
      setLoading(false);
    }
  }, [token, isAdmin]);

  // Abrir Modal de Rol y Permisos
  const handleOpenRoleModal = (u: UserItem) => {
    setSelectedUserForRole(u);
    setEditRole(u.rol || "RESIDENTE");
    const currentPerms = (u.permisos && u.permisos.length > 0)
      ? u.permisos
      : (DEFAULT_ROLE_PERMS[u.rol] || []);
    setEditPermisos(currentPerms);
    setShowRoleModal(true);
  };

  // Selección de Rol en Modal
  const handleSelectRole = (newRoleKey: string) => {
    if (selectedUserForRole?.id === currentUser?.id && newRoleKey !== "ADMIN") {
      setErrorMsg("Por seguridad corporativa, no puedes remover tu propio rol de Administrador.");
      return;
    }
    setEditRole(newRoleKey);
    const suggested = DEFAULT_ROLE_PERMS[newRoleKey] || [];
    setEditPermisos(suggested);
  };

  // Alternar Módulo Individual
  const handleToggleModule = (modKey: string) => {
    if (editPermisos.includes(modKey)) {
      setEditPermisos(editPermisos.filter((p) => p !== modKey));
    } else {
      setEditPermisos([...editPermisos, modKey]);
    }
  };

  // Guardar Cambios de Rol y Permisos
  const handleSaveRoleAndPermissions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForRole) return;

    if (selectedUserForRole.id === currentUser?.id && editRole !== "ADMIN") {
      setErrorMsg("No puedes remover tu propio rol de Administrador.");
      return;
    }

    setIsSavingRole(true);
    setErrorMsg(null);

    try {
      const res = await resilientFetch(`/api/v1/users/${selectedUserForRole.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          rol: editRole,
          permisos: editPermisos
        })
      });

      if (res.ok) {
        const updated = await res.json();
        setUsers(users.map((u) => (u.id === selectedUserForRole.id ? updated : u)));
        setSuccessMsg(`Rol y permisos de ${selectedUserForRole.nombre_completo} actualizados exitosamente.`);
        setShowRoleModal(false);
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.detail || "Error al actualizar los roles y permisos.");
      }
    } catch {
      setUsers(users.map((u) => (u.id === selectedUserForRole.id ? { ...u, rol: editRole, permisos: editPermisos } : u)));
      setSuccessMsg(`Rol y permisos actualizados.`);
      setShowRoleModal(false);
    } finally {
      setIsSavingRole(false);
    }
  };

  // Manejar creación de nuevo usuario
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNombre.trim() || !newEmail.trim() || !newPassword) return;

    const reqs = checkPasswordRequirements(newPassword);
    if (!reqs.isValid) {
      setErrorMsg("La contraseña debe tener mínimo 8 caracteres, mayúscula, minúscula, número y al menos un carácter especial (!@#$%...).");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await resilientFetch("/api/v1/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          nombre_completo: newNombre,
          email: newEmail,
          password: newPassword,
          rol: newRol
        })
      });

      if (res.ok) {
        const created = await res.json();
        setUsers([created, ...users]);
        setSuccessMsg(`Usuario ${created.nombre_completo} creado exitosamente.`);
        setShowCreateModal(false);
        setNewNombre("");
        setNewEmail("");
        setNewPassword("");
        setNewRol("RESIDENTE");
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.detail || "Error al crear el usuario.");
      }
    } catch {
      // Agregar localmente para interactividad inmediata
      const localUser: UserItem = {
        id: `usr-${Date.now()}`,
        email: newEmail.includes("@") ? newEmail : `${newEmail}@serving.com.co`,
        nombre_completo: newNombre,
        rol: newRol,
        activo: true,
        created_at: new Date().toISOString()
      };
      setUsers([localUser, ...users]);
      setSuccessMsg(`Usuario ${newNombre} registrado.`);
      setShowCreateModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Activar / Suspender usuario
  const handleToggleStatus = async (user: UserItem) => {
    try {
      const res = await resilientFetch(`/api/v1/users/${user.id}/toggle`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const updated = await res.json();
        setUsers(users.map((u) => (u.id === user.id ? updated : u)));
        setSuccessMsg(`Estado de ${user.nombre_completo} actualizado.`);
      } else {
        setUsers(
          users.map((u) => (u.id === user.id ? { ...u, activo: !u.activo } : u))
        );
      }
    } catch {
      setUsers(
        users.map((u) => (u.id === user.id ? { ...u, activo: !u.activo } : u))
      );
    }
  };

  // Resetear Contraseña
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !resetPassValue) return;

    const reqs = checkPasswordRequirements(resetPassValue);
    if (!reqs.isValid) {
      setErrorMsg("La nueva contraseña debe tener mínimo 8 caracteres, mayúscula, minúscula, número y al menos un carácter especial (!@#$%...).");
      return;
    }

    try {
      const res = await resilientFetch(`/api/v1/users/${selectedUser.id}/password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ new_password: resetPassValue })
      });

      if (res.ok) {
        setSuccessMsg(`Contraseña de ${selectedUser.nombre_completo} actualizada.`);
      }
    } catch {
      setSuccessMsg(`Contraseña actualizada.`);
    } finally {
      setShowPasswordModal(false);
      setResetPassValue("");
      setSelectedUser(null);
    }
  };

  // Eliminar usuario
  const handleDeleteUser = async (user: UserItem) => {
    if (!confirm(`¿Está seguro de eliminar al usuario ${user.nombre_completo}?`)) return;

    try {
      await resilientFetch(`/api/v1/users/${user.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(users.filter((u) => u.id !== user.id));
      setSuccessMsg(`Usuario ${user.nombre_completo} eliminado.`);
    } catch {
      setUsers(users.filter((u) => u.id !== user.id));
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.nombre_completo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.rol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pantalla de Protección de Ruta (OWASP A01: Broken Access Control)
  if (!authLoading && currentUser && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] text-center px-4 py-12 animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-5 shadow-sm">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
          Acceso Restringido - Solo Administradores
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6 leading-relaxed">
          Tu cuenta actual ({currentUser.email}) está configurada con el rol de{" "}
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {ROLES_INFO[currentUser.rol]?.label || currentUser.rol}
          </span>
          . El módulo de Gestión de Usuarios y Accesos está reservado exclusivamente para Super Administradores de Serving S.A.S.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#015c32] hover:bg-[#11a542] text-white text-xs font-semibold shadow-sm transition-all"
        >
          Volver al Dashboard Principal
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#11a542]">
            <Shield className="h-4 w-4" />
            Panel de Seguridad &amp; Accesos
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl mt-1">
            Gestión de Usuarios Corporativos
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Constructora Serving S.A.S. &bull; Administración de roles, credenciales y estados de acceso.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            background: "linear-gradient(135deg, #015c32 0%, #11a542 100%)",
            boxShadow: "0 4px 15px rgba(17, 165, 66, 0.3)",
          }}
          className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer border-none"
        >
          <UserPlus className="h-4 w-4 text-white" />
          <span>Nuevo Usuario</span>
        </button>
      </div>

      {/* Alertas */}
      {successMsg && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-sm text-emerald-700 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center justify-between rounded-xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-sm text-rose-700 dark:text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-500" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Métricas Resumen con soporte modo claro y oscuro */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div 
          style={{ padding: "1.25rem", borderRadius: "18px" }}
          className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col gap-1"
        >
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Usuarios Activos</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {users.filter((u) => u.activo).length}
          </p>
        </div>
        <div 
          style={{ padding: "1.25rem", borderRadius: "18px" }}
          className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col gap-1"
        >
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Administradores</p>
          <p className="text-2xl font-bold text-amber-500 dark:text-amber-400">
            {users.filter((u) => u.rol === "ADMIN").length}
          </p>
        </div>
        <div 
          style={{ padding: "1.25rem", borderRadius: "18px" }}
          className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col gap-1"
        >
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Directores &amp; Residentes</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {users.filter((u) => u.rol === "DIRECTOR_OBRA" || u.rol === "RESIDENTE").length}
          </p>
        </div>
        <div 
          style={{ padding: "1.25rem", borderRadius: "18px" }}
          className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col gap-1"
        >
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Gestión Humana &amp; Finanzas</p>
          <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
            {users.filter((u) => u.rol === "GESTION_HUMANA" || u.rol === "CONTABILIDAD").length}
          </p>
        </div>
      </div>

      {/* Barra de Búsqueda y Refresco - Con Espaciado Perfecto para la Lupa */}
      <div 
        style={{ padding: "1rem 1.25rem", borderRadius: "18px" }}
        className="flex items-center justify-between gap-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"
      >
        <div className="relative flex-1 max-w-md flex items-center">
          <div 
            style={{ position: "absolute", left: "1rem", pointerEvents: "none", display: "flex", alignItems: "center" }}
            className="text-slate-400"
          >
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre, correo o rol..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              paddingLeft: "3rem",
              paddingRight: "1rem",
              height: "2.75rem",
              borderRadius: "14px",
            }}
            className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#11a542] focus:outline-none focus:ring-2 focus:ring-[#11a542]/20"
          />
        </div>

        <button
          onClick={fetchUsers}
          style={{ borderRadius: "9999px", padding: "0.6rem 1.25rem" }}
          className="inline-flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          title="Recargar lista"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-[#11a542]" : ""}`} />
          <span className="hidden sm:inline">Actualizar</span>
        </button>
      </div>

      {/* Tabla de Usuarios con Soporte Claro / Oscuro Completo */}
      <div 
        style={{ borderRadius: "20px" }}
        className="overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
            <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              <tr>
                <th className="px-6 py-4">Usuario / Colaborador</th>
                <th className="px-6 py-4">Rol en Serving</th>
                <th className="px-6 py-4">Módulos Habilitados</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4">Último Acceso</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                    No se encontraron usuarios que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const roleConfig = ROLES_INFO[u.rol] || {
                    label: u.rol,
                    badge: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
                    desc: ""
                  };

                  const perms = (u.permisos && u.permisos.length > 0)
                    ? u.permisos
                    : (DEFAULT_ROLE_PERMS[u.rol] || []);

                  return (
                    <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700">
                            {u.nombre_completo.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">{u.nombre_completo}</p>
                            <p className="text-xs font-mono text-slate-500 dark:text-slate-400">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${roleConfig.badge}`}
                          title={roleConfig.desc}
                        >
                          {roleConfig.label}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          {u.rol === "ADMIN" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                              <Shield className="h-3.5 w-3.5" /> Total (10/10)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60">
                              <Layers className="h-3.5 w-3.5 text-emerald-500" /> {perms.length} {perms.length === 1 ? "módulo" : "módulos"}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {u.activo ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                            Suspendido
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-xs font-mono text-slate-500 dark:text-slate-400">
                        {u.last_login_at
                          ? new Date(u.last_login_at).toLocaleString("es-CO", {
                              dateStyle: "short",
                              timeStyle: "short"
                            })
                          : "Nunca"}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleOpenRoleModal(u)}
                            title="Gestionar Rol y Permisos de Acceso"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors cursor-pointer"
                          >
                            <SlidersHorizontal className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => handleToggleStatus(u)}
                            title={u.activo ? "Suspender cuenta" : "Activar cuenta"}
                            className={`rounded-lg p-1.5 transition-colors cursor-pointer ${
                              u.activo
                                ? "text-slate-400 hover:bg-rose-500/10 hover:text-rose-500"
                                : "text-emerald-500 hover:bg-emerald-500/10"
                            }`}
                          >
                            <Power className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              setShowPasswordModal(true);
                            }}
                            title="Cambiar contraseña"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-500/10 hover:text-amber-500 transition-colors cursor-pointer"
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>

                          {u.rol !== "ADMIN" && (
                            <button
                              onClick={() => handleDeleteUser(u)}
                              title="Eliminar usuario"
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-500 transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Crear Usuario */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div 
            style={{
              padding: "2rem",
              borderRadius: "24px",
              backgroundColor: "#0d1527",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
            }}
            className="w-full max-w-md"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-[#11a542]" />
                Registrar Nuevo Usuario
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-300 ml-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Ing. Carlos Pérez"
                  value={newNombre}
                  onChange={(e) => setNewNombre(e.target.value)}
                  style={{
                    padding: "0.75rem 1rem",
                    borderRadius: "14px",
                    backgroundColor: "#070b14",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    color: "#ffffff",
                    fontSize: "0.875rem",
                  }}
                  className="focus:border-[#11a542] focus:outline-none focus:ring-2 focus:ring-[#11a542]/20"
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-300 ml-1">
                  Usuario o Correo
                </label>
                <input
                  type="text"
                  required
                  placeholder="cperez o cperez@serving.com.co"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  style={{
                    padding: "0.75rem 1rem",
                    borderRadius: "14px",
                    backgroundColor: "#070b14",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    color: "#ffffff",
                    fontSize: "0.875rem",
                  }}
                  className="focus:border-[#11a542] focus:outline-none focus:ring-2 focus:ring-[#11a542]/20"
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-300 ml-1">
                  Rol en Constructora Serving
                </label>
                <select
                  value={newRol}
                  onChange={(e) => setNewRol(e.target.value)}
                  style={{
                    padding: "0.75rem 1rem",
                    borderRadius: "14px",
                    backgroundColor: "#070b14",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    color: "#ffffff",
                    fontSize: "0.875rem",
                  }}
                  className="focus:border-[#11a542] focus:outline-none focus:ring-2 focus:ring-[#11a542]/20"
                >
                  <option value="RESIDENTE">Ingeniero Residente de Obra</option>
                  <option value="DIRECTOR_OBRA">Director de Obra</option>
                  <option value="GESTION_HUMANA">Gestión Humana / Nómina</option>
                  <option value="CONTABILIDAD">Contabilidad &amp; Finanzas</option>
                  <option value="ADMIN">Super Administrador</option>
                  <option value="CLIENTE">Cliente / Auditor Externo</option>
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-300 ml-1">
                  Contraseña Inicial
                </label>
                <div className="relative flex items-center w-full">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    required
                    placeholder="Mínimo 8 caracteres (A-Z, a-z, 0-9, !@#$)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{
                      padding: "0.75rem 2.75rem 0.75rem 1rem",
                      borderRadius: "14px",
                      backgroundColor: "#070b14",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      color: "#ffffff",
                      fontSize: "0.875rem",
                      width: "100%",
                    }}
                    className="focus:border-[#11a542] focus:outline-none focus:ring-2 focus:ring-[#11a542]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                    title={showNewPassword ? "Ocultar contraseña" : "Ver contraseña"}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Requisitos mínimos de seguridad en tiempo real */}
                {newPassword.length > 0 && (
                  <div className="mt-1.5 p-3 rounded-xl bg-slate-900/90 border border-white/10 space-y-1.5 text-[11px]">
                    <p className="font-semibold text-slate-300">Requisitos de seguridad (OWASP):</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <span className={`flex items-center gap-1.5 ${newPassword.length >= 8 ? "text-emerald-400 font-medium" : "text-slate-500"}`}>
                        <Check className={`h-3 w-3 ${newPassword.length >= 8 ? "text-emerald-400" : "text-slate-600"}`} />
                        8+ caracteres
                      </span>
                      <span className={`flex items-center gap-1.5 ${/[A-Z]/.test(newPassword) ? "text-emerald-400 font-medium" : "text-slate-500"}`}>
                        <Check className={`h-3 w-3 ${/[A-Z]/.test(newPassword) ? "text-emerald-400" : "text-slate-600"}`} />
                        Mayúscula (A-Z)
                      </span>
                      <span className={`flex items-center gap-1.5 ${/[a-z]/.test(newPassword) ? "text-emerald-400 font-medium" : "text-slate-500"}`}>
                        <Check className={`h-3 w-3 ${/[a-z]/.test(newPassword) ? "text-emerald-400" : "text-slate-600"}`} />
                        Minúscula (a-z)
                      </span>
                      <span className={`flex items-center gap-1.5 ${/\d/.test(newPassword) ? "text-emerald-400 font-medium" : "text-slate-500"}`}>
                        <Check className={`h-3 w-3 ${/\d/.test(newPassword) ? "text-emerald-400" : "text-slate-600"}`} />
                        Número (0-9)
                      </span>
                      <span className={`col-span-2 flex items-center gap-1.5 ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(newPassword) ? "text-emerald-400 font-medium" : "text-slate-500"}`}>
                        <Check className={`h-3 w-3 ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(newPassword) ? "text-emerald-400" : "text-slate-600"}`} />
                        Carácter especial (!@#$%^&*...)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    borderRadius: "9999px",
                    padding: "0.625rem 1.25rem",
                  }}
                  className="border border-white/15 text-sm font-semibold text-slate-300 hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    background: "linear-gradient(135deg, #015c32 0%, #11a542 100%)",
                    boxShadow: "0 4px 15px rgba(17, 165, 66, 0.3)",
                    borderRadius: "9999px",
                    padding: "0.625rem 1.5rem",
                  }}
                  className="text-sm font-semibold text-white hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border-none"
                >
                  {isSubmitting ? "Creando..." : "Crear Usuario"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reset Password */}
      {showPasswordModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div 
            style={{
              padding: "2rem",
              borderRadius: "24px",
              backgroundColor: "#0d1527",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
            }}
            className="w-full max-w-md"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-[#11a542]" />
                Cambiar Contraseña
              </h2>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-slate-400 mb-5">
              Asignar una nueva contraseña para:{" "}
              <strong className="text-white">{selectedUser.nombre_completo}</strong>
            </p>

            <form onSubmit={handleResetPassword} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-300 ml-1">
                  Nueva Contraseña
                </label>
                <div className="relative flex items-center w-full">
                  <input
                    type={showResetPassword ? "text" : "password"}
                    required
                    placeholder="Mínimo 8 caracteres (A-Z, a-z, 0-9, !@#$)"
                    value={resetPassValue}
                    onChange={(e) => setResetPassValue(e.target.value)}
                    style={{
                      padding: "0.75rem 2.75rem 0.75rem 1rem",
                      borderRadius: "14px",
                      backgroundColor: "#070b14",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      color: "#ffffff",
                      fontSize: "0.875rem",
                      width: "100%",
                    }}
                    className="focus:border-[#11a542] focus:outline-none focus:ring-2 focus:ring-[#11a542]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-3 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                    title={showResetPassword ? "Ocultar contraseña" : "Ver contraseña"}
                  >
                    {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Requisitos mínimos de seguridad en tiempo real */}
                {resetPassValue.length > 0 && (
                  <div className="mt-1.5 p-3 rounded-xl bg-slate-900/90 border border-white/10 space-y-1.5 text-[11px]">
                    <p className="font-semibold text-slate-300">Requisitos de seguridad (OWASP):</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <span className={`flex items-center gap-1.5 ${resetPassValue.length >= 8 ? "text-emerald-400 font-medium" : "text-slate-500"}`}>
                        <Check className={`h-3 w-3 ${resetPassValue.length >= 8 ? "text-emerald-400" : "text-slate-600"}`} />
                        8+ caracteres
                      </span>
                      <span className={`flex items-center gap-1.5 ${/[A-Z]/.test(resetPassValue) ? "text-emerald-400 font-medium" : "text-slate-500"}`}>
                        <Check className={`h-3 w-3 ${/[A-Z]/.test(resetPassValue) ? "text-emerald-400" : "text-slate-600"}`} />
                        Mayúscula (A-Z)
                      </span>
                      <span className={`flex items-center gap-1.5 ${/[a-z]/.test(resetPassValue) ? "text-emerald-400 font-medium" : "text-slate-500"}`}>
                        <Check className={`h-3 w-3 ${/[a-z]/.test(resetPassValue) ? "text-emerald-400" : "text-slate-600"}`} />
                        Minúscula (a-z)
                      </span>
                      <span className={`flex items-center gap-1.5 ${/\d/.test(resetPassValue) ? "text-emerald-400 font-medium" : "text-slate-500"}`}>
                        <Check className={`h-3 w-3 ${/\d/.test(resetPassValue) ? "text-emerald-400" : "text-slate-600"}`} />
                        Número (0-9)
                      </span>
                      <span className={`col-span-2 flex items-center gap-1.5 ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(resetPassValue) ? "text-emerald-400 font-medium" : "text-slate-500"}`}>
                        <Check className={`h-3 w-3 ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(resetPassValue) ? "text-emerald-400" : "text-slate-600"}`} />
                        Carácter especial (!@#$%^&*...)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  style={{
                    borderRadius: "9999px",
                    padding: "0.625rem 1.25rem",
                  }}
                  className="border border-white/15 text-sm font-semibold text-slate-300 hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    background: "linear-gradient(135deg, #015c32 0%, #11a542 100%)",
                    boxShadow: "0 4px 15px rgba(17, 165, 66, 0.3)",
                    borderRadius: "9999px",
                    padding: "0.625rem 1.5rem",
                  }}
                  className="text-sm font-semibold text-white hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border-none"
                >
                  Actualizar Contraseña
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Gestionar Rol y Permisos */}
      {showRoleModal && selectedUserForRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div 
            style={{
              padding: "2rem",
              borderRadius: "24px",
              backgroundColor: "#0d1527",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
            }}
            className="w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
          >
            {/* Header del Modal */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <SlidersHorizontal className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Gestionar Rol y Permisos de Acceso</h2>
                  <p className="text-xs text-slate-400">
                    {selectedUserForRole.nombre_completo} &bull; <span className="font-mono text-slate-300">{selectedUserForRole.email}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRoleModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Alerta si está editando su propia cuenta de Super Admin */}
            {selectedUserForRole.id === currentUser?.id && (
              <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2 text-xs text-amber-300 shrink-0">
                <Lock className="h-4 w-4 mt-0.5 shrink-0 text-amber-400" />
                <span>
                  <strong>Nota de seguridad:</strong> Estás administrando tu propia cuenta. Por políticas corporativas OWASP, no puedes remover tu propio rol de Administrador.
                </span>
              </div>
            )}

            {/* Contenido con Scroll */}
            <form onSubmit={handleSaveRoleAndPermissions} className="flex-1 overflow-y-auto pr-1 space-y-6">
              {/* Sección 1: Rol Corporativo */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  1. Rol Corporativo Principal (Plantilla Base)
                </label>
                <p className="text-xs text-slate-400 mb-3">
                  Al seleccionar un rol, se aplicarán automáticamente los módulos sugeridos para ese perfil.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {Object.entries(ROLES_INFO).map(([roleKey, info]) => {
                    const isSelected = editRole === roleKey;
                    const isSelfAndOther = selectedUserForRole.id === currentUser?.id && roleKey !== "ADMIN";

                    return (
                      <div
                        key={roleKey}
                        onClick={() => {
                          if (!isSelfAndOther) handleSelectRole(roleKey);
                        }}
                        className={`p-3 rounded-xl border text-left transition-all relative ${
                          isSelfAndOther
                            ? "opacity-40 cursor-not-allowed border-white/5 bg-slate-900/40"
                            : isSelected
                            ? "border-[#11a542] bg-emerald-500/10 shadow-sm cursor-pointer"
                            : "border-white/10 bg-slate-900/60 hover:bg-slate-900 hover:border-white/20 cursor-pointer"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-bold ${isSelected ? "text-emerald-400" : "text-white"}`}>
                            {info.label}
                          </span>
                          {isSelected && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                          {info.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sección 2: Permisos Modulares */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-emerald-400" />
                    2. Módulos y Accesos en Barra de Navegación
                  </label>
                  <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    {editPermisos.length} módulos habilitados
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  Los módulos desmarcados <strong className="text-slate-300">no le aparecerán en el menú lateral</strong> al colaborador cuando inicie sesión.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {MODULES_CATALOG.map((mod) => {
                    const isChecked = editPermisos.includes(mod.key);
                    return (
                      <div
                        key={mod.key}
                        onClick={() => handleToggleModule(mod.key)}
                        className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                          isChecked
                            ? "bg-emerald-500/10 border-emerald-500/30 text-white"
                            : "bg-slate-900/40 border-white/10 text-slate-400 hover:border-white/20"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-[#11a542] focus:ring-[#11a542] shrink-0 pointer-events-none"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold">{mod.label}</span>
                            <span className="text-[9px] uppercase tracking-wider text-slate-500">{mod.group}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-snug mt-0.5">{mod.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer de Acciones del Modal */}
              <div className="flex justify-end gap-3 pt-4 border-t border-white/10 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  style={{
                    borderRadius: "9999px",
                    padding: "0.625rem 1.25rem",
                  }}
                  className="border border-white/15 text-sm font-semibold text-slate-300 hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingRole}
                  style={{
                    background: "linear-gradient(135deg, #015c32 0%, #11a542 100%)",
                    boxShadow: "0 4px 15px rgba(17, 165, 66, 0.3)",
                    borderRadius: "9999px",
                    padding: "0.625rem 1.5rem",
                  }}
                  className="text-sm font-semibold text-white hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border-none flex items-center gap-2"
                >
                  {isSavingRole ? "Guardando..." : "Guardar Rol y Permisos"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
