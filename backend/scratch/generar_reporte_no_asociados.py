import os
import openpyxl
import pandas as pd

# Paths to files
base_dir = r"C:\Users\ssanz\OneDrive\Documentos\ChainPointAI\SERVING"
prorated_path = os.path.join(base_dir, "FlujoGerenciaPrueba", "informe_flujo_caja_serving_2026-07-21 (3).xlsx")
unprorated_path = os.path.join(base_dir, "FlujoGerenciaPrueba", "informe_flujo_caja_serving_2026-07-21 (4).xlsx")
budget_v5_path = os.path.join(base_dir, "20260303 Presupuesto Bosque de Agua V5.xlsx")
output_excel = os.path.join(base_dir, "Reporte_Costos_No_Asociados.xlsx")

print("==========================================================================")
print("  INICIANDO SCRIPT DE ANÁLISIS DE COSTOS NO ASOCIADOS (UNMAPPED COSTS)")
print("==========================================================================")

def process_file(filepath, report_name):
    if not os.path.exists(filepath):
        print(f"Archivo no encontrado: {filepath}")
        return None, None
    
    df = pd.read_excel(filepath, sheet_name="Flujo de Caja Mapeado")
    
    code_col = [c for c in df.columns if 'ódigo' in c or 'odigo' in c][0]
    cap_col = [c for c in df.columns if 'apítulo' in c or 'apitulo' in c][0]
    act_col = [c for c in df.columns if 'ctividad' in c or 'Ítem' in c or 'Item' in c][0]
    cost_col = [c for c in df.columns if 'Costo Directo' in c][0]
    total_cost_col = [c for c in df.columns if 'Costo con Indirectos' in c][0]

    total_direct = df[cost_col].sum()
    total_indirect = df[total_cost_col].sum()

    # Identificar ítems no asociados
    is_unmapped = df[code_col].astype(str).str.lower().str.contains("sin_presupuesto|huérfano|huerfano|unmapped|ninguno|n/a", regex=True)
    df_unmapped = df[is_unmapped].copy()
    df_mapped = df[~is_unmapped].copy()

    unmapped_direct = df_unmapped[cost_col].sum()
    unmapped_indirect = df_unmapped[total_cost_col].sum()

    pct_unmapped_direct = (unmapped_direct / total_direct * 100) if total_direct > 0 else 0
    pct_unmapped_indirect = (unmapped_indirect / total_indirect * 100) if total_indirect > 0 else 0

    print(f"\n---> {report_name}")
    print(f"  • Total Presupuesto Directo:      ${total_direct:,.2f} COP")
    print(f"  • Costo Directo NO Asociado:      ${unmapped_direct:,.2f} COP ({pct_unmapped_direct:.2f}%)")
    print(f"  • Tareas totales en informe:       {len(df)}")
    print(f"  • Tareas NO asociadas:            {len(df_unmapped)} ({len(df_unmapped)/len(df)*100:.2f}%)")

    # Resumen por Capítulo
    cap_grp = df_unmapped.groupby(cap_col)[cost_col].agg(['count', 'sum']).reset_index()
    cap_grp.columns = ['Capítulo', 'Cantidad Tareas', 'Costo Directo No Asociado (COP)']
    cap_grp['% sobre Costo No Asociado'] = (cap_grp['Costo Directo No Asociado (COP)'] / unmapped_direct * 100) if unmapped_direct > 0 else 0
    cap_grp['% sobre Presupuesto Total'] = (cap_grp['Costo Directo No Asociado (COP)'] / total_direct * 100) if total_direct > 0 else 0
    cap_grp = cap_grp.sort_values(by='Costo Directo No Asociado (COP)', ascending=False)

    return df_unmapped, cap_grp

df_unmapped_3, cap_3 = process_file(prorated_path, "1. INFORME PRORRATEADO (Flujo 3)")
df_unmapped_4, cap_4 = process_file(unprorated_path, "2. INFORME SIN PRORRATEAR (Flujo 4)")

# Exportar reporte Excel completo
with pd.ExcelWriter(output_excel, engine='openpyxl') as writer:
    if cap_3 is not None:
        cap_3.to_excel(writer, sheet_name="Resumen Capítulos (Prorrateado)", index=False)
        df_unmapped_3.to_excel(writer, sheet_name="Detalle Tareas No Asociadas (3)", index=False)
    if cap_4 is not None:
        cap_4.to_excel(writer, sheet_name="Resumen Capítulos (Sin Prorr)", index=False)
        df_unmapped_4.to_excel(writer, sheet_name="Detalle Tareas No Asociadas (4)", index=False)

print(f"\n✅ Reporte completo exportado exitosamente a: {output_excel}")
