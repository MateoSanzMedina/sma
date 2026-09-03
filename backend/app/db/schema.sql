-- =============================================================================
-- ESQUEMA DE BASE DE DATOS PARA SMA (Serving Management App)
-- Seguridad empresarial, ACID Compliance, RLS, Audit Logs y Support para pgvector
-- =============================================================================

-- 1. EXTENSIONES REQUERIDAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 2. TABLA: EMPRESAS (Multi-tenant aislamiento corporativo)
CREATE TABLE IF NOT EXISTS empresas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nit VARCHAR(20) UNIQUE NOT NULL,
    razon_social VARCHAR(255) NOT NULL,
    direccion TEXT,
    telefono VARCHAR(50),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABLA: USUARIOS (RBAC + Auth empresarial)
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nombre_completo VARCHAR(255) NOT NULL,
    rol VARCHAR(50) NOT NULL CHECK (rol IN ('ADMIN', 'DIRECTOR_OBRA', 'RESIDENTE', 'GESTION_HUMANA', 'CONTABILIDAD', 'CLIENTE')),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    activo BOOLEAN DEFAULT TRUE,
    failed_login_attempts INT DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_empresa ON usuarios(empresa_id);

-- 4. TABLA: PROYECTOS (Obras de construcción)
CREATE TABLE IF NOT EXISTS proyectos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(50) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    ubicacion TEXT,
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    presupuesto_total NUMERIC(18, 2) DEFAULT 0.00,
    fecha_inicio DATE,
    fecha_fin DATE,
    estado VARCHAR(30) DEFAULT 'EN_EJECUCION' CHECK (estado IN ('PLANIFICACION', 'EN_EJECUCION', 'SUSPENDIDO', 'FINALIZADO')),
    metadata_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(codigo, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_proyectos_empresa ON proyectos(empresa_id);

-- 5. TABLA: PROYECTO_USUARIOS (Asignación fina de acceso a obras)
CREATE TABLE IF NOT EXISTS proyecto_usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    rol_proyecto VARCHAR(50) DEFAULT 'RESIDENTE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(proyecto_id, usuario_id)
);

-- 6. TABLA: CAPITULOS DE PRESUPUESTO
CREATE TABLE IF NOT EXISTS capitulos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    codigo VARCHAR(50) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    orden INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_capitulos_proyecto ON capitulos(proyecto_id);

