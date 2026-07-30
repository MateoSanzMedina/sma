import pandas as pd

proc_df = pd.read_excel(r"C:\Users\ssanz\OneDrive\Documentos\ChainPointAI\SERVING\Desglose_Procesos_Sin_Admin.xlsx", sheet_name="Procesos (Prorrateado)")

print("TOP PROCESOS ESPECÍFICOS NO ASOCIADOS (PRORRATEADO):")
print("-" * 90)
for idx, row in proc_df.head(25).iterrows():
    print(f"[{row['Capítulo']}] {row['Proceso / Actividad']} | Monto: ${row['Costo Directo Total (COP)']:,.2f} COP ({row['% del No Asociado (Sin Admin)']:.2f}%)")
