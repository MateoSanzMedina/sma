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

def calculate_similarity_with_chapter(item_desc, item_chapter, task_name):
    desc_tokens = get_word_tokens(item_desc)
    chapter_tokens = get_word_tokens(item_chapter)
    task_tokens = get_word_tokens(task_name)
    
    if not task_tokens:
        return 0
        
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
        
    return desc_score + 0.3 * chapter_score

def get_top_budget_candidates(task_name, budgets, count=12):
    scored = []
    for b in budgets:
        score = calculate_similarity_with_chapter(b["desc"], b["chapter"], task_name)
        scored.append({"budget": b, "score": score})
    scored.sort(key=lambda x: (-x["score"], x["budget"]["desc"]))
    return [x["budget"] for x in scored[:count]]

def main():
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
        
        code, desc, unit, total_val, total_col_idx = "", "", "", 0, 8
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

    task_name = "pavimentación"
    print(f"\n--- BUSCANDO CANDIDATOS PARA '{task_name}' ---")
    cands = get_top_budget_candidates(task_name, budget_items, 12)
    for idx, b in enumerate(cands):
        score = calculate_similarity_with_chapter(b["desc"], b["chapter"], task_name)
        print(f"Cand {idx+1} | Score {score:.2f} | Code: {b['code']} | Desc: '{b['desc']}' (Cap: {b['chapter']})")

if __name__ == "__main__":
    main()
