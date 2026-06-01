import pandas as pd

def main():
    # Load budget
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
                
    # Search for items with specific keywords
    keywords = ["caja", "tub", "pedestal", "electr"]
    print("--- DETALLE DE ÍTEMS DE PRESUPUESTO QUE CONTIENEN PALABRAS CLAVE ELÉCTRICAS/OBRA CIVIL ---")
    for kw in keywords:
        results = [b for b in budget_items if kw in b["desc"].lower()]
        print(f"\nPalabra clave: '{kw}' ({len(results)} items):")
        for b in results[:10]:
            print(f"  Code: {b['code']} | Chapter: {b['chapter']} | Desc: '{b['desc']}' ($ {b['val']:,})")

if __name__ == "__main__":
    main()
