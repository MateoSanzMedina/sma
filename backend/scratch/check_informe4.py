import pandas as pd

df = pd.read_excel(r"C:\Users\ssanz\OneDrive\Documentos\ChainPointAI\SERVING\FlujoGerenciaPrueba\informe_flujo_caja_serving_2026-07-21 (4).xlsx", sheet_name="Flujo de Caja Mapeado")

print("Head 10 of informe 4:")
print(df[['Código', 'Capítulo', 'Actividad / Ítem de Obra (MS Project)', 'Costo Directo Total (COP)']].head(10))

print("\nValue counts of Código:")
print(df['Código'].value_counts().head(10))

sin_presupuesto_df = df[df['Código'] == 'sin_presupuesto']
print("\nTotal sum of 'sin_presupuesto' items:", sin_presupuesto_df['Costo Directo Total (COP)'].sum())

presupuesto_mapeado_df = df[df['Código'] != 'sin_presupuesto']
print("Total sum of mapped items:", presupuesto_mapeado_df['Costo Directo Total (COP)'].sum())
