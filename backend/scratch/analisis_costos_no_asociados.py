import os
import openpyxl
import pandas as pd

file3 = r"C:\Users\ssanz\OneDrive\Documentos\ChainPointAI\SERVING\FlujoGerenciaPrueba\informe_flujo_caja_serving_2026-07-21 (3).xlsx"
file4 = r"C:\Users\ssanz\OneDrive\Documentos\ChainPointAI\SERVING\FlujoGerenciaPrueba\informe_flujo_caja_serving_2026-07-21 (4).xlsx"

def analyze_informe(filepath, label):
    print(f"\n=======================================================")
    print(f"ANÁLISIS DE COSTOS NO ASOCIADOS: {label}")
    print(f"=======================================================")
    df = pd.read_excel(filepath, sheet_name="Flujo de Caja Mapeado")
    print("Columnas:", list(df.columns))
    print(f"Total registros: {len(df)}")
    
    # Renombrar columnas si es necesario
    # ['Nº', 'Código', 'Capítulo', 'Actividad / Ítem de Obra (MS Project)', 'Fecha Inicio', 'Fecha Fin', 'Duración (Días)', 'Costo Directo Total (COP)', 'Costo con Indirectos (COP)']
    
    code_col = [c for c in df.columns if 'ódigo' in c or 'odigo' in c][0]
    cap_col = [c for c in df.columns if 'apítulo' in c or 'apitulo' in c][0]
    act_col = [c for c in df.columns if 'ctividad' in c or 'Ítem' in c or 'Item' in c][0]
    cost_col = [c for c in df.columns if 'Costo Directo' in c][0]
    total_cost_col = [c for c in df.columns if 'Costo con Indirectos' in c][0]

    total_direct_budget = df[cost_col].sum()
    total_with_indirect = df[total_cost_col].sum()

    print(f"Costo Directo Total en Informe: ${total_direct_budget:,.2f} COP")
    print(f"Costo Total con Indirectos:     ${total_with_indirect:,.2f} COP")

    # Ítems sin presupuesto asociado (código == 'sin_presupuesto')
    unmapped = df[df[code_col].astype(str).str.lower().str.contains("sin_presupuesto|huérfano|huerfano|unmapped|ninguno|n/a", regex=True)]
    mapped = df[~df[code_col].astype(str).str.lower().str.contains("sin_presupuesto|huérfano|huerfano|unmapped|ninguno|n/a", regex=True)]

    unmapped_direct = unmapped[cost_col].sum()
    unmapped_indirect = unmapped[total_cost_col].sum()

    pct_direct = (unmapped_direct / total_direct_budget * 100) if total_direct_budget > 0 else 0
    pct_indirect = (unmapped_indirect / total_with_indirect * 100) if total_with_indirect > 0 else 0

    print(f"\n--- MÉRTRICAS DE COSTOS NO ASOCIADOS (SIN PRESUPUESTO CORRELACIONADO) ---")
    print(f"Cantidad de tareas no asociadas: {len(unmapped)} de {len(df)} tareas ({len(unmapped)/len(df)*100:.2f}%)")
    print(f"Monto Costo Directo No Asociado: ${unmapped_direct:,.2f} COP ({pct_direct:.2f}%)")
    print(f"Monto Costo Total No Asociado:  ${unmapped_indirect:,.2f} COP ({pct_indirect:.2f}%)")

    print("\n--- DESGLOSE POR CAPÍTULO DE LOS COSTOS NO ASOCIADOS ---")
    cap_summary = unmapped.groupby(cap_col)[cost_col].agg(['count', 'sum']).reset_index()
    cap_summary.columns = ['Capítulo', 'Cant. Tareas', 'Costo Directo (COP)']
    cap_summary['% del Total No Asociado'] = (cap_summary['Costo Directo (COP)'] / unmapped_direct * 100) if unmapped_direct > 0 else 0
    cap_summary['% del Presupuesto Total'] = (cap_summary['Costo Directo (COP)'] / total_direct_budget * 100) if total_direct_budget > 0 else 0
    cap_summary = cap_summary.sort_values(by='Costo Directo (COP)', ascending=False)
    
    for idx, row in cap_summary.iterrows():
        print(f"  • {row['Capítulo']}: {row['Cant. Tareas']} tareas | ${row['Costo Directo (COP)']:,.2f} COP | {row['% del Total No Asociado']:.2f}% del no asociado ({row['% del Presupuesto Total']:.2f}% del presupuesto total)")

    print("\n--- TOP 10 ACTIVIDADES ESPECÍFICAS NO ASOCIADAS DE MAYOR COSTO ---")
    top_unmapped = unmapped.sort_values(by=cost_col, ascending=False).head(10)
    for idx, row in top_unmapped.iterrows():
        print(f"  - [{row[cap_col]}] {row[act_col]}: ${row[cost_col]:,.2f} COP (Duración: {row.get('Duración (Días)', 'N/A')} días)")

if os.path.exists(file3):
    analyze_informe(file3, "INFORME 3 (Prorrateado)")

if os.path.exists(file4):
    analyze_informe(file4, "INFORME 4 (Sin Prorratear)")
