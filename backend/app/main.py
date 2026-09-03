from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.security import SECURITY_HEADERS
from app.api.analysis import router as analysis_router
from app.api.payroll import router as payroll_router
from app.api.costs import router as costs_router
from app.api.auth import router as auth_router
from app.api.audit import router as audit_router
from app.api.users import router as users_router
from app.db.session import engine, Base
import uvicorn
import logging

logger = logging.getLogger("sma.main")

# Inicialización de Rate Limiter (Protección contra DDoS / Brute Force OWASP A04)
limiter = Limiter(key_func=get_remote_address, default_limits=[f"{settings.RATE_LIMIT_PER_MINUTE}/minute"])

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend de alto rendimiento y seguridad para Constructora Serving S.A.S.",
    version=settings.VERSION,
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,  # Desactivar Swagger en Prod
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Middleware de Encabezados de Seguridad OWASP (HSTS, CSP, X-Frame-Options)
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    for header_name, header_value in SECURITY_HEADERS.items():
        response.headers[header_name] = header_value
    return response

# Middleware de Manejo Centralizado de Excepciones (OWASP A05: No Stack Trace Leak)
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Error no manejado en {request.url.path}: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "message": "Se produjo un error interno en el servidor. Por favor intente más tarde.",
            "error_type": exc.__class__.__name__
        }
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://sma.chainpoint.ai",
        "https://app.serving.com.co",
        "https://sma-serving.vercel.app"
    ],
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Evento de inicio: Intentar inicializar esquemas de BD
@app.on_event("startup")
async def startup_event():
    logger.info("Iniciando SMA Backend Service...")
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Base de datos e índices sincronizados.")
    except Exception as e:
        logger.warning(f"Aviso de inicio: No hay una base de datos PostgreSQL activa en localhost ({type(e).__name__}). El servidor iniciará correctamente.")

# Registrar routers de API v1
app.include_router(auth_router, prefix=f"{settings.API_V1_STR}/auth", tags=["Auth"])
app.include_router(users_router, prefix=f"{settings.API_V1_STR}/users", tags=["Users Management"])
app.include_router(audit_router, prefix=f"{settings.API_V1_STR}/audit", tags=["Agent Audit Logs (HITL)"])
app.include_router(analysis_router, prefix=settings.API_V1_STR, tags=["Analysis"])
app.include_router(payroll_router, prefix=f"{settings.API_V1_STR}/payroll", tags=["Payroll"])
app.include_router(costs_router, prefix=f"{settings.API_V1_STR}/costs", tags=["Costs"])

@app.get("/")
async def root():
    return {
        "message": f"{settings.PROJECT_NAME} Backend está en ejecución",
        "version": settings.VERSION,
        "status": "ok"
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
