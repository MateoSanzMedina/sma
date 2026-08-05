import os
import openpyxl
import pandas as pd

base_dir = r"C:\Users\ssanz\OneDrive\Documentos\ChainPointAI\SERVING"
ppto_v5 = os.path.join(base_dir, "20260303 Presupuesto Bosque de Agua V5.xlsx")
output_excel = os.path.join(base_dir, "Matriz_Prerrequisitos_Constructivos.xlsx")

wb = openpyxl.load_workbook(ppto_v5, data_only=True)
sheet = wb['Presupuesto V5']

items = []
current_chapter = "PRELIMINARES"

for r in range(11, sheet.max_row + 1):
    c_code = str(sheet.cell(row=r, column=2).value or "").strip()
    c_desc = str(sheet.cell(row=r, column=3).value or "").strip()
    c_unit = str(sheet.cell(row=r, column=4).value or "").strip()
    c_cant = sheet.cell(row=r, column=5).value
    c_total = sheet.cell(row=r, column=9).value

    if c_code.endswith("00") and c_desc and not c_unit:
        current_chapter = c_desc
    elif c_desc and c_total is not None and isinstance(c_total, (int, float)) and c_total > 0:
        items.append({
            "Código": c_code,
            "Capítulo": current_chapter,
            "Ítem de Obra / Proceso": c_desc,
            "Unidad": c_unit,
            "Cantidad": c_cant,
            "Costo Directo (COP)": c_total
        })

df_items = pd.DataFrame(items)

# Matriz de Prerrequisitos Técnicos según Ingeniería de Obra Civil
prereq_mapping = [
    {
        "Fase / Dominio Técnico": "1. PRELIMINARES Y ADECUACIÓN",
        "Procesos Detectados en Obra": "Localización, replanteo topográfico, descapote, tala de árboles, cerramientos temporales, mantenimiento de vía externa",
        "Prerrequisitos Técnicos Obligatorios": "Licencia de urbanismo aprobada, comisión de topografía en sitio, actas de vecindad y demarcación de lindero con cerramiento perimetral.",
        "Riesgo / Impacto Técnico si Falla": "Imposibilidad de iniciar excavaciones por falta de referencia de cotas y ejes topográficos."
    },
    {
        "Fase / Dominio Técnico": "2. MOVIMIENTO DE TIERRAS Y EXCAVACIONES",
        "Procesos Detectados en Obra": "Cajeo de vías (Ejes 1 al 12), excavación de zanjas (redes lluvias, agua residual, acueducto), perfilación de subrasante, retiros",
        "Prerrequisitos Técnicos Obligatorios": "1. Replanteo topográfico de rasantes. 2. Descapote y retiro de capa vegetal. 3. Identificación de interferencias o redes existentes.",
        "Riesgo / Impacto Técnico si Falla": "Zanjas desalineadas, derrumbes de talud, sobre-excavación con costo extra en relleno de reemplazo."
    },
    {
        "Fase / Dominio Técnico": "3. REDES SUBTERRÁNEAS DE SERVICIOS (Lluvias, Residuales, Acueducto, Gas)",
        "Procesos Detectados en Obra": "Tubería Novafort (8\", 12\", 6\"), cámaras de inspección, sumideros, tubería de acueducto, red de gas",
        "Prerrequisitos Técnicos Obligatorios": "1. Excavación de zanja a cota de clave. 2. Cama de apoyo en arena o triturado (atracado). 3. Solera en concreto para cámaras de inspección.",
        "Riesgo / Impacto Técnico si Falla": "Rotura de tubería por atracado deficiente, descalce de cámaras de inspección, filtraciones por falta de prueba de estanqueidad."
    },
    {
        "Fase / Dominio Técnico": "4. ESTRUCTURA DE PAVIMENTO Y VÍAS",
        "Procesos Detectados en Obra": "Geotextil vial, afirmado, subbase granular, base granular, cordonería (sardineles), carpeteado/pavimentación",
        "Prerrequisitos Técnicos Obligatorios": "1. TODAS las redes subterráneas (alcantarillado, acueducto, eléctricas) instaladas, probadas y con zanjas rellenadas/compactadas. 2. Subrasante nivelada y certificada por ensayo de densidad Proctór. 3. Cordonería de confinamiento colocada.",
        "Riesgo / Impacto Técnico si Falla": "Fisuras y hundimiento del pavimento por tener que romper la vía posteriormente para instalar redes faltantes."
    },
    {
        "Fase / Dominio Técnico": "5. CIMENTACIONES Y ESTRUCTURAS DE CONCRETO (Portería, EBAR, Muros)",
        "Procesos Detectados en Obra": "Zapatas, concreto de limpieza (solera), acero de refuerzo figurado, columnas, vigas, muros en concreto, losas",
        "Prerrequisitos Técnicos Obligatorios": "1. Excavación estructural. 2. Vaciado de solera de limpieza (evitar contaminación del acero con tierra). 3. Armado y amarrado del hierro de refuerzo con traslapos. 4. Encofrado / formaleta apuntalada.",
        "Riesgo / Impacto Técnico si Falla": "Fallo estructural por corrosión del acero sin solera o deficiencia de resistencia por desencofrado prematuro."
    },
    {
        "Fase / Dominio Técnico": "6. REDES ELÉCTRICAS, ILUMINACIÓN Y TELECOMUNICACIONES",
        "Procesos Detectados en Obra": "Ductos conduit subterráneos, cajas de inspección eléctricas/citofonía, pedestales, montaje de transformadores, luminarias de alumbrado",
        "Prerrequisitos Técnicos Obligatorios": "1. Excavación de zanjas eléctricas. 2. Vaciado de cajas de paso. 3. Ductos colocados ANTES de la base granular o andenes. 4. Pruebas de aislamiento en cables antes de energizar.",
        "Riesgo / Impacto Técnico si Falla": "Cortocircuitos, imposibilidad de guiar el cableado por ductos aplastados durante la compactación de la vía."
    },
    {
        "Fase / Dominio Técnico": "7. ANDENES, URBANA Y ZONAS VERDES",
        "Procesos Detectados en Obra": "Vaciado de concreto para andenes, adoquín, acometidas domiciliarias, empradización, siembra de árboles, pintura vial",
        "Prerrequisitos Técnicos Obligatorios": "1. Sardineles de vía nivelados. 2. Base de sub-andén compactada. 3. Acometidas domiciliarias (agua, luz, gas) pasadas por debajo del andén.",
        "Riesgo / Impacto Técnico si Falla": "Ruptura de andenes recién vaciados para conectar acometidas domiciliarias atrasadas."
    }
]

df_prereq = pd.DataFrame(prereq_mapping)

with pd.ExcelWriter(output_excel, engine='openpyxl') as writer:
    df_prereq.to_excel(writer, sheet_name="Matriz Prerrequisitos Técnicos", index=False)
    df_items.to_excel(writer, sheet_name="Todos los Procesos V5", index=False)

print("[OK] Matriz de prerrequisitos tecnicos generada exitosamente en:", output_excel)
