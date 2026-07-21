# Guía Técnica de Handover — Módulo de Gestión Humana y Seguridad Social
**Constructora Serving S.A.S. — Sistema SMA**  
*Fecha de entrega:* 21 de julio de 2026  
*Destinatario:* Equipo de Desarrollo (Integración Antigravity)  

---

## 1. Resumen Ejecutivo del Módulo

El módulo de **Gestión Humana y Seguridad Social** de SMA tiene como objetivo automatizar dos grandes frentes operativos:
1. **Auditoría y Conciliación de Nómina (SIIMED vs. ARUS)**: Comparación empleado por empleado de los reportes del ERP interno de nómina (SIIMED) contra las planillas preliminares del operador de autoliquidación (ARUS). Detecta automáticamente discrepancias en Ingresos Bases de Cotización (IBC) y aportes a Salud, Pensión, ARL y Caja de Compensación (CCF).
2. **Generación Automática de Planillas ARUS**: Procesamiento dinámico de reportes parciales (incapacidades, licencias, vacaciones, horas extras) para generar los archivos Excel oficiales de carga masiva en ARUS (*Ingresos*, *Novedades* y *Planilla de Autoliquidación Final de 98 columnas*).

---

## 2. Arquitectura Técnica y Estructura de Archivos

El módulo utiliza una **arquitectura híbrida tolerante a fallos**:
- **Backend Principal (Python / FastAPI - Puerto 8000)**: Procesa los archivos con `pandas` y `openpyxl`, maneja la lógica pesada de concatenación, matching difuso de columnas y formateo de la planilla de 98 columnas.
- **Frontend / Backend Proxy (Next.js 15 / React 19 - Puerto 3000)**: Ofrece la interfaz visual en `src/app/(dashboard)/gestion-humana/seguridad-social/page.tsx` y actúa como proxy en `src/app/api/payroll/*`. Si el servidor de Python no responde, Next.js ejecuta un **fallback local en JavaScript** con `xlsx` para mantener la continuidad operativa.

### Ubicación de Código Fuente Clave

| Componente | Ruta de Archivo | Descripción de la Responsabilidad |
| :--- | :--- | :--- |
| **Página Frontend** | `src/app/(dashboard)/gestion-humana/seguridad-social/page.tsx` | UI para subida de archivos SIIMED/ARUS, gestión de plantillas y descarga de resultados. |
| **API Route Proxy (Next.js)** | `src/app/api/payroll/compare/route.ts` | Proxy que redirige a FastAPI o ejecuta la comparación local si Python está offline. |
| **API Router (FastAPI)** | `backend/app/api/payroll.py` | Endpoints `/compare`, `/generate/ingresos`, `/generate/novedades`, `/generate/final`, `/templates`. |
| **Servicio de Auditoría (Python)** | `backend/app/services/payroll_service.py` | Algoritmos de sanitización de cédulas, matching de columnas por palabras clave y cruce de IBCs/aportes. |
| **Servicio Generador (Python)** | `backend/app/services/generator_service.py` | Clasificación dinámica de reportes SIIMED, extracción de cotizantes y construcción del Excel de 98 columnas. |
| **Plantillas Excel Base** | `backend/app/templates/` | `PLANILLA INGRESOS ARUS.xlsx` y `PLANILLA NOVEDADES ARUS.xlsx`. |

---

## 3. Detalle de Procesos Implementados (100% Funcionales)

### A. Conciliación y Auditoría (SIIMED vs. ARUS)
- **Matching Dinámico de Columnas**: Identifica de forma inteligente variaciones en los nombres de columnas de ambos archivos (ej. *"Cédula"*, *"NIT"*, *"Documento Cotizante"* o *"Primer Nombre" + "Primer Apellido"*).
- **Consolidación por Cotizante**: Suma registros duplicados por empleado si un trabajador tiene múltiples renglones de nómina o novedades en el mes.
- **Detección de Discrepancias**: Compara los IBCs y aportes para Salud, Pensión, ARL y CCF. Se marca `has_discrepancy = True` si existe una diferencia mayor a **$1.0 COP** o si el cotizante está presente en una plataforma y ausente en la otra.

### B. Generación de Planilla de Ingresos ARUS
- **Clasificación Automática**: Filtra la lista única de empleados de los reportes subidos.
- **Formateo de Nombres**: Separa nombres completos en *Primer Nombre*, *Segundo Nombre*, *Primer Apellido* y *Segundo Apellido*.
- **Inyección en Plantilla**: Escribe los datos en la pestaña `COTIZANTES` del archivo `PLANILLA INGRESOS ARUS.xlsx`.

### C. Generación de Planilla de Novedades ARUS
- **Clasificación por Contenido**: Inspecciona los nombres de archivo y encabezados para separar *Incapacidades (IGE)*, *Licencias (SLN)* y *Vacaciones (VAC-LR)*.
- **Mapeo de Fechas**: Asocia las fechas de inicio y fin (`FECHA INICIAL`, `FECHA FINAL`) de cada evento laboral.
- **Inyección en Plantilla**: Escribe en la pestaña `NOVEDADES` del archivo `PLANILLA NOVEDADES ARUS.xlsx`.

