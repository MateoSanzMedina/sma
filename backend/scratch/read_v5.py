import openpyxl
import pandas as pd

ppto_path = r"C:\Users\ssanz\OneDrive\Documentos\ChainPointAI\SERVING\20260303 Presupuesto Bosque de Agua V5.xlsx"

wb = openpyxl.load_workbook(ppto_path, data_only=True)
sheet = wb['Presupuesto V5']

print("Filas 1-20 de 'Presupuesto V5':")
for r in range(1, 25):
    row_vals = [sheet.cell(row=r, column=c).value for c in range(1, 12)]
    print(f"Row {r:2d}: {row_vals}")
