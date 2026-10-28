from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from app.services.analysis_service import process_analysis
from typing import Optional
import json

router = APIRouter()

@router.post("/analysis/process")
async def analyze_files(
    schedule: UploadFile = File(...),
    budget: UploadFile = File(...),
    prorate_orphans: Optional[bool] = Form(None),
    prorateOrphans: Optional[bool] = Form(None),
    enable_anticipo: Optional[bool] = Form(None),
    enableAnticipo: Optional[bool] = Form(None),
    anticipo_percentage: Optional[float] = Form(None),
    anticipoPercentage: Optional[float] = Form(None),
    anticipo_months: Optional[int] = Form(None),
    anticipoMonths: Optional[int] = Form(None)
):
    """
    Recibe un archivo de cronograma (CSV/XLSX) y un presupuesto (XLSX).
    Realiza la correlación inteligente y devuelve un análisis de flujo de caja.
    Soporta archivos de gran tamaño sin las restricciones de 4.5 MB de Vercel.
    """
    try:
        actual_prorate = prorate_orphans if prorate_orphans is not None else (prorateOrphans if prorateOrphans is not None else True)
        actual_enable_anticipo = enable_anticipo if enable_anticipo is not None else (enableAnticipo if enableAnticipo is not None else True)
        actual_anticipo_pct = anticipo_percentage if anticipo_percentage is not None else (anticipoPercentage if anticipoPercentage is not None else 30.0)
        actual_anticipo_months = anticipo_months if anticipo_months is not None else (anticipoMonths if anticipoMonths is not None else 1)

        # Leer contenidos
        schedule_content = await schedule.read()
        budget_content = await budget.read()
        
        # Procesar
        result = await process_analysis(
            schedule_content=schedule_content, 
            schedule_name=schedule.filename or "cronograma.xlsx",
            budget_content=budget_content,
            budget_name=budget.filename or "presupuesto.xlsx",
            prorate_orphans=actual_prorate,
            enable_anticipo=actual_enable_anticipo,
            anticipo_percentage=actual_anticipo_pct,
            anticipo_months=actual_anticipo_months
        )
        
        return {"success": True, "data": result}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
