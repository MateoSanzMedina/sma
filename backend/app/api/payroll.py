from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import StreamingResponse
from app.services.payroll_service import compare_payroll_files
from app.services.generator_service import (
    generate_arus_ingresos,
    generate_arus_novedades,
    generate_final_planilla_ss,
    classify_and_consolidate_files
)
import io
import os

router = APIRouter()

@router.post("/compare")
async def compare_payroll(
    siimed_files: list[UploadFile] = File(...),
    arus_files: list[UploadFile] = File(...)
):
    """
    Recibe listas de archivos de SIIMED y ARUS para validar diferencias.
    Consolida dinámicamente los informes cargados.
    """
    try:
        # Leer archivos SIIMED
        siimed_list = []
        for file in siimed_files:
            content = await file.read()
            siimed_list.append((content, file.filename))
            
        # Leer archivos ARUS
        arus_list = []
        for file in arus_files:
            content = await file.read()
            arus_list.append((content, file.filename))
            
        if not siimed_list or not arus_list:
            raise HTTPException(status_code=400, detail="Debe subir al menos un archivo de SIIMED y uno de ARUS.")

        # Consolidar SIIMED dinámicamente
        siimed_dfs = classify_and_consolidate_files(siimed_list)
        df_siimed = siimed_dfs.get("consolidado")
        if df_siimed.empty:
            df_siimed = siimed_dfs.get("extras")
            
        if df_siimed.empty:
            # Fallback al primer archivo si no clasifica como consolidado o extras
            siimed_content = siimed_list[0][0]
            siimed_name = siimed_list[0][1]
        else:
            out = io.BytesIO()
            df_siimed.to_excel(out, index=False)
            out.seek(0)
            siimed_content = out.getvalue()
            siimed_name = "siimed_consolidado.xlsx"

        # Tomar el primer archivo de ARUS (ej. Autoliquidación)
        arus_content = arus_list[0][0]
        arus_name = arus_list[0][1]
        
        result = await compare_payroll_files(
            siimed_content,
            siimed_name,
            arus_content,
            arus_name
        )
        
        return {"success": True, "data": result}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al comparar planillas: {str(e)}")

@router.post("/generate/ingresos")
async def generate_ingresos(
    files: list[UploadFile] = File(...)
):
    try:
        files_data = []
        for f in files:
            content = await f.read()
            files_data.append((content, f.filename))
            
        file_bytes = await generate_arus_ingresos(files_data)
        
        return StreamingResponse(
            io.BytesIO(file_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=PLANILLA_INGRESOS_ARUS.xlsx"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando planilla de ingresos: {str(e)}")

@router.post("/generate/novedades")
async def generate_novedades(
    files: list[UploadFile] = File(...)
):
    try:
        files_data = []
        for f in files:
            content = await f.read()
            files_data.append((content, f.filename))
            
        file_bytes = await generate_arus_novedades(files_data)
        
        return StreamingResponse(
            io.BytesIO(file_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=PLANILLA_NOVEDADES_ARUS.xlsx"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando planilla de novedades: {str(e)}")

@router.post("/generate/final")
async def generate_final(
    files: list[UploadFile] = File(...)
):
    try:
        files_data = []
        for f in files:
            content = await f.read()
            files_data.append((content, f.filename))
            
        file_bytes = await generate_final_planilla_ss(files_data)
        
        return StreamingResponse(
            io.BytesIO(file_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=Planilla_seguridad_social_final.xlsx"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando planilla final: {str(e)}")

TEMPLATE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")

@router.get("/templates")
async def get_templates_info():
    """
    Retorna la información de metadatos de las plantillas ARUS almacenadas en el backend.
    """
    templates = ["PLANILLA INGRESOS ARUS.xlsx", "PLANILLA NOVEDADES ARUS.xlsx"]
    result = []
    for t in templates:
        path = os.path.join(TEMPLATE_DIR, t)
        exists = os.path.exists(path)
        size = os.path.getsize(path) if exists else 0
        import time
        mtime = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(os.path.getmtime(path))) if exists else "Desconocido"
        result.append({
            "name": t,
            "exists": exists,
            "size": size,
            "last_modified": mtime
        })
    return {"success": True, "templates": result}

@router.post("/templates/upload")
async def upload_template(
    type: str = Form(...),  # "ingresos" o "novedades"
    file: UploadFile = File(...)
):
    """
    Permite subir y actualizar las plantillas ARUS en blanco almacenadas en el sistema.
    """
    if type not in ["ingresos", "novedades"]:
        raise HTTPException(status_code=400, detail="El tipo de planilla debe ser 'ingresos' o 'novedades'.")
        
    filename = "PLANILLA INGRESOS ARUS.xlsx" if type == "ingresos" else "PLANILLA NOVEDADES ARUS.xlsx"
    target_path = os.path.join(TEMPLATE_DIR, filename)
    
    try:
        content = await file.read()
        os.makedirs(TEMPLATE_DIR, exist_ok=True)
        with open(target_path, "wb") as f:
            f.write(content)
        return {"success": True, "message": f"Plantilla de {type} actualizada correctamente."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar la plantilla: {str(e)}")
