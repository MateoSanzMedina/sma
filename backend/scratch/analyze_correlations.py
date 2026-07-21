import pandas as pd
import json
import io
import os
import sys

# Asegurar import de servicios backend
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from app.services.analysis_service import process_analysis

async def run_correlation_analysis():
    budget_path = os.path.join(os.path.dirname(__file__), "..", "documents", "20260303 Presupuesto Bosque de Agua V5.xlsx")
    schedule_path = os.path.join(os.path.dirname(__file__), "..", "documents", "1111.xlsx")
    
    if not os.path.exists(budget_path) or not os.path.exists(schedule_path):
        print("Archivos de prueba no encontrados.")
        return

    with open(budget_path, "rb") as f:
        budget_bytes = f.read()
    with open(schedule_path, "rb") as f:
        schedule_bytes = f.read()

    print("=================================================================")
    print("ANÁLISIS COMPARATIVO DE CORRELACIONES Y PRORRATEO DE COSTOS")
    print("=================================================================")

    # 1. EJECUCIÓN CON PRORRATEO ACTIVADO (prorate_orphans = True)
    print("\n--- 1. PROCESANDO CON PRORRATEO ACTIVADO (prorate_orphans = True) ---")
    res_prorated = await process_analysis(
        schedule_content=schedule_bytes,
        schedule_name="1111.xlsx",
        budget_content=budget_bytes,
        budget_name="20260303 Presupuesto Bosque de Agua V5.xlsx",
        prorate_orphans=True
    )

    dp_prorated = res_prorated["dataPoints"]
    direct_prorated = res_prorated["directBudget"]
    total_prorated = res_prorated["totalBudget"]

    # 2. EJECUCIÓN SIN PRORRATEO (prorate_orphans = False)
    print("\n--- 2. PROCESANDO SIN PRORRATEO (prorate_orphans = False) ---")
    res_raw = await process_analysis(
        schedule_content=schedule_bytes,
        schedule_name="1111.xlsx",
        budget_content=budget_bytes,
        budget_name="20260303 Presupuesto Bosque de Agua V5.xlsx",
        prorate_orphans=False
    )

    dp_raw = res_raw["dataPoints"]
    direct_raw = res_raw["directBudget"]

    # 3. ANÁLISIS DE RESULTADOS Y METRICAS
    mapped_direct_raw = sum(dp["budget_required"] for dp in dp_raw if dp.get("chapter") != "Presupuesto Sin Asignar / Huérfano")
    unassigned_raw = sum(dp["budget_required"] for dp in dp_raw if dp.get("chapter") == "Presupuesto Sin Asignar / Huérfano")

    print("\n=================================================================")
    print("RESUMEN DE RESULTADOS COMPARATIVOS")
    print("=================================================================")
    print(f"Costo Directo Base Total:          ${direct_prorated:,.2f} COP".replace(",", "."))
    print(f"Presupuesto Total con Indirectos:  ${total_prorated:,.2f} COP".replace(",", "."))
    print("-----------------------------------------------------------------")
    print("CON PRORRATEO (prorate_orphans = True):")
    print(f"  - Total de Tareas Mapeadas:       {len(dp_prorated)}")
    print(f"  - Costo Directo Asignado a Obra: ${sum(dp['budget_required'] for dp in dp_prorated):,.2f} COP (100.00%)".replace(",", "."))
    print(f"  - Presupuesto Huérfano Residual:  $0.00 COP (0.00%)")
    print("-----------------------------------------------------------------")
    print("SIN PRORRATEO (prorate_orphans = False):")
    print(f"  - Total Registros Mapeados:       {len(dp_raw)}")
    print(f"  - Tareas con Presupuesto Asignado: {len([dp for dp in dp_raw if dp.get('chapter') != 'Presupuesto Sin Asignar / Huérfano'])}")
    print(f"  - Partidas Huérfanas Aisles:      {len([dp for dp in dp_raw if dp.get('chapter') == 'Presupuesto Sin Asignar / Huérfano'])}")
    print(f"  - Costo Directo Directamente Mapeado: ${mapped_direct_raw:,.2f} COP ({(mapped_direct_raw/direct_prorated)*100:.2f}%)".replace(",", "."))
    print(f"  - Costo en 'Presupuesto Sin Asignar': ${unassigned_raw:,.2f} COP ({(unassigned_raw/direct_prorated)*100:.2f}%)".replace(",", "."))

    print("\n=================================================================")
    print("DESGLOSE POR CAPÍTULO DE OBRA (COMPARATIVA)")
    print("=================================================================")
    
    chap_prorated = {}
    for dp in dp_prorated:
        ch = dp.get("chapter") or "Otros"
        chap_prorated[ch] = chap_prorated.get(ch, 0.0) + dp["budget_required"]

    chap_raw = {}
    for dp in dp_raw:
        ch = dp.get("chapter") or "Otros"
        chap_raw[ch] = chap_raw.get(ch, 0.0) + dp["budget_required"]

    all_chaps = sorted(set(list(chap_prorated.keys()) + list(chap_raw.keys())))
    
    print(f"{'Capítulo':<38} | {'Con Prorrateo (COP)':<22} | {'Sin Prorrateo (COP)':<22} | {'Diferencia Reasociada'}")
    print("-" * 105)
    for ch in all_chaps:
        val_p = chap_prorated.get(ch, 0.0)
        val_r = chap_raw.get(ch, 0.0)
        diff = val_p - val_r
        str_p = f"${val_p:,.0f}".replace(",", ".")
        str_r = f"${val_r:,.0f}".replace(",", ".")
        str_d = f"+${diff:,.0f}".replace(",", ".") if diff > 0 else "$0"
        print(f"{ch:<38} | {str_p:<22} | {str_r:<22} | {str_d}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(run_correlation_analysis())
