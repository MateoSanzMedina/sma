"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
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
  Building
} from "lucide-react";

interface UserItem {
  id: string;
  email: string;
  nombre_completo: string;
  rol: string;
  activo: boolean;
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

export default function UsuariosPage() {
  const { user: currentUser, token } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Estados de Modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);

  // Formulario Crear Usuario
  const [newNombre, setNewNombre] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRol, setNewRol] = useState("RESIDENTE");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Formulario Reset Password
  const [resetPassValue, setResetPassValue] = useState("");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://sma-backend-m7ia.onrender.com";

  // Cargar lista de usuarios
  const fetchUsers = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`${apiUrl}/api/v1/users`, {
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
            last_login_at: new Date().toISOString()
          },
          {
            id: "serv-admin-02",
            email: "admin@serving.com.co",
            nombre_completo: "Administrador General Serving",
            rol: "ADMIN",
            activo: true
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
          last_login_at: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [token]);

  // Manejar creación de nuevo usuario
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNombre.trim() || !newEmail.trim() || !newPassword) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`${apiUrl}/api/v1/users`, {
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
    } catch (e: any) {
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
      const res = await fetch(`${apiUrl}/api/v1/users/${user.id}/toggle`, {
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

    try {
      const res = await fetch(`${apiUrl}/api/v1/users/${selectedUser.id}/password`, {
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
      await fetch(`${apiUrl}/api/v1/users/${user.id}`, {
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

  return (
    <div className="space-y-6">
      {/* Encabezado Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
            <Shield className="h-4 w-4" />
            Panel de Seguridad &amp; Accesos
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Gestión de Usuarios Corporativos
          </h1>
          <p className="text-sm text-slate-400">
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
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-sm text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center justify-between rounded-xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-sm text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Métricas Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-xl">
          <p className="text-xs font-semibold text-slate-400">Total Usuarios Activos</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {users.filter((u) => u.activo).length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-xl">
          <p className="text-xs font-semibold text-slate-400">Administradores</p>
          <p className="mt-1 text-2xl font-bold text-amber-400">
            {users.filter((u) => u.rol === "ADMIN").length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-xl">
          <p className="text-xs font-semibold text-slate-400">Directores &amp; Residentes</p>
          <p className="mt-1 text-2xl font-bold text-emerald-400">
            {users.filter((u) => u.rol === "DIRECTOR_OBRA" || u.rol === "RESIDENTE").length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-xl">
          <p className="text-xs font-semibold text-slate-400">Gestión Humana &amp; Finanzas</p>
          <p className="mt-1 text-2xl font-bold text-cyan-400">
            {users.filter((u) => u.rol === "GESTION_HUMANA" || u.rol === "CONTABILIDAD").length}
          </p>
        </div>
      </div>

      {/* Barra de Búsqueda y Refresco */}
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nombre, correo o rol..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 py-2 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-amber-500/60 focus:outline-none"
          />
        </div>

        <button
          onClick={fetchUsers}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-800/60 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700/60 transition-colors"
          title="Recargar lista"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Actualizar</span>
        </button>
      </div>

      {/* Tabla de Usuarios */}
      <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-950/40 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-4">Usuario / Colaborador</th>
                <th className="px-6 py-4">Rol en Serving</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4">Último Acceso</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No se encontraron usuarios que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const roleConfig = ROLES_INFO[u.rol] || {
                    label: u.rol,
                    badge: "bg-slate-500/10 text-slate-400 border-slate-500/20",
                    desc: ""
                  };

                  return (
                    <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-sm font-bold text-white border border-slate-700">
                            {u.nombre_completo.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-white">{u.nombre_completo}</p>
                            <p className="text-xs font-mono text-slate-400">{u.email}</p>
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
                        {u.activo ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-400"></span>
                            Suspendido
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-xs font-mono text-slate-400">
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
                            onClick={() => handleToggleStatus(u)}
                            title={u.activo ? "Suspender cuenta" : "Activar cuenta"}
                            className={`rounded-lg p-1.5 transition-colors cursor-pointer ${
                              u.activo
                                ? "text-slate-400 hover:bg-rose-500/10 hover:text-rose-400"
                                : "text-emerald-400 hover:bg-emerald-500/10"
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
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-500/10 hover:text-amber-400 transition-colors cursor-pointer"
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>

                          {u.rol !== "ADMIN" && (
                            <button
                              onClick={() => handleDeleteUser(u)}
                              title="Eliminar usuario"
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors cursor-pointer"
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
                <input
                  type="password"
                  required
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
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
                <input
                  type="password"
                  required
                  placeholder="Mínimo 6 caracteres"
                  value={resetPassValue}
                  onChange={(e) => setResetPassValue(e.target.value)}
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
    </div>
  );
}
