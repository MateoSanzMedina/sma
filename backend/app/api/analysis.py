from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.analysis_service import process_analysis
import json

router = APIRouter()

@router.post("/analysis/process")
async def analyze_files(
    schedule: UploadFile = File(...),
    budget: UploadFile = File(...)
):
    """
    Recibe un archivo de cronograma (CSV/XLSX) y un presupuesto (XLSX).
    Realiza la correlación inteligente y devuelve un análisis de flujo de caja.
    """
    try:
        # Leer contenidos
        schedule_content = await schedule.read()
        budget_content = await budget.read()
        
        # Procesar
        result = await process_analysis(
            schedule_content, 
            schedule.filename,
            budget_content,
            budget.filename
        )
        
        return {"success": True, "data": result}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
