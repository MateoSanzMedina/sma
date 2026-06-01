import pandas as pd

def main():
    # Load schedule
    schedule_df = pd.read_excel(r"c:\Users\ssanz\OneDrive\Documentos\ChainPointAI\SERVING\SMA\backend\documents\1111.xlsx")
    col_map = {col: str(col).upper() for col in schedule_df.columns}
    name_col = next((c for c, u in col_map.items() if 'NOMBRE' in u), None)
    level_col = next((c for c, u in col_map.items() if 'ESQUEMA' in u or 'NIVEL' in u or 'LEVEL' in u), None)
    
    print("--- DETALLE DE TAREAS ENTRE LAS FILAS 275 Y 315 EN EL CRONOGRAMA ---")
    for idx in range(275, min(315, len(schedule_df))):
        row = schedule_df.iloc[idx]
        if pd.notna(row[name_col]):
            level = int(row[level_col]) if level_col and pd.notna(row[level_col]) else 3
            print(f"Row {idx} | Nivel {level} | Name: '{str(row[name_col]).strip()}'")

if __name__ == "__main__":
    main()
