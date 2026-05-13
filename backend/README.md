# SMA Backend - API de Procesamiento Logístico

Este es el backend independiente para **Serving Management App (SMA)**, diseñado para manejar la lógica pesada de procesamiento de archivos y análisis con Inteligencia Artificial (Gemini).

## Tecnologías
- **Python 3.11+**
- **FastAPI**: Framework web de alto rendimiento.
- **Pandas**: Para procesamiento robusto de Excel y CSV.
- **Google Generative AI**: Integración con Gemini 2.5 Pro.
- **Docker**: Para despliegue simplificado en VPS.

## Estructura
- `/app/main.py`: Punto de entrada y configuración de la API.
- `/app/api/`: Definición de endpoints (Routes).
- `/app/services/`: Lógica de negocio (Análisis IA, Parsing).
- `Dockerfile`: Configuración para contenedorización.

## Despliegue en VPS (Hetzner/Ubuntu)

### Opción 1: Con Docker (Recomendado)
1. Instalar Docker en el VPS.
2. Subir la carpeta `backend/` al servidor.
3. Crear un archivo `.env` con tu `GEMINI_API_KEY`.
4. Ejecutar:
   ```bash
   docker build -t sma-backend .
   docker run -d -p 8000:8000 --env-file .env sma-backend
   ```

### Opción 2: Instalación Manual
1. Instalar Python 3.11 y pip.
2. Instalar dependencias: `pip install -r requirements.txt`.
3. Ejecutar con uvicorn:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

## Endpoints Principales
- `POST /api/v1/analysis/process`: Recibe `schedule` (CSV/XLSX) y `budget` (XLSX). Devuelve JSON de flujo de caja.
