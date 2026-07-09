import os
import pandas as pd

folder = r"c:\Users\ssanz\OneDrive\Documentos\ChainPointAI\SERVING\gestion humana"
ingresos_file = "PLANILLA INGRESOS ARUS.xlsx"
novedades_file = "PLANILLA NOVEDADES ARUS.xlsx"

for name, file in [("Ingresos", ingresos_file), ("Novedades", novedades_file)]:
    path = os.path.join(folder, file)
    if os.path.exists(path):
        print(f"\n========================================\nFile: {file}")
        xl = pd.ExcelFile(path)
        print(f"Sheets: {xl.sheet_names}")
        for sheet in xl.sheet_names:
            df = pd.read_excel(path, sheet_name=sheet)
            print(f"Sheet '{sheet}' - Shape: {df.shape}")
            if df.shape[0] > 0:
                print("First 3 rows:")
                print(df.head(3).to_dict(orient="records"))
            else:
                print("Sheet is empty.")
    else:
        print(f"File not found: {path}")
