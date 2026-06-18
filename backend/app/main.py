from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.analysis import router as analysis_router
from app.api.payroll import router as payroll_router
from app.api.costs import router as costs_router
import uvicorn

app = FastAPI(
    title="SMA - Serving Management App Backend",
    description="Backend para el procesamiento de datos y análisis con IA para Constructora Serving S.A.S.",
    version="1.0.0"
)

# Configuración de CORS para permitir peticiones desde el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción, especificar el dominio del frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir routers
app.include_router(analysis_router, prefix="/api/v1", tags=["Analysis"])
app.include_router(payroll_router, prefix="/api/v1/payroll", tags=["Payroll"])
app.include_router(costs_router, prefix="/api/v1/costs", tags=["Costs"])

@app.get("/")
async def root():
    return {"message": "SMA Backend API is running", "status": "ok"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
