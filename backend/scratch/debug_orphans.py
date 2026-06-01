import pandas as pd
import re
import unicodedata

SYNONYM_GROUPS = [
    ["acueducto", "alcantarillado", "hidraulico", "sanitario", "pluvial", "tuberia", "tubo", "agua", "redes", "acometida", "registro", "valvula", "caja", "bajante", "desague", "ventila", "drenaje", "sifon", "pvc", "presion", "pozo", "filtro", "canal", "canalizacion"],
    ["concreto", "cemento", "mortero", "viga", "columna", "losa", "zapata", "cimentacion", "fundacion", "acero", "hierro", "refuerzo", "estructura", "pilote", "placa", "pedestal", "muro", "formaleta", "malla", "electrosoldada", "estribo", "figurado", "fundicion"],
    ["excavacion", "corte", "relleno", "tierras", "descapote", "subrasante", "sotano", "movimiento", "perfilacion", "carga", "retiro", "escombros", "afirmado", "terraplen", "retro", "cargador"],
    ["enchape", "ceramica", "porcelanato", "baldosa", "piso", "pintura", "estuco", "yeso", "acabado", "cielo", "raso", "muro", "pañete", "revoque", "enchapes", "vinilo", "drywall", "superboard", "masilla", "griferia", "lavamanos", "ducha", "grifos"],
    ["electrico", "cable", "conduit", "lampara", "luminaria", "iluminacion", "redes", "tablero", "acometida", "toma", "interruptor", "transformador", "ducto", "breaker", "fusible", "polo", "tierra", "citofono", "camara", "cctv"],
    ["anden", "bordillo", "sardinel", "via", "pavimento", "asfalto", "urbanismo", "externo", "calzada", "subbase", "adoquin", "grama", "jardineria", "arbol", "prado", "cerramiento", "reja", "porton", "parque"],
    ["madera", "puerta", "marco", "cerradura", "chapa", "bisagra", "closet", "cocina", "mueble", "repisa", "metalica", "aluminio", "hierro", "ventana", "vidrio", "templado", "pasamanos", "baranda"],
    ["herramienta", "equipo", "transporte", "flete", "acarreo", "aseo", "limpieza", "campamento", "cerramiento", "provisional", "seguridad", "casco", "guantes", "señalizacion", "topografia", "replanteo", "localizacion"]
]

def get_word_tokens(text):
    if not text:
        return []
    clean = ''.join(c for c in unicodedata.normalize('NFD', str(text).lower()) if unicodedata.category(c) != 'Mn')
    words = re.sub(r'[^a-z0-9\s]', ' ', clean).split()
    stopwords = {
        "de", "en", "para", "con", "el", "la", "los", "las", "un", "una", "y", "o", "del", "al", "a", "e", "u",
        "suministro", "instalacion", "mano", "obra", "herramienta", "equipo", "transporte", "flete", "acarreo",
        "suministros", "instalaciones", "manos", "obras", "equipos"
    }
    return [w.strip() for w in words if len(w.strip()) > 1 and w.strip() not in stopwords]

def calculate_semantic_similarity(item_desc, task_name):
    item_tokens = get_word_tokens(item_desc)
    task_tokens = get_word_tokens(task_name)
    if not item_tokens or not task_tokens:
        return 0
    match_score = 0
    for i_tok in item_tokens:
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
    return match_score / len(item_tokens)

def main():
    # Load schedule
    schedule_df = pd.read_excel(r"c:\Users\ssanz\OneDrive\Documentos\ChainPointAI\SERVING\SMA\backend\documents\1111.xlsx")
    col_map = {col: str(col).upper() for col in schedule_df.columns}
    name_col = next((c for c, u in col_map.items() if 'NOMBRE' in u), None)
    level_col = next((c for c, u in col_map.items() if 'ESQUEMA' in u or 'NIVEL' in u or 'LEVEL' in u), None)
    
    tasks = []
    for _, row in schedule_df.iterrows():
        if pd.notna(row[name_col]):
            level = int(row[level_col]) if level_col and pd.notna(row[level_col]) else 3
            tasks.append({"name": str(row[name_col]).strip(), "level": level})
            
    granular_tasks = [t for t in tasks if t["level"] >= 3]
    if not granular_tasks:
        granular_tasks = tasks
        
    print(f"Total granular tasks loaded: {len(granular_tasks)}")
    
    # List some tasks that have 'electr' in them
    elec_tasks = [t for t in granular_tasks if 'electr' in t["name"].lower() or 'red' in t["name"].lower() or 'transf' in t["name"].lower()]
    print(f"\nSample schedule tasks related to electrical/redes ({len(elec_tasks)}):")
    for t in elec_tasks[:15]:
        print(f"- {t['name']} (Level {t['level']})")
        
    # Load budget items
    budget_xl = pd.ExcelFile(r"c:\Users\ssanz\OneDrive\Documentos\ChainPointAI\SERVING\SMA\backend\documents\20260303 Presupuesto Bosque de Agua V5.xlsx")
    budget_sheet = next((s for s in budget_xl.sheet_names if "V5" in s), budget_xl.sheet_names[0])
    budget_df = budget_xl.parse(budget_sheet, header=None)
    
    budget_items = []
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
            
        c0 = str(row[0]).strip() if pd.notna(row[0]) else ""
        c1 = str(row[1]).strip() if pd.notna(row[1]) else ""
        
        code = ""
        desc = ""
        unit = ""
        total_val = 0
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
                
    print(f"\nTotal budget items loaded: {len(budget_items)}")
    
    # Test specific unmapped items
    unmapped_examples = [
        "Totem para zona comun obra civil (transformadores y bombeos)",
        "Red primaria canalizada subterranea electricos",
        "Transformador 75 kva tipo pedestal electricos",
        "Transformador 50 kva tipo pedestal electricos",
        "Transformador 37.5 kva tipo pedestal electricos"
    ]
    
    print("\n--- ANALIZANDO COINCIDENCIAS PARA PROCESOS HUÉRFANOS ---")
    for target_desc in unmapped_examples:
        # Find the budget item
        b_item = next((b for b in budget_items if target_desc.lower() in b["desc"].lower()), None)
        if not b_item:
            print(f"\nNo se encontró el ítem de presupuesto: '{target_desc}'")
            continue
            
        print(f"\nPresupuesto: Code: {b_item['code']} | Chapter: {b_item['chapter']} | Desc: '{b_item['desc']}' ($ {b_item['val']:,})")
        
        # Calculate scores for all tasks
        scored_tasks = []
        for task in granular_tasks:
            score = calculate_semantic_similarity(b_item["desc"], task["name"])
            scored_tasks.append((task["name"], score))
            
        scored_tasks.sort(key=lambda x: -x[1])
        print("Top 5 mejores coincidencias semánticas en el cronograma:")
        for t_name, score in scored_tasks[:5]:
            print(f"  Score {score:.2f} -> '{t_name}'")

if __name__ == "__main__":
    main()
