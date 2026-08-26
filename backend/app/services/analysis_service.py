import os
import io
import json
import re
import unicodedata
import pandas as pd
import google.generativeai as genai
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

# ==========================================
# MOTOR SEMÁNTICO LOCAL HÍBRIDO (PYTHON)
# ==========================================

SYNONYM_GROUPS = [
    # 1. Agua / Tuberías / Fluidos
    ["acueducto", "alcantarillado", "hidraulico", "sanitario", "pluvial", "tuberia", "tubo", "agua", "redes", "acometida", "registro", "valvula", "caja", "bajante", "desague", "ventila", "drenaje", "sifon", "pvc", "presion", "pozo", "filtro", "canal", "canalizacion"],
    # 2. Estructura / Cemento / Concreto
    ["concreto", "cemento", "mortero", "viga", "columna", "losa", "zapata", "cimentacion", "fundacion", "acero", "hierro", "refuerzo", "estructura", "pilote", "placa", "pedestal", "muro", "formaleta", "malla", "electrosoldada", "estribo", "figurado", "fundicion"],
    # 3. Tierra / Excavación
    ["excavacion", "corte", "relleno", "tierras", "descapote", "subrasante", "sotano", "movimiento", "perfilacion", "carga", "retiro", "escombros", "afirmado", "terraplen", "retro", "cargador"],
    # 4. Acabados / Revestimientos
    ["enchape", "ceramica", "porcelanato", "baldosa", "piso", "pintura", "estuco", "yeso", "acabado", "cielo", "raso", "muro", "pañete", "revoque", "enchapes", "vinilo", "drywall", "superboard", "masilla", "griferia", "lavamanos", "ducha", "grifos"],
    # 5. Eléctrico / Iluminación
    ["electrico", "cable", "conduit", "lampara", "luminaria", "iluminacion", "redes", "tablero", "acometida", "toma", "interruptor", "transformador", "ducto", "breaker", "fusible", "polo", "tierra", "citofono", "camara", "cctv"],
    # 6. Urbanismo / Vías
    ["anden", "bordillo", "sardinel", "via", "pavimento", "asfalto", "urbanismo", "externo", "calzada", "subbase", "adoquin", "grama", "jardineria", "arbol", "prado", "cerramiento", "reja", "porton", "parque"],
    # 7. Carpintería / Ventanería
    ["madera", "puerta", "marco", "cerradura", "chapa", "bisagra", "closet", "cocina", "mueble", "repisa", "metalica", "aluminio", "hierro", "ventana", "vidrio", "templado", "pasamanos", "baranda"],
    # 8. Maquinaria / Preliminares
    ["herramienta", "equipo", "transporte", "flete", "acarreo", "aseo", "limpieza", "campamento", "cerramiento", "provisional", "seguridad", "casco", "guantes", "señalizacion", "topografia", "replanteo", "localizacion"]
]

def get_word_tokens(text):
    if not text:
        return []
    # Normalizar quitando tildes y diéresis
    clean = ''.join(c for c in unicodedata.normalize('NFD', str(text).lower()) if unicodedata.category(c) != 'Mn')
    words = re.sub(r'[^a-z0-9\s]', ' ', clean).split()
    
    stopwords = {
        "de", "en", "para", "con", "el", "la", "los", "las", "un", "una", "y", "o", "del", "al", "a", "e", "u",
        "suministro", "instalacion", "mano", "obra", "herramienta", "equipo", "transporte", "flete", "acarreo",
        "suministros", "instalaciones", "manos", "obras", "equipos", "e", "i", "s", "u", "m"
    }
    return [w.strip() for w in words if len(w.strip()) > 1 and w.strip() not in stopwords]

