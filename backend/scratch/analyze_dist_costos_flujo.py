import openpyxl
import pandas as pd

filepath = r"c:\Users\ssanz\OneDrive\Documentos\ChainPointAI\SERVING\FlujoGerenciaPrueba\Dist. Costos Flujo.xlsx"
wb = openpyxl.load_workbook(filepath, data_only=True)

print("==========================================================================")
print(" ESTRUCTURA DETALLADA DE Dist. Costos Flujo.xlsx")
print("==========================================================================")

for sheet in ["% Flujo", "APU", "CANTIDADES ET 4", "MOV TIERRA", "DATOS"]:
    if sheet in wb.sheetnames:
        df = pd.read_excel(filepath, sheet_name=sheet)
        print(f"\n--- SHEET: {sheet} ---")
        print(f"Dimensiones: {df.shape}")
        print("Columnas:", df.columns.tolist()[:10])
        print("Muestra de datos (primeras 5 filas):")
        print(df.iloc[:5, :8])

# Inspeccionar hoja % Flujo para entender cómo vincula actividades y costos
df_flujo = pd.read_excel(filepath, sheet_name="% Flujo")
print("\n--- DETALLE DE LA HOJA '% Flujo' ---")
print(df_flujo.head(20))
