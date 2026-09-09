import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, Integer, Numeric, Date, DateTime, ForeignKey, Text, JSON
from sqlalchemy.types import TypeDecorator, CHAR
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.session import Base

class GUID(TypeDecorator):
    """Tipo Universal GUID/UUID independiente del motor de base de datos.
    En PostgreSQL compila a UUID nativo con casteo automático asyncpg (::UUID).
    En SQLite almacena como CHAR(36).
    En Python siempre devuelve string seguro y serializable a JSON.
    """
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "postgresql":
            if isinstance(value, uuid.UUID):
                return value
            try:
                return uuid.UUID(str(value))
            except (ValueError, TypeError):
                return None
        return str(value)

    def process_result_value(self, value, dialect):
        return str(value) if value is not None else None

def generate_uuid():
    return uuid.uuid4()

class Empresa(Base):
    __tablename__ = "empresas"

    id = Column(GUID, primary_key=True, default=generate_uuid)
    nit = Column(String(20), unique=True, nullable=False)
    razon_social = Column(String(255), nullable=False)
    direccion = Column(Text, nullable=True)
    telefono = Column(String(50), nullable=True)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    usuarios = relationship("Usuario", back_populates="empresa")
    proyectos = relationship("Proyecto", back_populates="empresa")


class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(GUID, primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    nombre_completo = Column(String(255), nullable=False)
    rol = Column(String(50), nullable=False)  # ADMIN, DIRECTOR_OBRA, RESIDENTE, GESTION_HUMANA, CONTABILIDAD, CLIENTE
    empresa_id = Column(GUID, ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False)
    activo = Column(Boolean, default=True)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    totp_secret = Column(String(255), nullable=True)
    totp_enabled = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    empresa = relationship("Empresa", back_populates="usuarios")


class Proyecto(Base):
    __tablename__ = "proyectos"

    id = Column(GUID, primary_key=True, default=generate_uuid)
    codigo = Column(String(50), nullable=False)
    nombre = Column(String(255), nullable=False)
    ubicacion = Column(Text, nullable=True)
    empresa_id = Column(GUID, ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False)
    presupuesto_total = Column(Numeric(18, 2), default=0.00)
    fecha_inicio = Column(Date, nullable=True)
    fecha_fin = Column(Date, nullable=True)
    estado = Column(String(30), default="EN_EJECUCION")
    metadata_json = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    empresa = relationship("Empresa", back_populates="proyectos")
    capitulos = relationship("Capitulo", back_populates="proyecto")


class Capitulo(Base):
    __tablename__ = "capitulos"

    id = Column(GUID, primary_key=True, default=generate_uuid)
    proyecto_id = Column(GUID, ForeignKey("proyectos.id", ondelete="CASCADE"), nullable=False)
    codigo = Column(String(50), nullable=False)
    nombre = Column(String(255), nullable=False)
    orden = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    proyecto = relationship("Proyecto", back_populates="capitulos")
    apus = relationship("APU", back_populates="capitulo")


class APU(Base):
    __tablename__ = "apus"

    id = Column(GUID, primary_key=True, default=generate_uuid)
    proyecto_id = Column(GUID, ForeignKey("proyectos.id", ondelete="CASCADE"), nullable=False)
    capitulo_id = Column(GUID, ForeignKey("capitulos.id", ondelete="SET NULL"), nullable=True)
    codigo = Column(String(50), nullable=False)
    descripcion = Column(Text, nullable=False)
    unidad = Column(String(20), nullable=False)
    rendimiento = Column(Numeric(12, 4), default=1.0)
    costo_unitario = Column(Numeric(18, 2), default=0.00)
    metadata_json = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    capitulo = relationship("Capitulo", back_populates="apus")
    insumos = relationship("APUInsumo", back_populates="apu")


class APUInsumo(Base):
    __tablename__ = "apu_insumos"

    id = Column(GUID, primary_key=True, default=generate_uuid)
    apu_id = Column(GUID, ForeignKey("apus.id", ondelete="CASCADE"), nullable=False)
    tipo = Column(String(30), nullable=False)  # MATERIAL, MANO_OBRA, EQUIPO, TRANSPORTE
    descripcion = Column(Text, nullable=False)
    unidad = Column(String(20), nullable=False)
    cantidad = Column(Numeric(12, 4), nullable=False)
    precio_unitario = Column(Numeric(18, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    apu = relationship("APU", back_populates="insumos")


class Nomina(Base):
    __tablename__ = "nominas"

    id = Column(GUID, primary_key=True, default=generate_uuid)
    proyecto_id = Column(GUID, ForeignKey("proyectos.id", ondelete="SET NULL"), nullable=True)
    empresa_id = Column(GUID, ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False)
    periodo_inicio = Column(Date, nullable=False)
    periodo_fin = Column(Date, nullable=False)
    estado = Column(String(30), default="BORRADOR")
    total_ingresos = Column(Numeric(18, 2), default=0.00)
    total_descuentos = Column(Numeric(18, 2), default=0.00)
    total_pagar = Column(Numeric(18, 2), default=0.00)
    created_by = Column(GUID, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    detalles = relationship("NominaDetalle", back_populates="nomina")


class NominaDetalle(Base):
    __tablename__ = "nomina_detalles"

    id = Column(GUID, primary_key=True, default=generate_uuid)
    nomina_id = Column(GUID, ForeignKey("nominas.id", ondelete="CASCADE"), nullable=False)
    identificacion_trabajador = Column(String(50), nullable=False)
    nombre_trabajador = Column(String(255), nullable=False)
    cargo = Column(String(100), nullable=True)
    dias_laborados = Column(Numeric(5, 2), default=30)
    sueldo_base = Column(Numeric(18, 2), nullable=False)
    extras = Column(Numeric(18, 2), default=0.00)
    descuentos = Column(Numeric(18, 2), default=0.00)
    neto_pagar = Column(Numeric(18, 2), nullable=False)
    novedades_json = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    nomina = relationship("Nomina", back_populates="detalles")


class AgenteAuditLog(Base):
    __tablename__ = "agente_audit_logs"

    id = Column(GUID, primary_key=True, default=generate_uuid)
    agente_name = Column(String(100), nullable=False)
    accion = Column(String(100), nullable=False)
    confidence_score = Column(Numeric(5, 4), nullable=False)
    input_summary = Column(Text, nullable=True)
    output_json = Column(JSON, nullable=False)
    reasoning = Column(Text, nullable=True)
    status = Column(String(30), default="PENDING_REVIEW")  # PENDING_REVIEW, APPROVED, REJECTED, AUTO_APPROVED
    reviewed_by_id = Column(GUID, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class SecurityAuditLog(Base):
    __tablename__ = "security_audit_logs"

    id = Column(GUID, primary_key=True, default=generate_uuid)
    usuario_id = Column(GUID, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    ip_address = Column(String(45), nullable=False)
    user_agent = Column(Text, nullable=True)
    evento = Column(String(100), nullable=False)
    detalle = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