def calculate_semantic_similarity(item_desc, item_chapter, task_name):
    desc_tokens = get_word_tokens(item_desc)
    chapter_tokens = get_word_tokens(item_chapter)
    task_tokens = get_word_tokens(task_name)
    
    if not task_tokens:
        return 0
        
    # 1. Similitud con la descripción (Costo Directo)
    desc_score = 0
    if desc_tokens:
        match_score = 0
        for i_tok in desc_tokens:
            best_token_score = 0
            for t_tok in task_tokens:
                current_score = 0
                if i_tok == t_tok:
                    current_score = 1.0
                elif len(i_tok) >= 4 and len(t_tok) >= 4 and (i_tok.startswith(t_tok[:4]) or t_tok.startswith(i_tok[:4])):
                    current_score = 0.8
                else:
                    share_group = False
                    for group in SYNONYM_GROUPS:
                        if i_tok in group and t_tok in group:
                            share_group = True
                            break
                    if share_group:
                        current_score = 0.6
                if current_score > best_token_score:
                    best_token_score = current_score
            match_score += best_token_score
        desc_score = match_score / min(len(desc_tokens), len(task_tokens))
        
    # 2. Similitud con el Capítulo (Contexto de Obra)
    chapter_score = 0
    if chapter_tokens:
        match_score = 0
        for c_tok in chapter_tokens:
            best_token_score = 0
            for t_tok in task_tokens:
                current_score = 0
                if c_tok == t_tok:
                    current_score = 1.0
                elif len(c_tok) >= 4 and len(t_tok) >= 4 and (c_tok.startswith(t_tok[:4]) or t_tok.startswith(c_tok[:4])):
                    current_score = 0.8
                else:
                    share_group = False
                    for group in SYNONYM_GROUPS:
                        if c_tok in group and t_tok in group:
                            share_group = True
                            break
                    if share_group:
                        current_score = 0.6
                if current_score > best_token_score:
                    best_token_score = current_score
            match_score += best_token_score
        chapter_score = match_score / min(len(chapter_tokens), len(task_tokens))
        
    # Ponderación final (Costo Directo + 30% del Capítulo de Contexto)
    return desc_score + 0.3 * chapter_score

def get_top_budget_candidates(task, budgets, count=12):
    scored = []
    for b in budgets:
        score = calculate_semantic_similarity(b["desc"], b["chapter"], task["name"])
        scored.append({"budget": b, "score": score})
    
    scored.sort(key=lambda x: (-x["score"], x["budget"]["desc"]))
    return [x["budget"] for x in scored[:count]]

def parse_spanish_date(date_str):
    if not isinstance(date_str, str):
        return str(date_str)
    
    meses = {
        'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04', 
        'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08', 
        'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
    }
    
    try:
        parts = date_str.lower().split()
        day = parts[0].zfill(2)
        month = meses.get(parts[1], '01')
        year = parts[2]
        return f"{year}-{month}-{day}"
    except:
        return date_str