### D. Planilla de Autoliquidación Final (98 Columnas)
- **Fila 1 (Metadatos Patronales)**: Escribe la cabecera patronal de Constructora Serving S.A.S. (NIT 900231851, actividad económica, período de cotización).
- **Fila 2+ (Detalle Cotizantes)**: Genera 98 columnas por cotizante, cruzando marcas "X" en novedades de tiempo (ING, RET, SLN, IGE, VAC-LR) con sus respectivas fechas de inicio y fin.

---

## 4. Tareas Pendientes y Próximos Pasos (Roadmap para el Compañero)

Para que tu compañero pueda continuar con el desarrollo y llevar el módulo al siguiente nivel, estas son las tareas prioritarias pendientes:

1. **Persistencia en Base de Datos (PostgreSQL)**
   - *Estado actual*: Los cruces se realizan en memoria y el resultado se descarga inmediatamente como Excel/JSON.
   - *Tarea pendiente*: Crear modelos con Prisma o Drizzle para almacenar el historial de auditorías mensuales (`PayrollAuditHistory`, `PayrollDiscrepancyLog`). Esto permitirá consultar discrepancias de meses anteriores en un historial gráfico.
2. **Cálculo de Reglas Especiales de Liquidación**
   - *Topes Legales*: Validar que el IBC no sea inferior a 1 SMMLV ni superior a 25 SMMLV.
   - *Fondo de Solidaridad Pensional (FSP / FSPS)*: Calcular automáticamente la tarifa progresiva (1% a 2%) para empleados con salario superior a 4 SMMLV.
   - *Tarifas ARL por Riesgo*: Asociar el Centro de Trabajo de cada empleado con su clase de riesgo específica (Riesgo I al V) para verificar la cotización exacta a la ARL.
3. **Notificaciones y Reportes Ejecutivos en PDF**
   - *Tarea pendiente*: Crear una función que genere un informe en PDF con el resumen de hallazgos y lo envíe por correo a la Dirección de Gestión Humana antes de realizar el pago en el operador.
4. **Pruebas de Borde e Integración E2E**
   - *Tarea pendiente*: Escribir pruebas automatizadas con Jest/Playwright o Pytest para validar archivos con nombres de columnas no estándar o caracteres especiales.

---

## 5. Lista de Archivos y Credenciales Necesarias para Transferir

Para que tu compañero configure su entorno local en su PC y pueda trabajar con Antigravity de inmediato, debes transferirle la siguiente lista de archivos:

### 1. Variables de Entorno (`.env`)
Debes entregarle una copia del archivo `.env` configurado en la raíz del proyecto (`SMA/.env`). Asegúrate de que contenga las siguientes claves:

```env
# Base de Datos (PostgreSQL local o VPS)
DATABASE_URL="postgres://usuario:password@localhost:5432/sma_db"

# Auth.js Secret
AUTH_SECRET="tu_secreto_generado"

# Configuración Backend Python
AI_BACKEND_URL="http://localhost:8000"
GEMINI_API_KEY="TU_API_KEY_DE_GEMINI"

# GCP Credentials (opcional si usa Vertex AI)
GCP_PROJECT_ID="serving-496214"
GCP_LOCATION="us-central1"
GOOGLE_APPLICATION_CREDENTIALS="C:\\ruta\\a\\tu\\credencial_gcp.json"
```

### 2. Archivos Físicos y Plantillas
* **Plantillas de ARUS**: La carpeta `backend/app/templates/` con los archivos:
  - `PLANILLA INGRESOS ARUS.xlsx`
  - `PLANILLA NOVEDADES ARUS.xlsx`
* **Credencial GCP (si aplica)**: El archivo JSON de cuenta de servicio de Google Cloud (ej. `serving-496214-2051433ebc77.json`).
* **Archivos de Prueba**: Copia de los informes reales de prueba ubicados en la carpeta `gestion humana` (`INFORME HORAS EXTRAS.xlsx`, `INFORME INCAPACIDADES.xlsx`, `INFORME LICENCIAS.xlsx`, `INFORME VACACIONESxlsx.xlsx`, etc.) para que pueda ejecutar pruebas locales.

---

## 6. Guía Rápida de Despliegue e Integración en Antigravity

Indícale a tu compañero que ejecute los siguientes pasos en su PC:

1. **Abrir el Espacio de Trabajo en Antigravity**:
   - Abrir la carpeta raíz `SMA` en Antigravity.
2. **Configurar el Backend de Python**:
   ```bash
   cd backend
   pip install -r requirements.txt
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
3. **Configurar el Frontend de Next.js**:
   ```bash
   # En la raíz del proyecto (SMA)
   npm install
   npm run dev
   ```
4. **Verificación de Operatividad**:
   - Navegar a `http://localhost:3000/gestion-humana/seguridad-social`.
   - Probar la carga de archivos de prueba y verificar que los botones de generación de planillas respondan correctamente.
