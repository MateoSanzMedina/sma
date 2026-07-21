import os
import sys
import pandas as pd
import json

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from app.services.analysis_service import parse_spanish_date, get_top_budget_candidates

def run_fast_comparison():
    budget_path = os.path.join(os.path.dirname(__file__), "..", "documents", "20260303 Presupuesto Bosque de Agua V5.xlsx")
    schedule_path = os.path.join(os.path.dirname(__file__), "..", "documents", "1111.xlsx")

    # 1. Parsear Cronograma
    schedule_df = pd.read_excel(schedule_path)
    col_map = {col: str(col).upper() for col in schedule_df.columns}
    name_col = next((c for c, u in col_map.items() if 'NOMBRE' in u), None)
    start_col = next((c for c, u in col_map.items() if 'COMIENZO' in u), None)
    end_col = next((c for c, u in col_map.items() if 'FIN' in u), None)
    level_col = next((c for c, u in col_map.items() if 'ESQUEMA' in u or 'LEVEL' in u), None)

    schedule_items = []
    for _, row in schedule_df.iterrows():
        if pd.notna(row[name_col]) and pd.notna(row[start_col]):
            level_val = int(row[level_col]) if level_col and pd.notna(row[level_col]) else 3
            if level_val >= 2:
                schedule_items.append({
                    "id": f"t-{len(schedule_items)}",
                    "name": str(row[name_col]).strip(),
                    "start": parse_spanish_date(row[start_col]),
                    "end": parse_spanish_date(row[end_col]),
                    "level": level_val
                })

    # 2. Parsear Presupuesto
    xl = pd.ExcelFile(budget_path)
    sheet_name = next((s for s in xl.sheet_names if "V5" in s), xl.sheet_names[0])
    budget_df = xl.parse(sheet_name, header=None)

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

        total_val = 0.0
        if total_col_idx < len(row) and pd.notna(row[total_col_idx]):
            try:
                total_val = float(str(row[total_col_idx]).replace("$", "").replace(",", "").strip())
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

    total_direct_budget = sum(b["val"] for b in budget_items)

    # 3. Simular Mapeo Semántico Local
    mapped_points = []
    item_code_count = {}

    for task in schedule_items:
        candidates = get_top_budget_candidates(task, budget_items, 12)
        if candidates:
            best = candidates[0]
            mapped_points.append({
                "task_name": task["name"],
                "code": best["code"],
                "chapter": best["chapter"],
                "val": 0.0
            })
            item_code_count[best["code"]] = item_code_count.get(best["code"], 0) + 1
        else:
            mapped_points.append({
                "task_name": task["name"],
                "code": "sin_presupuesto",
                "chapter": "Otros",
                "val": 0.0
            })

    budget_map = {b["code"]: b for b in budget_items}

    # Asignación Costo Split
    for mp in mapped_points:
        if mp["code"] != "sin_presupuesto":
            b = budget_map.get(mp["code"])
            if b:
                M = item_code_count[mp["code"]]
                mp["val"] = b["val"] / M

    # Calcular ítems huérfanos
    orphans = []
    for b in budget_items:
        M = item_code_count.get(b["code"], 0)
        if M == 0 and b["val"] > 0:
            orphans.append(b)

    orphan_total_val = sum(o["val"] for o in orphans)
    directly_mapped_val = sum(mp["val"] for mp in mapped_points)

    print("\n=========================================================")
    print(" ANÁLISIS DE ANATOMÍA DE CORRELACIÓN DE COSTOS (PROYECTO BOSQUE DE AGUA)")
    print("=========================================================")
    print(f"Total Tareas del Cronograma Analyzed:  {len(schedule_items)}")
    print(f"Total Ítems de Presupuesto Reales:     {len(budget_items)}")
    print(f"Monto Costo Directo Total:              ${total_direct_budget:,.2f} COP".replace(",", "."))
    print("---------------------------------------------------------")
    print(f"1. Ítems Mapeados Directamente:         ${directly_mapped_val:,.2f} COP ({(directly_mapped_val/total_direct_budget)*100:.2f}%)")
    print(f"2. Partidas Huérfanas (Sin Tarea):      ${orphan_total_val:,.2f} COP ({(orphan_total_val/total_direct_budget)*100:.2f}%)")
    print(f"   - Cantidad de Partidas Huérfanas:    {len(orphans)} de {len(budget_items)} partidas")
    print("---------------------------------------------------------")

    # Mostrar desglose por capítulos en ambos escenarios
    chapter_mapped = {}
    for mp in mapped_points:
        ch = mp["chapter"]
        chapter_mapped[ch] = chapter_mapped.get(ch, 0.0) + mp["val"]

    chapter_orphans = {}
    for o in orphans:
        ch = o["chapter"]
        chapter_orphans[ch] = chapter_orphans.get(ch, 0.0) + o["val"]

    all_chapters = sorted(set(list(chapter_mapped.keys()) + list(chapter_orphans.keys())))

    print("\n=========================================================")
    print(" COMPORTAMIENTO POR CAPÍTULO: SIN PRORRATEO VS CON PRORRATEO")
    print("=========================================================")
    print(f"{'Capítulo de Presupuesto':<35} | {'Sin Prorratear':<18} | {'Huérfanos Reasociados':<22} | {'Con Prorrateo Final'}")
    print("-" * 100)

    for ch in all_chapters:
        mapped_v = chapter_mapped.get(ch, 0.0)
        orphan_v = chapter_orphans.get(ch, 0.0)
        prorated_v = mapped_v + orphan_v
        
        str_m = f"${mapped_v:,.0f}".replace(",", ".")
        str_o = f"+${orphan_v:,.0f}".replace(",", ".")
        str_p = f"${prorated_v:,.0f}".replace(",", ".")
        
        print(f"{ch:<35} | {str_m:<18} | {str_o:<22} | {str_p}")

if __name__ == "__main__":
    run_fast_comparison()
