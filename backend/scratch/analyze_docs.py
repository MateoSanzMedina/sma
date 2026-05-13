import pandas as pd
import sys

def analyze_excel(path):
    print(f"\n--- Analyzing: {path} ---")
    try:
        # Read without header to find the real header row
        df = pd.read_excel(path, header=None)
        
        found_header = False
        for i, row in df.iterrows():
            row_vals = [str(val).upper() for val in row.values if pd.notna(val)]
            row_str = " ".join(row_vals)
            
            # Keywords for schedule (1111.xlsx)
            if any(k in row_str for k in ["NOMBRE", "COMIENZO", "FIN", "DURACIÓN"]):
                print(f"Possible Schedule Header at Row {i}: {row.tolist()}")
                found_header = True
            
            # Keywords for budget
            if any(k in row_str for k in ["DESCRIPCIÓN", "VALOR TOTAL", "COSTO TOTAL", "CAPÍTULO"]):
                print(f"Possible Budget Header at Row {i}: {row.tolist()}")
                found_header = True
            
            if found_header and i > 15: # Limit output
                break
        
        print("\nFirst 15 rows of data (raw):")
        print(df.head(15).to_string())
        
    except Exception as e:
        print(f"Error analyzing {path}: {e}")

if __name__ == "__main__":
    analyze_excel(r"c:\Users\ssanz\OneDrive\Documentos\ChainPointAI\SERVING\SMA\backend\documents\1111.xlsx")
    analyze_excel(r"c:\Users\ssanz\OneDrive\Documentos\ChainPointAI\SERVING\SMA\backend\documents\20260303 Presupuesto Bosque de Agua V5.xlsx")
