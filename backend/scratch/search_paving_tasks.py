import pandas as pd

def main():
    # Load schedule
    schedule_df = pd.read_excel(r"c:\Users\ssanz\OneDrive\Documentos\ChainPointAI\SERVING\SMA\backend\documents\1111.xlsx")
    col_map = {col: str(col).upper() for col in schedule_df.columns}
    name_col = next((c for c, u in col_map.items() if 'NOMBRE' in u), None)
    level_col = next((c for c, u in col_map.items() if 'ESQUEMA' in u or 'NIVEL' in u or 'LEVEL' in u), None)
    
    tasks = []
    for idx, row in schedule_df.iterrows():
        if pd.notna(row[name_col]):
            level = int(row[level_col]) if level_col and pd.notna(row[level_col]) else 3
            tasks.append({"id": idx, "name": str(row[name_col]).strip(), "level": level})
            
    # Search for keywords
    keywords = ["via", "asfalto", "calzada", "subbase", "rodadura", "mezcla", "capa", "imprim"]
    print("--- BUSCANDO TAREAS DE PAVIMENTACIÓN EN EL CRONOGRAMA ---")
    for kw in keywords:
        results = [t for t in tasks if kw in t["name"].lower()]
        print(f"\nPalabra clave: '{kw}' ({len(results)} tareas):")
        for t in results[:10]:
            print(f"  ID: {t['id']} | Level: {t['level']} | Name: '{t['name']}'")

if __name__ == "__main__":
    main()