-- 7. TABLA: APUS (Análisis de Precios Unitarios)
CREATE TABLE IF NOT EXISTS apus (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    capitulo_id UUID REFERENCES capitulos(id) ON DELETE SET NULL,
    codigo VARCHAR(50) NOT NULL,
    descripcion TEXT NOT NULL,
    unidad VARCHAR(20) NOT NULL,
    rendimiento NUMERIC(12, 4) DEFAULT 1.0,
    costo_unitario NUMERIC(18, 2) DEFAULT 0.00,
    metadata_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_apus_proyecto ON apus(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_apus_descripcion_trgm ON apus USING gin (descripcion gin_trgm_ops);

-- 8. TABLA: APU_INSUMOS (Detalle de Materiales, Mano de Obra, Equipos)
CREATE TABLE IF NOT EXISTS apu_insumos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    apu_id UUID NOT NULL REFERENCES apus(id) ON DELETE CASCADE,
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('MATERIAL', 'MANO_OBRA', 'EQUIPO', 'TRANSPORTE', 'SUBCOTRATO')),
    descripcion TEXT NOT NULL,
    unidad VARCHAR(20) NOT NULL,
    cantidad NUMERIC(12, 4) NOT NULL,
    precio_unitario NUMERIC(18, 2) NOT NULL,
    subtotal NUMERIC(18, 2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_insumos_apu ON apu_insumos(apu_id);

-- 9. TABLA: PRESUPUESTO_ITEMS (Programación y Avance de Obra)
CREATE TABLE IF NOT EXISTS presupuesto_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    apu_id UUID REFERENCES apus(id) ON DELETE RESTRICT,
    cantidad_presupuestada NUMERIC(14, 4) NOT NULL DEFAULT 0,
    cantidad_ejecutada NUMERIC(14, 4) NOT NULL DEFAULT 0,
    valor_total NUMERIC(18, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. TABLA: NOMINAS (Seguridad Social ARUS / SIIMED)
CREATE TABLE IF NOT EXISTS nominas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proyecto_id UUID REFERENCES proyectos(id) ON DELETE SET NULL,
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    periodo_inicio DATE NOT NULL,
    periodo_fin DATE NOT NULL,
    estado VARCHAR(30) DEFAULT 'BORRADOR' CHECK (estado IN ('BORRADOR', 'PENDIENTE_REVISION', 'APROBADO', 'PAGADO')),
    total_ingresos NUMERIC(18, 2) DEFAULT 0.00,
    total_descuentos NUMERIC(18, 2) DEFAULT 0.00,
    total_pagar NUMERIC(18, 2) DEFAULT 0.00,
    created_by UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_nominas_empresa ON nominas(empresa_id);

-- 11. TABLA: NOMINA_DETALLES (Detalle de Trabajadores y Liquidación)
CREATE TABLE IF NOT EXISTS nomina_detalles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nomina_id UUID NOT NULL REFERENCES nominas(id) ON DELETE CASCADE,
    identificacion_trabajador VARCHAR(50) NOT NULL,
    nombre_trabajador VARCHAR(255) NOT NULL,
    cargo VARCHAR(100),
    dias_laborados NUMERIC(5, 2) DEFAULT 30,
    sueldo_base NUMERIC(18, 2) NOT NULL,
    extras NUMERIC(18, 2) DEFAULT 0.00,
    descuentos NUMERIC(18, 2) DEFAULT 0.00,
    neto_pagar NUMERIC(18, 2) NOT NULL,
    novedades_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_nomina_detalles_nomina ON nomina_detalles(nomina_id);

-- 12. TABLA: COSTOS_CIERRE (Análisis de cierre SAO)
CREATE TABLE IF NOT EXISTS costos_cierre (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    fecha_cierre DATE NOT NULL,
    reporte_filename VARCHAR(255) NOT NULL,
    resultado_json JSONB NOT NULL,
    desviacion_total NUMERIC(18, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. TABLA: AGENTE_AUDIT_LOGS (Supervisión Human-In-The-Loop para IA)
CREATE TABLE IF NOT EXISTS agente_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agente_name VARCHAR(100) NOT NULL,
    accion VARCHAR(100) NOT NULL,
    confidence_score NUMERIC(5, 4) NOT NULL, -- e.g. 0.9450
    input_summary TEXT,
    output_json JSONB NOT NULL,
    reasoning TEXT,
    status VARCHAR(30) DEFAULT 'PENDING_REVIEW' CHECK (status IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'AUTO_APPROVED')),
    reviewed_by_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agente_logs_status ON agente_audit_logs(status);

-- 14. TABLA: SECURITY_AUDIT_LOGS (Auditoría OWASP y accesos)
CREATE TABLE IF NOT EXISTS security_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    evento VARCHAR(100) NOT NULL,
    detalle JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sec_logs_evento ON security_audit_logs(evento);
CREATE INDEX IF NOT EXISTS idx_sec_logs_usuario ON security_audit_logs(usuario_id);

-- 15. TABLA: DOCUMENTOS_VECTORIALES (RAG con pgvector para planos y especificaciones)
CREATE TABLE IF NOT EXISTS documentos_vectoriales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proyecto_id UUID REFERENCES proyectos(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL,
    tipo_doc VARCHAR(50) NOT NULL,
    file_url TEXT NOT NULL,
    embedding vector(1536), -- Vector OpenAI / Gemini Embedding
    metadata_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doc_vector ON documentos_vectoriales USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- =============================================================================
-- POLITICAS DE SEGURIDAD ROW LEVEL SECURITY (RLS) EN POSTGRESQL
-- =============================================================================

ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE proyectos ENABLE ROW LEVEL SECURITY;
ALTER TABLE apus ENABLE ROW LEVEL SECURITY;
ALTER TABLE nominas ENABLE ROW LEVEL SECURITY;
ALTER TABLE nomina_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE agente_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Política por defecto: Solo usuarios de la misma empresa pueden consultar sus datos
CREATE POLICY empresa_isolation_policy ON proyectos
    FOR ALL
    USING (empresa_id = NULLIF(current_setting('app.current_empresa_id', true), '')::UUID);

CREATE POLICY empresa_usuarios_policy ON usuarios
    FOR ALL
    USING (empresa_id = NULLIF(current_setting('app.current_empresa_id', true), '')::UUID);

CREATE POLICY empresa_nominas_policy ON nominas
    FOR ALL
    USING (empresa_id = NULLIF(current_setting('app.current_empresa_id', true), '')::UUID);