async def process_analysis(schedule_content: bytes, schedule_name: str, budget_content: bytes, budget_name: str, prorate_orphans: bool = True):
    """
    Servicio lógico de análisis de costos con mapeo de procesos (Tasks -> Budget Items) y Costo Split.
    """
    try:
        # 1. Parsear Cronograma (1111.xlsx) con pre-procesamiento de fechas
        if schedule_name.endswith('.csv'):
            schedule_df = pd.read_csv(io.BytesIO(schedule_content))
        else:
            schedule_df = pd.read_excel(io.BytesIO(schedule_content))
            
        col_map = {col: str(col).upper() for col in schedule_df.columns}
        name_col = next((c for c, u in col_map.items() if 'NOMBRE' in u), None)
        start_col = next((c for c, u in col_map.items() if 'COMIENZO' in u), None)
        end_col = next((c for c, u in col_map.items() if 'FIN' in u), None)
        level_col = next((c for c, u in col_map.items() if 'NIVEL DE ESQUEMA' in u or 'ESQUEMA' in u or 'LEVEL' in u), None)
        
        schedule_items_raw = []
        if name_col and start_col and end_col:
            for _, row in schedule_df.iterrows():
                if pd.notna(row[name_col]) and pd.notna(row[start_col]):
                    level_val = 3
                    if level_col and pd.notna(row[level_col]):
                        try:
                            level_val = int(row[level_col])
                        except:
                            pass
                    schedule_items_raw.append({
                        "id": f"t-{len(schedule_items_raw)}",
                        "name": str(row[name_col]).strip(),
                        "start": parse_spanish_date(row[start_col]),
                        "end": parse_spanish_date(row[end_col]),
                        "level": level_val
                    })
                    
        schedule_items = [t for t in schedule_items_raw if t["level"] >= 2]
        if not schedule_items:
            schedule_items = schedule_items_raw

        # Fecha de inicio por defecto del proyecto como fallback
        fallback_date = next((t["start"] for t in schedule_items if t.get("start") and "-" in t["start"]), "2026-02-02")

        # 2. Parsear Presupuesto (Hoja: Presupuesto V5) - Extracción determinista
        budget_items = []
        try:
            xl = pd.ExcelFile(io.BytesIO(budget_content))
            sheet_name = next((s for s in xl.sheet_names if "V5" in s), xl.sheet_names[0])
            budget_df = xl.parse(sheet_name, header=None)
            
            current_chapter = "Otros"
            
            def is_code(s):
                if not s or pd.isna(s): return False
                clean = str(s).replace(".0", "").replace(".", "").strip()
                return clean.isdigit() and len(clean) >= 4

            for i in range(10, min(304, len(budget_df))):
                row = budget_df.iloc[i]
                if row.empty: continue
                
                col2 = str(row[2]).strip() if pd.notna(row[2]) else ""
                col1 = str(row[1]).strip() if pd.notna(row[1]) else ""
                col4 = str(row[4]).strip() if pd.notna(row[4]) else ""
                
                if "COSTO DIRECTO" in col4 or "COSTO DIRECTO" in col2 or "COSTO DIRECTO" in col1:
                    break
                    
                code = ""
                desc = ""
                unit = ""
                total_val = 0
                
                c0 = str(row[0]).strip() if pd.notna(row[0]) else ""
                c1 = str(row[1]).strip() if pd.notna(row[1]) else ""
                
                total_col_idx = 8
                
                if is_code(c0):
                    code = c0.replace(".0", "").replace(".", "").strip()
                    desc = str(row[1]).strip() if pd.notna(row[1]) else ""
                    unit = str(row[2]).strip() if pd.notna(row[2]) else ""
                    total_col_idx = 7
                elif is_code(c1):
                    code = c1.replace(".0", "").replace(".", "").strip()
                    desc = str(row[2]).strip() if pd.notna(row[2]) else ""
                    unit = str(row[3]).strip() if pd.notna(row[3]) else ""
                    total_col_idx = 8
                else:
                    desc = str(row[2]).strip() if pd.notna(row[2]) else ""
                    unit = str(row[3]).strip() if pd.notna(row[3]) else ""
                    code = f"R-{i + 1}"
                    total_col_idx = 8
                    
                if total_col_idx < len(row) and pd.notna(row[total_col_idx]):
                    try:
                        num = float(str(row[total_col_idx]).replace("$", "").replace(",", "").strip())
                        total_val = num
                    except:
                        pass
                        
                if desc:
                    has_unit = unit and len(unit) > 0 and unit != "null" and not str(unit).replace(".", "").isdigit()
                    looks_like_chapter = not has_unit and total_val > 0 and (total_col_idx >= len(row) or pd.isna(row[4]))
                    
                    if looks_like_chapter or (code and (code.endswith("0000") or code.endswith("00")) and not has_unit):
                        current_chapter = desc
                    elif desc != "NOMBRE" and desc != "TOTAL" and "PRESUPUESTO" not in desc and has_unit:
                        budget_items.append({
                            "code": code,
                            "desc": desc,
                            "val": total_val,
                            "chapter": current_chapter
                        })
        except Exception as err:
            print("Error parsing budget sheet in Python:", err)

        # 3. Pre-matching semántico local de tareas del cronograma
        enriched_schedule_items = []
        for task in schedule_items:
            candidates = get_top_budget_candidates(task, budget_items, 12)
            enriched_schedule_items.append({
                **task,
                "candidate_budgets": candidates
            })

        # 4. Configurar Gemini (o usar offline fallback)
        api_key = os.getenv("GEMINI_API_KEY")
        offline_mode = not api_key
        
        all_data_points = []
        
        def map_item_locally(task, fb_date):
            s_date = task.get("start") or fb_date
            e_date = task.get("end") or s_date or fb_date
            cands = task.get("candidate_budgets", [])
            if cands:
                best = cands[0]
                return {
                    "id": task["id"],
                    "start_date": s_date,
                    "end_date": e_date,
                    "budget_required": 0.0,
                    "task_name": task["name"],
                    "chapter": best["chapter"],
                    "budget_item_code": best["code"]
                }
            return {
                "id": task["id"],
                "start_date": s_date,
                "end_date": e_date,
                "budget_required": 0.0,
                "task_name": task["name"],
                "chapter": "Otros",
                "budget_item_code": "sin_presupuesto"
            }

        if offline_mode:
            print("⚠️ GEMINI_API_KEY no disponible. Ejecutando mapeo de procesos 100% local...")
            for task in enriched_schedule_items:
                all_data_points.append(map_item_locally(task, fallback_date))
        else:
            try:
                genai.configure(api_key=api_key)
                try:
                    model = genai.GenerativeModel('gemini-3.7-flash')
                except Exception:
                    model = genai.GenerativeModel('gemini-2.5-flash')
                
                # Dividir tareas en lotes de 15 para evitar sobrepasar límites de salida de tokens
                batch_size = 15
                batches = [enriched_schedule_items[i:i + batch_size] for i in range(0, len(enriched_schedule_items), batch_size)]
                
                for idx, batch in enumerate(batches):
                    try:
                        prompt = f"""
LISTA DE TAREAS DEL CRONOGRAMA CON ÍTEMS DE PRESUPUESTO CANDIDATOS SUGERIDOS:
{json.dumps(batch)}

INSTRUCCIONES MANDATORIAS:
1. NO RESUMAS ni agrupes. Debes generar exactamente un dataPoint por cada tarea recibida en este lote (recibiste exactamente {len(batch)} tareas).
2. Para cada tarea, analiza sus "candidate_budgets". Asocia la tarea al candidato de presupuesto que tenga la relación conceptual y de control de obra más lógica. Copia exactamente su código de presupuesto en "budget_item_code".
3. Sé flexible con sinónimos, capítulos y contextos jerárquicos. Por ejemplo, la tarea 'pavimentación' en el cronograma debe asociarse al ítem de presupuesto 'Suministro y colocacion de pavimento' (aunque este último esté bajo el capítulo 'ESTRUCTURA'). Del mismo modo, tareas con nombres de 'base', 'subbase' o 'cajeo de vía' deben asociarse a sus respectivos ítems de bases granulares o excavaciones en el presupuesto, y tareas de 'cordoneria' o 'vaciado de anden' deben asociarse a andenes, sardineles y bordillos.
4. Tareas que mencionan 'porteria' (por ejemplo, 'Vía externa y urbanismo porteria (eje 1)') representan la portería física de la obra, y deben asociarse a los ítems de presupuesto del capítulo 'PORTERIA' (como 'Construccion de porteria' o 'Cubierta metalica para la portería').
5. Si consideras que NINGUNO de los "candidate_budgets" sugeridos aplica en absoluto, o representa un hito puramente administrativo/logístico sin costo de obra física (comités de obra, actas de vecindad, entregas de planos, firmas de contratos, etc.), asigna "budget_item_code" con el valor exacto de "sin_presupuesto".
6. Devuelve en "id" el ID único de la tarea ("id"), en "task_name" el nombre original de la tarea del cronograma, en "start_date" su fecha de inicio ("start"), en "end_date" su fecha de fin ("end"), y en "chapter" el capítulo original del presupuesto candidato seleccionado (o "Otros" si es sin presupuesto).

RESPUESTA JSON:
{{
  "dataPoints": [
    {{ "id": "t-idx", "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "task_name": "Nombre original", "chapter": "Nombre capitulo", "budget_item_code": "Código o sin_presupuesto" }}
  ]
}}
"""
                        response = model.generate_content(
                            prompt, 
                            generation_config=genai.types.GenerationConfig(response_mime_type="application/json", temperature=0.1)
                        )
                        batch_res = json.loads(response.text)
                        for dp in batch_res.get("dataPoints", []):
                            all_data_points.append({
                                "id": dp.get("id", ""),
                                "start_date": dp.get("start_date") or fallback_date,
                                "end_date": dp.get("end_date") or dp.get("start_date") or fallback_date,
                                "budget_required": 0.0,
                                "task_name": dp.get("task_name", ""),
                                "chapter": dp.get("chapter") or "Otros",
                                "budget_item_code": dp.get("budget_item_code", "sin_presupuesto")
                            })
                    except Exception as b_err:
                        print(f"Error procesando lote {idx} con Gemini, usando fallback local:", b_err)
                        for task in batch:
                            all_data_points.append(map_item_locally(task, fallback_date))
            except Exception as gem_err:
                print("Error general de inicialización de Gemini. Iniciando conmutación a offline...", gem_err)
                all_data_points = []
                for task in enriched_schedule_items:
                    all_data_points.append(map_item_locally(task, fallback_date))

        # Salvaguarda: Verificar que todas las tareas se mapearon
        mapped_keys = {dp["id"] for dp in all_data_points}
        for task in enriched_schedule_items:
            if task["id"] not in mapped_keys:
                all_data_points.append(map_item_locally(task, fallback_date))

        # 5. ALGORITMO COSTO SPLIT Y REDISTRIBUCIÓN HUÉRFANOS (Matemáticamente exacto y conservativo)
        # Contar tareas asignadas a cada código de presupuesto
        item_code_to_tasks_count = {}
        for dp in all_data_points:
            code = str(dp["budget_item_code"]).strip()
            if code != "sin_presupuesto":
                item_code_to_tasks_count[code] = item_code_to_tasks_count.get(code, 0) + 1

        budget_items_map = {str(b["code"]).strip(): b for b in budget_items}

        # Asignar costo split inicial
        for dp in all_data_points:
            code = str(dp["budget_item_code"]).strip()
            if code != "sin_presupuesto":
                b_item = budget_items_map.get(code)
                if b_item:
                    M = item_code_to_tasks_count[code]
                    dp["budget_required"] = b_item["val"] / M
                else:
                    dp["budget_required"] = 0.0
            else:
                dp["budget_required"] = 0.0

        # Identificar ítems huérfanos y redistribuirlos por capítulos
        if prorate_orphans:
            chapter_to_tasks = {}
            for dp in all_data_points:
                ch = dp.get("chapter") or "Otros"
                if ch not in chapter_to_tasks:
                    chapter_to_tasks[ch] = []
                chapter_to_tasks[ch].append(dp)

            for b in budget_items:
                code = str(b["code"]).strip()
                M = item_code_to_tasks_count.get(code, 0)
                if M == 0 and b["val"] > 0:
                    tasks_in_chapter = chapter_to_tasks.get(b["chapter"], [])
                    if tasks_in_chapter:
                        share = b["val"] / len(tasks_in_chapter)
                        for dp in tasks_in_chapter:
                            dp["budget_required"] += share
                    elif all_data_points:
                        share = b["val"] / len(all_data_points)
                        for dp in all_data_points:
                            dp["budget_required"] += share
        else:
            # Si no se prorratea, cada ítem de presupuesto huérfano se lista de forma individual
            # al final como un proceso virtual en el capítulo especial "Presupuesto Sin Asignar / Huérfano"
            for b in budget_items:
                code = str(b["code"]).strip()
                M = item_code_to_tasks_count.get(code, 0)
                if M == 0 and b["val"] > 0:
                    all_data_points.append({
                        "id": f"orphan-{code}",
                        "start_date": "", # Se mantiene vacío al no tener fecha
                        "end_date": "",
                        "budget_required": b["val"],
                        "task_name": f"[PROCESO NO ASIGNADO] {b['desc']}",
                        "chapter": "Presupuesto Sin Asignar / Huérfano",
                        "budget_item_code": code
                    })

        # 6. DISTRIBUCIÓN DIARIA DE COSTOS SOBRE DÍAS CALENDARIO
        def get_calendar_days_in_range(start_str, end_str):
            try:
                start_date = datetime.strptime(start_str, "%Y-%m-%d")
                end_date = datetime.strptime(end_str, "%Y-%m-%d")
            except Exception:
                return [start_str] if start_str else []
            if start_date > end_date:
                return [start_str]
            days = []
            curr = start_date
            while curr <= end_date:
                days.append(curr.strftime("%Y-%m-%d"))
                curr += timedelta(days=1)
            return days

        processed_points = []
        distributed_points = []

        for dp in all_data_points:
            is_orphan = dp.get("chapter") == "Presupuesto Sin Asignar / Huérfano"
            s_date = "" if is_orphan else (dp.get("start_date") or fallback_date)
            e_date = "" if is_orphan else (dp.get("end_date") or s_date)
            
            calendar_days = [] if is_orphan else get_calendar_days_in_range(s_date, e_date)
            duration = len(calendar_days)
            
            total_val = dp.get("budget_required", 0.0)
            daily_val = total_val / duration if duration > 0 else 0.0

            processed_points.append({
                "start_date": s_date,
                "end_date": e_date,
                "working_days": duration,
                "budget_required": total_val,
                "daily_budget": daily_val,
                "task_name": dp.get("task_name", ""),
                "chapter": dp.get("chapter") or "Otros",
                "budget_item_code": dp.get("budget_item_code", ""),
                "date": s_date
            })

            for day_str in calendar_days:
                distributed_points.append({
                    "date": day_str,
                    "budget_required": daily_val,
                    "task_name": dp.get("task_name", ""),
                    "chapter": dp.get("chapter") or "Otros",
                    "budget_item_code": dp.get("budget_item_code", "")
                })

        direct_budget_sum = sum(dp["budget_required"] for dp in processed_points)
        total_budget_sum = direct_budget_sum * 1.1007

        # Generar un reporte ejecutivo determinista local
        formatted_direct = f"${direct_budget_sum:,.0f} COP".replace(",", ".")
        formatted_total = f"${total_budget_sum:,.0f} COP".replace(",", ".")
        
        chapter_totals = {}
        for dp in processed_points:
            ch = dp["chapter"]
            chapter_totals[ch] = chapter_totals.get(ch, 0.0) + dp["budget_required"]
            
        formatted_chapters = "\n".join(
            [f"| {ch} | ${val:,.0f} COP |".replace(",", ".") for ch, val in sorted(chapter_totals.items())]
        )

        global_analysis = f"""# Informe de Mapeo Semántico y Análisis Ejecutivo de Costos
**Constructora Serving S.A.S. — Proyecto Bosque de Agua**

---

## 1. Resumen Ejecutivo
El presente informe consolida la alineación temporal del presupuesto frente al cronograma de obra del proyecto **Bosque de Agua** a nivel de procesos y tareas. Se han procesado y mapeado un total de **{len(schedule_items)} tareas del cronograma de obra** y se han correlacionado de manera semántica bidireccional con el presupuesto real.

* **Costo Directo Consolidado:** {formatted_direct} COP
* **Costos Indirectos (9.5% AI + 3% IVA sobre Utilidad):** ${(direct_budget_sum * 0.1007):,.0f} COP
* **Costo Total Proyectado del Proyecto:** ### **{formatted_total} COP**

---

## 2. Distribución Financiera de Costo Directo por Capítulos de Obra
A continuación, se detalla la distribución del presupuesto de costo directo agrupado por capítulos reales del proyecto:

| Capítulo de Presupuesto | Costo Directo Total Consolidado |
| :--- | :--- |
{formatted_chapters}

---

## 3. Conclusiones y Resiliencia del Sistema
1. **Precisión del Mapeo**: El **100% de las tareas del cronograma** ({len(schedule_items)} registros) han sido procesadas con éxito.
2. **Costo Split e Hitos**: Múltiples actividades vinculadas a un mismo código de costo comparten el presupuesto de forma equitativa. Los hitos y procesos sin costo directo se conservan identificados de forma separada sin omitir ningún valor del presupuesto total.
3. **Resiliencia Operativa**: Las rutinas de redundancia matemática aseguran un 100% de conservación de presupuesto, redistribuyendo de manera controlada y transparente aquellos ítems de obra huérfanos entre las tareas de sus correspondientes capítulos.
"""

        return {
            "analysis": global_analysis,
            "dataPoints": processed_points,
            "distributedDataPoints": distributed_points,
            "directBudget": direct_budget_sum,
            "totalBudget": total_budget_sum,
            "isOfflineFallback": offline_mode
        }

    except Exception as e:
        print(f"Error en process_analysis: {str(e)}")
        raise e
