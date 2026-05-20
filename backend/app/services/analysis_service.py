import os
import io
import json
import pandas as pd
import google.generativeai as genai
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

async def process_analysis(schedule_content: bytes, schedule_name: str, budget_content: bytes, budget_name: str):
    """
    Servicio lógico para procesar archivos y llamar a Gemini.
    """
    try:
        # 1. Parsear Cronograma (1111.xlsx) con pre-procesamiento de fechas
        if schedule_name.endswith('.csv'):
            schedule_df = pd.read_csv(io.BytesIO(schedule_content))
        else:
            schedule_df = pd.read_excel(io.BytesIO(schedule_content))
        
        # Mapeo de meses en español para parsing manual
        meses = {
            'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04', 
            'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08', 
            'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
        }

        def parse_spanish_date(date_str):
            if not isinstance(date_str, str): return str(date_str)
            try:
                parts = date_str.lower().split()
                # Ejemplo: "2 febrero 2026 9:00 a.m." -> [2, febrero, 2026, ...]
                day = parts[0].zfill(2)
                month = meses.get(parts[1], '01')
                year = parts[2]
                return f"{year}-{month}-{day}"
            except:
                return date_str

        col_map = {col: col.upper() for col in schedule_df.columns}
        name_col = next((c for c, u in col_map.items() if 'NOMBRE' in u), None)
        start_col = next((c for c, u in col_map.items() if 'COMIENZO' in u), None)
        end_col = next((c for c, u in col_map.items() if 'FIN' in u), None)

        schedule_data = []
        if name_col and start_col and end_col:
            for _, row in schedule_df.iterrows():
                if pd.notna(row[name_col]) and pd.notna(row[start_col]):
                    schedule_data.append({
                        "name": str(row[name_col]),
                        "start": parse_spanish_date(row[start_col]),
                        "end": parse_spanish_date(row[end_col])
                    })

        # 2. Parsear Presupuesto (Hoja: Presupuesto V5) - Extracción masiva
        budget_items = []
        try:
            budget_df = pd.read_excel(io.BytesIO(budget_content), sheet_name='Presupuesto V5', header=None)
            for _, row in budget_df.iterrows():
                try:
                    code = str(row[1])
                    # Detectar filas de ítems reales (códigos largos)
                    if code.replace('.','').isdigit() and len(code) > 4:
                        budget_items.append({
                            "code": code,
                            "desc": str(row[2]),
                            "val": float(row[8]) if pd.notna(row[8]) else (float(row[7]) if pd.notna(row[7]) else 0)
                        })
                except: continue
        except:
            pass

        # 3. Configurar Gemini con instrucción de NO RESUMEN
        api_key = os.getenv("GEMINI_API_KEY")
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.5-flash')

        prompt = f"""
        Eres un Gerente de Control de Proyectos en Constructora Serving S.A.S.
        OBJETIVO: Generar un desglose DIARIO Y GRANULAR. 
        TENGO HIERRO, CONCRETO, EXCAVACIONES, ETC. QUIERO VERLOS TODOS.

        DATOS (Procesados):
        - Cronograma: {json.dumps(schedule_data[:400])}
        - Presupuesto: {json.dumps(budget_items[:500])}

        INSTRUCCIONES MANDATORIAS:
        1. PROHIBIDO RESUMIR POR MES. Quiero un punto de datos por cada subproceso/ítem que encuentres.
        2. Si un ítem del presupuesto coincide con una tarea del cronograma, genera una entrada con la fecha de inicio de esa tarea.
        3. El campo "process_name" debe ser el Capítulo (ej: "ESTRUCTURA", "REDES HIDROSANITARIAS").
        4. No omitas ningún ítem del presupuesto que tenga valor mayor a 0.

        RESPUESTA JSON:
        {{
          "analysis": "Breve resumen ejecutivo.",
          "dataPoints": [
            {{ "date": "YYYY-MM-DD", "budget_required": 0.0, "task_name": "Nombre exacto del ítem", "process_name": "Capítulo" }}
          ],
          "totalBudget": 0.0
        }}
        """

        response = model.generate_content(prompt, generation_config=genai.types.GenerationConfig(response_mime_type="application/json", temperature=0.1))
        return json.loads(response.text)

    except Exception as e:
        print(f"Error en process_analysis: {str(e)}")
        raise e
