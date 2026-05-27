import pandas as pd
import json

# Inspect Schedule
try:
    print("--- SCHEDULE COLUMNS ---")
    schedule_df = pd.read_excel(r"c:\Users\ssanz\OneDrive\Documentos\ChainPointAI\SERVING\SMA\backend\documents\1111.xlsx")
    print("Columns:", list(schedule_df.columns))
    print("\nFirst 5 rows:")
    print(schedule_df.head(5).to_string())
except Exception as e:
    print("Error reading schedule:", e)

# Inspect Budget Sheets
try:
    print("\n--- BUDGET SHEETS ---")
    xl = pd.ExcelFile(r"c:\Users\ssanz\OneDrive\Documentos\ChainPointAI\SERVING\SMA\backend\documents\20260303 Presupuesto Bosque de Agua V5.xlsx")
    print("Sheet names:", xl.sheet_names)
except Exception as e:
    print("Error reading budget sheets:", e)
