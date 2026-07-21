import pandas as pd
import openpyxl

file3 = r"c:\Users\ssanz\OneDrive\Documentos\ChainPointAI\SERVING\FlujoGerenciaPrueba\informe_flujo_caja_serving_2026-07-21 (3).xlsx"
file4 = r"c:\Users\ssanz\OneDrive\Documentos\ChainPointAI\SERVING\FlujoGerenciaPrueba\informe_flujo_caja_serving_2026-07-21 (4).xlsx"

df3_resumen = pd.read_excel(file3, sheet_name="Resumen Gerencial")
df4_resumen = pd.read_excel(file4, sheet_name="Resumen Gerencial")

df3_mapped = pd.read_excel(file3, sheet_name="Flujo de Caja Mapeado")
df4_mapped = pd.read_excel(file4, sheet_name="Flujo de Caja Mapeado")

print("==========================================================================")
print(" COMPARATIVA GENERAL: ARCHIVO 3 (PRORRATEADO) VS ARCHIVO 4 (SIN PRORRATEAR)")
print("==========================================================================")

total_cost_3 = df3_mapped["Costo Directo Total (COP)"].sum()
total_cost_4 = df4_mapped["Costo Directo Total (COP)"].sum()

print(f"Total Costo Directo Archivo 3 (Prorrateado):     ${total_cost_3:,.2f} COP")
print(f"Total Costo Directo Archivo 4 (Sin Prorratear):  ${total_cost_4:,.2f} COP")

# Filtrar huérfanos en Archivo 4
orphans_4 = df4_mapped[df4_mapped["Capítulo"].astype(str).str.contains("Huérfano|Sin Asignar", case=False, na=False)]
orphan_cost_4 = orphans_4["Costo Directo Total (COP)"].sum()
orphan_pct_4 = (orphan_cost_4 / total_cost_4) * 100

print(f"\n--- ARCHIVO 4 (SIN PRORRATEAR) ---")
print(f"Total Filas Mapeadas con Éxito: {len(df4_mapped) - len(orphans_4)}")
print(f"Total Filas Huérfanas (Sin Asignar): {len(orphans_4)}")
print(f"Monto Total de Ítems Huérfanos: ${orphan_cost_4:,.2f} COP ({orphan_pct_4:.2f}% del Costo Directo)")

# Clasificación temática de los huérfanos
print("\n--- CLASIFICACIÓN DE ÍTEMS HUÉRFANOS MÁS COSTOSOS EN ARCHIVO 4 ---")
top_orphans = orphans_4.sort_values(by="Costo Directo Total (COP)", ascending=False)

for idx, row in top_orphans.head(30).iterrows():
    print(f"[{row['Código']}] {row['Actividad / Ítem de Obra (MS Project)']}: ${row['Costo Directo Total (COP)']:,.2f} COP")

# Agrupar por patrones de texto/categorías
print("\n--- AGRUPACIÓN POR CATEGORÍA DE GASTO EN HUÉRFANOS ---")
categories = {
    "Gastos Administrativos y Personal": ["ADMINIST", "DIRECCION", "PERSONAL", "OPERATIVO", "SEGURIDAD", "SALUD"],
    "Infraestructura Provisional y Lote": ["PROVISIONAL", "ADECUACION LOTE", "PORTERIA", "CERRAMIENTO"],
    "Redes de Alcantarillado y Servicios": ["ALCANTARILLADO", "LLUVIAS", "RESIDUALES", "BOMBEO", "GAS", "ACUEDUCTO", "TELECOMUNICACIONES"],
    "Movimiento de Tierra y Filtros": ["EXCAVACIONES", "FILTROS", "LLENOS", "TIERRA"],
    "Estructura y Acabados": ["ESTRUCTURA", "CONCRETO", "ANDENES", "ACABADOS"]
}

cat_totals = {}
for cat_name, keywords in categories.items():
    pattern = "|".join(keywords)
    matched = orphans_4[orphans_4["Actividad / Ítem de Obra (MS Project)"].astype(str).str.contains(pattern, case=False, na=False)]
    cat_totals[cat_name] = matched["Costo Directo Total (COP)"].sum()

for cat, amount in cat_totals.items():
    pct = (amount / orphan_cost_4) * 100
    print(f"- {cat}: ${amount:,.2f} COP ({pct:.2f}% de los huérfanos)")
