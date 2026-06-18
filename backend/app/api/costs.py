from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.costs_service import process_sao_costs

router = APIRouter()

@router.post("/process")
async def process_costs(
    file: UploadFile = File(...)
):
    """
    Recibe el archivo Excel de Costos por niveles de SAO.
    Calcula desviaciones de ejecución y proyecciones de materiales/financieras.
    """
    try:
        # Leer el contenido
        file_content = await file.read()
        
        # Procesar
        result = await process_sao_costs(file_content, file.filename)
        
        return {"success": True, "data": result}
        
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al procesar el cierre de costos: {str(e)}")
