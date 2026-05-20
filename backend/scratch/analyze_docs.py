import pandas as pd
import openpyxl

def analyze_excel(path):
    print(f"\n--- Analyzing Excel file: {path} ---")
    try:
        xl = pd.ExcelFile(path)
        print("Sheet names:", xl.sheet_names)
        
        # Look for a sheet with 'Presupuesto V5' or similar
        sheet_name = None
        for name in xl.sheet_names:
            if 'Presupuesto V5' in name or 'Presupuesto' in name:
                sheet_name = name
                break
        
        if not sheet_name:
            sheet_name = xl.sheet_names[0]
            
        print(f"Loading sheet: {sheet_name}")
        df = pd.read_excel(path, sheet_name=sheet_name, header=None)
        
        print(f"Total rows in sheet: {len(df)}")
        print("\nFirst 80 rows:")
        for idx, row in df.head(80).iterrows():
            row_vals = [f"{i}:{val}" for i, val in enumerate(row.values) if pd.notna(val)]
            if row_vals:
                print(f"Row {idx}: {row_vals}")
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    analyze_excel(r"c:\Users\ssanz\OneDrive\Documentos\ChainPointAI\SERVING\SMA\backend\documents\20260303 Presupuesto Bosque de Agua V5.xlsx")

