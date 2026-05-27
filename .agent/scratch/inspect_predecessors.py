import pandas as pd

try:
    df = pd.read_excel(r"c:\Users\ssanz\OneDrive\Documentos\ChainPointAI\SERVING\SMA\backend\documents\1111.xlsx")
    # Filter rows where Predecesoras is not empty and is a string (contains CC, FF, etc.)
    preds = df[df['Predecesoras'].notna() & df['Predecesoras'].astype(str).str.contains('[A-Za-z]', regex=True)]
    print(f"Found {len(preds)} rows with special predecessor syntax:")
    print(preds[['Id', 'Nombre', 'Duración', 'Comienzo', 'Fin', 'Predecesoras']].head(20).to_string())
except Exception as e:
    print("Error:", e)
