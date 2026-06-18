import pandas as pd
import io
import re
import math

def clean_numeric(val):
    if pd.isna(val):
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    val_str = str(val).replace("$", "").replace(",", "").replace(" ", "").strip()
    try:
        return float(val_str)
    except ValueError:
        return 0.0

async def process_sao_costs(file_content: bytes, filename: str):
    """
    Parsea el Excel de costos por niveles de SAO.
    Identifica actividades (APUs padres), insumos (recursos hijos) y subtotales.
    Calcula desviaciones de cantidad y costos, y proyecciones (teóricas e históricas).
    Identifica oportunidades de reutilización de materiales sobrantes.
    """
    
    # 1. Leer Excel sin cabeceras fijas para navegar por filas y columnas crudas
    try:
        xls = pd.ExcelFile(io.BytesIO(file_content))
        # Buscar la primera pestaña o la que coincida con costos
        sheet_name = xls.sheet_names[0]
        for name in xls.sheet_names:
            if "costos" in name.lower() or "sao" in name.lower() or "niveles" in name.lower():
                sheet_name = name
                break
        
        df = pd.read_excel(io.BytesIO(file_content), sheet_name=sheet_name, header=None)
    except Exception as e:
        raise ValueError(f"No se pudo leer el archivo Excel: {str(e)}")

    if df.empty or len(df) < 3:
        raise ValueError("El archivo Excel está vacío o no tiene suficientes filas de datos.")

    # 2. Bucle de parsing jerárquico
    apus = []
    current_apu = None

    for idx, row in df.iterrows():
        # Saltar las filas de encabezado (usualmente las primeras 2 o 3)
        if idx < 2:
            continue
            
        col0_val = str(row[0]).strip() if pd.notna(row[0]) else ""
        if not col0_val or col0_val == "nan":
            continue
            
        # Verificar si parece un código de APU (numérico, posiblemente con decimales que quitamos)
        clean_code = col0_val.replace(".0", "").replace(".", "").strip()
        if not re.match(r'^\d+$', clean_code):
            continue
            
        insumo_val = str(row[1]).strip() if pd.notna(row[1]) else ""
        nombre = str(row[2]).strip() if pd.notna(row[2]) else ""
        unidad = str(row[3]).strip() if pd.notna(row[3]) else ""

        # A. Fila de APU Padre (Insumo vacío)
        if not insumo_val or insumo_val == "nan":
            current_apu = {
                "code": clean_code,
                "name": nombre,
                "unit": unidad,
                "base_qty": clean_numeric(row[4]),
                "ejec_qty": clean_numeric(row[8]),
                "faltante_qty_teorica": clean_numeric(row[12]),
                # Columna 16 (Obra faltante real) o fallback
                "obra_faltante_qty": clean_numeric(row[16]) if len(row) > 16 else clean_numeric(row[12]),
                "resources": []
            }
            # Evitar que la obra faltante sea negativa o nula si la teórica tiene valor
            if current_apu["obra_faltante_qty"] == 0.0 and current_apu["faltante_qty_teorica"] > 0:
                current_apu["obra_faltante_qty"] = current_apu["faltante_qty_teorica"]
                
            apus.append(current_apu)

        # B. Fila de Recurso Hijo (Insumo no vacío, no es 99999)
        elif insumo_val != "99999" and "subtotal" not in insumo_val.lower() and current_apu:
            res = {
                "insumo": insumo_val.replace(".0", "").strip(),
                "name": nombre,
                "unit": unidad,
                
                # Base / Presupuestado
                "base_qty": clean_numeric(row[4]),
                "base_unit_qty": clean_numeric(row[5]),
                "base_price": clean_numeric(row[6]),
                "base_subtotal": clean_numeric(row[7]),
                
                # Ejecutado
                "ejec_qty": clean_numeric(row[8]),
                "ejec_unit_qty": clean_numeric(row[9]),
                "ejec_price": clean_numeric(row[10]),
                "ejec_subtotal": clean_numeric(row[11]),
                
                # Faltante en el Excel
                "excel_faltante_qty": clean_numeric(row[12]),
                "excel_faltante_unit_qty": clean_numeric(row[13]),
                "excel_faltante_price": clean_numeric(row[14]),
                "excel_faltante_subtotal": clean_numeric(row[15])
            }
            current_apu["resources"].append(res)

    # 3. Calcular Proyecciones y Desviaciones
    # Almacén de excedentes y déficits de materiales para reutilización
    # Estructura: { insumo_code: { "name": name, "unit": unit, "surpluses": [(apu_code, apu_name, qty)], "deficits": [(apu_code, apu_name, qty)] } }
    material_balances = {}

    for apu in apus:
        q_base = apu["base_qty"]
        q_ejec = apu["ejec_qty"]
        q_rem = apu["obra_faltante_qty"] # Cantidad de obra restante

        for res in apu["resources"]:
            ins_code = res["insumo"]
            ins_name = res["name"]
            ins_unit = res["unit"]

            # --- PROYECCIÓN TEÓRICA ---
            # El trabajo restante consume al rendimiento original y precio original
            proj_theo_rem_qty = q_rem * res["base_unit_qty"]
            proj_theo_rem_cost = proj_theo_rem_qty * res["base_price"]
            
            res["proj_theo"] = {
                "qty": res["ejec_qty"] + proj_theo_rem_qty,
                "cost": (res["ejec_qty"] * res["ejec_price"]) + proj_theo_rem_cost,
                "dev_qty": (res["ejec_qty"] + proj_theo_rem_qty) - res["base_qty"],
                "dev_cost": ((res["ejec_qty"] * res["ejec_price"]) + proj_theo_rem_cost) - (res["base_qty"] * res["base_price"])
            }

            # --- PROYECCIÓN HISTÓRICA ---
            # El trabajo restante consume al rendimiento real ejecutado y precio real ejecutado.
            # Fallback al teórico si no hay ejecución previa.
            u_proj = res["ejec_unit_qty"] if res["ejec_qty"] > 0 else res["base_unit_qty"]
            p_proj = res["ejec_price"] if res["ejec_qty"] > 0 else res["base_price"]

            proj_hist_rem_qty = q_rem * u_proj
            proj_hist_rem_cost = proj_hist_rem_qty * p_proj

            res["proj_hist"] = {
                "qty": res["ejec_qty"] + proj_hist_rem_qty,
                "cost": (res["ejec_qty"] * res["ejec_price"]) + proj_hist_rem_cost,
                "dev_qty": (res["ejec_qty"] + proj_hist_rem_qty) - res["base_qty"],
                "dev_cost": ((res["ejec_qty"] * res["ejec_price"]) + proj_hist_rem_cost) - (res["base_qty"] * res["base_price"])
            }

            # Registrar en el balance de materiales (usando por defecto la proyección histórica)
            # que suele ser la más realista para el cierre.
            dev_qty = res["proj_hist"]["dev_qty"]
            if abs(dev_qty) > 0.01:
                if ins_code not in material_balances:
                    material_balances[ins_code] = {
                        "name": ins_name,
                        "unit": ins_unit,
                        "surpluses": [],
                        "deficits": []
                    }
                
                # Desviación negativa es un SOBRANTE (ejecutado+faltante < base)
                if dev_qty < 0:
                    material_balances[ins_code]["surpluses"].append({
                        "apu_code": apu["code"],
                        "apu_name": apu["name"],
                        "qty": abs(dev_qty)
                    })
                # Desviación positiva es un FALTANTE / DEFICIT (ejecutado+faltante > base)
                else:
                    material_balances[ins_code]["deficits"].append({
                        "apu_code": apu["code"],
                        "apu_name": apu["name"],
                        "qty": dev_qty
                    })

    # 4. Generar Alertas y Recomendaciones de Reutilización
    alerts = []
    reutilization_tips = []

    # Generar alertas críticas
    for apu in apus:
        for res in apu["resources"]:
            # Usamos histórico como base para las alertas
            dev_cost = res["proj_hist"]["dev_cost"]
            base_cost = res["base_qty"] * res["base_price"]
            
            # Alertas de sobrecosto (déficit financiero)
            if dev_cost > 500000: # Más de 500,000 COP de desfase
                pct = (dev_cost / base_cost * 100) if base_cost > 0 else 100
                alerts.append({
                    "type": "danger",
                    "title": f"Sobrecosto Crítico en Insumo",
                    "message": f"El insumo '{res['name']}' en el APU '{apu['name']}' proyecta un sobrecosto de {pct:.1f}% ({clean_numeric(dev_cost):,.0f} COP) sobre el presupuesto base.",
                    "apu_code": apu["code"],
                    "insumo_code": res["insumo"]
                })
            
            # Alerta de diferencia de rendimientos (Cantidad)
            if res["ejec_qty"] > 0 and res["base_unit_qty"] > 0 and res["ejec_unit_qty"] > res["base_unit_qty"] * 1.15:
                alerts.append({
                    "type": "warning",
                    "title": "Desviación de Rendimiento",
                    "message": f"El rendimiento ejecutado de '{res['name']}' en '{apu['name']}' es un {((res['ejec_unit_qty']/res['base_unit_qty'] - 1)*100):.1f}% superior al presupuesto base.",
                    "apu_code": apu["code"],
                    "insumo_code": res["insumo"]
                })

    # Generar recomendaciones de reutilización cruzada de materiales
    for ins_code, balance in material_balances.items():
        surpluses = balance["surpluses"]
        deficits = balance["deficits"]

        if surpluses and deficits:
            # Emparejar excedentes con faltantes
            for sur in surpluses:
                for defic in deficits:
                    matched_qty = min(sur["qty"], defic["qty"])
                    if matched_qty > 0.01:
                        reutilization_tips.append({
                            "insumo_code": ins_code,
                            "insumo_name": balance["name"],
                            "unit": balance["unit"],
                            "from_apu_code": sur["apu_code"],
                            "from_apu_name": sur["apu_name"],
                            "to_apu_code": defic["apu_code"],
                            "to_apu_name": defic["apu_name"],
                            "qty": matched_qty,
                            "message": f"El material '{balance['name']}' presenta un excedente de {sur['qty']:.1f} {balance['unit']} en '{sur['apu_name']}'. Se recomienda reutilizar {matched_qty:.1f} {balance['unit']} para cubrir el faltante en '{defic['apu_name']}'."
                        })
                        
                        # Restar cantidades emparejadas para el bucle
                        sur["qty"] -= matched_qty
                        defic["qty"] -= matched_qty

    # 5. Totales generales
    total_base = sum(sum(r["base_qty"] * r["base_price"] for r in a["resources"]) for a in apus)
    total_ejec = sum(sum(r["ejec_qty"] * r["ejec_price"] for r in a["resources"]) for a in apus)
    total_proj_theo = sum(sum(r["proj_theo"]["cost"] for r in a["resources"]) for a in apus)
    total_proj_hist = sum(sum(r["proj_hist"]["cost"] for r in a["resources"]) for a in apus)

    summary = {
        "project_name": filename.replace("Copia de V1 SAO Costos por niveles_", "").split(".")[0].replace("_", " ").strip(),
        "total_base": total_base,
        "total_ejec": total_ejec,
        "total_proj_theo": total_proj_theo,
        "total_proj_hist": total_proj_hist,
        "dev_proj_theo": total_proj_theo - total_base,
        "dev_proj_hist": total_proj_hist - total_base,
        "total_items": len(apus),
        "total_alerts": len(alerts),
        "total_reutilizations": len(reutilization_tips)
    }

    return {
        "summary": summary,
        "alerts": alerts,
        "reutilizaciones": reutilization_tips,
        "details": apus
    }
