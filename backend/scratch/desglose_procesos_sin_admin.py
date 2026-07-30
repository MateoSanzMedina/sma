import os
import pandas as pd

base_dir = r"C:\Users\ssanz\OneDrive\Documentos\ChainPointAI\SERVING"
file_prorated = os.path.join(base_dir, "FlujoGerenciaPrueba", "informe_flujo_caja_serving_2026-07-21 (3).xlsx")
file_unprorated = os.path.join(base_dir, "FlujoGerenciaPrueba", "informe_flujo_caja_serving_2026-07-21 (4).xlsx")
output_excel = os.path.join(base_dir, "Desglose_Procesos_Sin_Admin.xlsx")

def breakdown_processes(file_path, mode_title):
    if not os.path.exists(file_path):
        print(f"Archivo no encontrado: {file_path}")
        return None, None, None

    df = pd.read_excel(file_path, sheet_name="Flujo de Caja Mapeado")

    code_col = [c for c in df.columns if 'ódigo' in c or 'odigo' in c][0]
    cap_col = [c for c in df.columns if 'apítulo' in c or 'apitulo' in c][0]
    act_col = [c for c in df.columns if 'ctividad' in c or 'Ítem' in c or 'Item' in c][0]
    cost_col = [c for c in df.columns if 'Costo Directo' in c][0]
    total_cost_col = [c for c in df.columns if 'Costo con Indirectos' in c][0]

    # Identificar tareas no asociadas
    is_unmapped = df[code_col].astype(str).str.lower().str.contains("sin_presupuesto|huérfano|huerfano|unmapped|ninguno", regex=True)
    df_unmapped = df[is_unmapped].copy()

    # Excluir "GASTOS ADMINISTRATIVOS" o "ADMINISTRACION"
    is_admin = df_unmapped[cap_col].astype(str).str.upper().str.contains("GASTOS ADMINISTRATIVOS|ADMINISTRA", regex=True) | \
               df_unmapped[act_col].astype(str).str.upper().str.contains("GASTOS ADMINISTRATIVOS|ADMINISTRA", regex=True)
    
    df_unmapped_no_admin = df_unmapped[~is_admin].copy()
    df_admin = df_unmapped[is_admin].copy()

    total_direct_all = df[cost_col].sum()
    unmapped_total = df_unmapped[cost_col].sum()
    unmapped_no_admin_total = df_unmapped_no_admin[cost_col].sum()
    admin_total = df_admin[cost_col].sum()

    print(f"\n=======================================================")
    print(f" DESGLOSE DE PROCESOS NO ASOCIADOS (EXCLUYENDO GASTOS ADMINISTRATIVOS)")
    print(f" MODO: {mode_title.upper()}")
    print(f"=======================================================")
    print(f" • Presupuesto Directo Total en Informe:   ${total_direct_all:,.2f} COP")
    print(f" • Costo Directo No Asociado (Bruto):     ${unmapped_total:,.2f} COP (100.00% del no asociado)")
    print(f" • Gastos Administrativos No Asociados:   ${admin_total:,.2f} COP ({admin_total/unmapped_total*100:.2f}% del no asociado)")
    print(f" • COSTO NO ASOCIADO NETO (SIN ADMIN):     ${unmapped_no_admin_total:,.2f} COP ({unmapped_no_admin_total/unmapped_total*100:.2f}% del no asociado / {unmapped_no_admin_total/total_direct_all*100:.2f}% del total)")

    # Agrupar por Capítulo (excluyendo admin)
    cap_summary = df_unmapped_no_admin.groupby(cap_col)[cost_col].agg(['count', 'sum']).reset_index()
    cap_summary.columns = ['Capítulo', 'Cant Tareas', 'Costo Directo No Asociado (COP)']
    cap_summary['% del No Asociado (Sin Admin)'] = cap_summary['Costo Directo No Asociado (COP)'] / unmapped_no_admin_total * 100
    cap_summary['% del Presupuesto Total'] = cap_summary['Costo Directo No Asociado (COP)'] / total_direct_all * 100
    cap_summary = cap_summary.sort_values(by='Costo Directo No Asociado (COP)', ascending=False)

    print("\n--- RESUMEN POR CAPÍTULO (SIN GASTOS ADMINISTRATIVOS) ---")
    print(f"{'Capítulo':<45} | {'Cant':<4} | {'Monto Directo (COP)':<22} | {'% Sin Admin':<11} | {'% Total':<8}")
    print("-" * 100)
    for _, r in cap_summary.iterrows():
        cap_name = str(r['Capítulo'])[:43]
        print(f"{cap_name:<45} | {r['Cant Tareas']:<4} | ${r['Costo Directo No Asociado (COP)']:>20,.2f} | {r['% del No Asociado (Sin Admin)']:>10.2f}% | {r['% del Presupuesto Total']:>6.2f}%")

    # Agrupar por Proceso/Actividad Específica (excluyendo admin)
    proc_summary = df_unmapped_no_admin.groupby([cap_col, act_col])[cost_col].agg(['count', 'sum']).reset_index()
    proc_summary.columns = ['Capítulo', 'Proceso / Actividad', 'Cant Ocurrencias', 'Costo Directo Total (COP)']
    proc_summary['% del No Asociado (Sin Admin)'] = proc_summary['Costo Directo Total (COP)'] / unmapped_no_admin_total * 100
    proc_summary['% del Presupuesto Total'] = proc_summary['Costo Directo Total (COP)'] / total_direct_all * 100
    proc_summary = proc_summary.sort_values(by='Costo Directo Total (COP)', ascending=False)

    return cap_summary, proc_summary, df_unmapped_no_admin

cap_summary_3, proc_summary_3, df_no_admin_3 = breakdown_processes(file_prorated, "Modo Prorrateado (Informe 3)")
cap_summary_4, proc_summary_4, df_no_admin_4 = breakdown_processes(file_unprorated, "Modo Sin Prorratear (Informe 4)")

# Exportar a Excel
with pd.ExcelWriter(output_excel, engine='openpyxl') as writer:
    if cap_summary_3 is not None:
        cap_summary_3.to_excel(writer, sheet_name="Capítulos (Prorrateado)", index=False)
        proc_summary_3.to_excel(writer, sheet_name="Procesos (Prorrateado)", index=False)
        df_no_admin_3.to_excel(writer, sheet_name="Detalle Tareas (3)", index=False)
    if cap_summary_4 is not None:
        cap_summary_4.to_excel(writer, sheet_name="Capítulos (Sin Prorr)", index=False)
        proc_summary_4.to_excel(writer, sheet_name="Procesos (Sin Prorr)", index=False)
        df_no_admin_4.to_excel(writer, sheet_name="Detalle Tareas (4)", index=False)

print("\nReporte Excel exportado en: " + output_excel)
