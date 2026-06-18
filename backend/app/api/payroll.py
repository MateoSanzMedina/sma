from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.payroll_service import compare_payroll_files

router = APIRouter()

@router.post("/compare")
async def compare_payroll(
    siimed: UploadFile = File(...),
    arus: UploadFile = File(...)
):
    """
    Recibe un archivo de nómina de SIIMED (Excel/CSV) y un archivo de planilla de ARUS (Excel).
    Realiza la validación automática cruzada de aportes y IBC.
    """
    try:
        # Leer contenidos
        siimed_content = await siimed.read()
        arus_content = await arus.read()
        
        # Procesar comparación
        result = await compare_payroll_files(
            siimed_content,
            siimed.filename,
            arus_content,
            arus.filename
        )
        
        return {"success": True, "data": result}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al comparar planillas: {str(e)}")
