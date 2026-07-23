import openpyxl
import pandas as pd

filepath = r"c:\Users\ssanz\OneDrive\Documentos\ChainPointAI\SERVING\FlujoGerenciaPrueba\Dist. Costos Flujo.xlsx"
wb = openpyxl.load_workbook(filepath, data_only=True)
ws = wb["% Flujo"]

print("==========================================================================")
print(" INSPECCIÓN DETALLADA DE LA HOJA '% Flujo' (ANTICIPOS Y PORCENTAJES)")
print("==========================================================================")

# Buscar celdas o columnas que mencionen anticipo, 30%, 70%, o distribución
for r in range(1, 150):
    row_vals = [ws.cell(r, c).value for c in range(1, 20)]
    row_str = " | ".join([str(v) if v is not None else "" for v in row_vals])
    if any(keyword in row_str.lower() for keyword in ["30%", "70%", "anticipo", "material", "mano", "lavado", "tuberia", "cajeo", "porcentaje"]):
        print(f"Fila {r:3d}: {row_str}")
