import pandas as pd
import io
import re

def clean_numeric(val):
    if pd.isna(val):
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    # Si es string, limpiar caracteres como $, comas, espacios
    val_str = str(val).replace("$", "").replace(",", "").replace(" ", "").strip()
    try:
        return float(val_str)
    except ValueError:
        return 0.0

def find_column(columns, keywords):
    for col in columns:
        col_str = str(col).lower().strip()
        # Verificar si alguna palabra clave coincide exactamente o está contenida
        if any(kw in col_str for kw in keywords):
            return col
    return None

async def compare_payroll_files(siimed_content: bytes, siimed_filename: str, arus_content: bytes, arus_filename: str):
    """
    Lee un archivo de nómina de SIIMED y una planilla de ARUS.
    Extrae cédulas, nombres, IBCs y aportes, y los compara.
    Si no encuentra columnas válidas, procesa en modo demo para ilustrar el flujo.
    """
    
    # 1. Intentar leer SIIMED
    try:
        if siimed_filename.endswith(".csv"):
            df_siimed = pd.read_csv(io.BytesIO(siimed_content))
        else:
            df_siimed = pd.read_excel(io.BytesIO(siimed_content))
    except Exception as e:
        df_siimed = pd.DataFrame()
        
    # 2. Intentar leer ARUS
    try:
        df_arus = pd.read_excel(io.BytesIO(arus_content))
    except Exception as e:
        df_arus = pd.DataFrame()

    # Sanitizar columnas quitando espacios y pasando a minúsculas
    siimed_cols = [str(c).strip() for c in df_siimed.columns] if not df_siimed.empty else []
    arus_cols = [str(c).strip() for c in df_arus.columns] if not df_arus.empty else []
    
    # Buscar identificador y nombre
    siimed_id_col = find_column(df_siimed.columns, ["cedula", "documento", "identificacion", "nit", "cc", "nro_ident"])
    siimed_name_col = find_column(df_siimed.columns, ["nombre", "empleado", "trabajador", "tercero"])
    
    arus_id_col = find_column(df_arus.columns, ["cedula", "documento", "identificacion", "nit", "cc", "nro_ident"])
    arus_name_col = find_column(df_arus.columns, ["nombre", "empleado", "trabajador", "cotizante"])

    # Buscar IBCs en SIIMED
    siimed_ibc_salud = find_column(df_siimed.columns, ["ibc salud", "ibc_salud", "ibc de salud"]) or find_column(df_siimed.columns, ["ibc"])
    siimed_ibc_pension = find_column(df_siimed.columns, ["ibc pension", "ibc_pension", "ibc de pension"]) or siimed_ibc_salud
    siimed_ibc_arl = find_column(df_siimed.columns, ["ibc arl", "ibc_arl", "ibc de arl"]) or siimed_ibc_salud
    siimed_ibc_ccf = find_column(df_siimed.columns, ["ibc ccf", "ibc_ccf", "ibc caja", "ibc de caja"]) or siimed_ibc_salud

    # Buscar IBCs en ARUS
    arus_ibc_salud = find_column(df_arus.columns, ["ibc salud", "ibc_salud", "ibc de salud"]) or find_column(df_arus.columns, ["ibc"])
    arus_ibc_pension = find_column(df_arus.columns, ["ibc pension", "ibc_pension", "ibc de pension"]) or arus_ibc_salud
    arus_ibc_arl = find_column(df_arus.columns, ["ibc arl", "ibc_arl", "ibc de arl"]) or arus_ibc_salud
    arus_ibc_ccf = find_column(df_arus.columns, ["ibc ccf", "ibc_ccf", "ibc caja", "ibc de caja"]) or arus_ibc_salud

    # Buscar aportes en SIIMED
    siimed_val_salud = find_column(df_siimed.columns, ["salud", "aporte salud"])
    siimed_val_pension = find_column(df_siimed.columns, ["pension", "aporte pension"])
    siimed_val_arl = find_column(df_siimed.columns, ["arl", "aporte arl"])
    siimed_val_ccf = find_column(df_siimed.columns, ["caja", "ccf", "compensacion"])

    # Buscar aportes en ARUS
    arus_val_salud = find_column(df_arus.columns, ["salud", "aporte salud"])
    arus_val_pension = find_column(df_arus.columns, ["pension", "aporte pension"])
    arus_val_arl = find_column(df_arus.columns, ["arl", "aporte arl"])
    arus_val_ccf = find_column(df_arus.columns, ["caja", "ccf", "compensacion"])

    # Verificar si es viable procesar datos reales
    is_demo = False
    if df_siimed.empty or df_arus.empty or not siimed_id_col or not arus_id_col:
        is_demo = True
        
    if is_demo:
        # Generar Mock Data para demostración limpia
        employees = [
            {"id": "1017234567", "name": "SILVA ARIAS ANDREA", "ibc_salud": 1300000, "ibc_pension": 1300000, "ibc_arl": 1300000, "ibc_ccf": 1300000, "salud": 52000, "pension": 208000, "arl": 6786, "ccf": 52000},
            {"id": "1020444555", "name": "RESTREPO VALENCIA LUIS", "ibc_salud": 2500000, "ibc_pension": 2500000, "ibc_arl": 2500000, "ibc_ccf": 2500000, "salud": 100000, "pension": 400000, "arl": 13050, "ccf": 100000},
            {"id": "39444198", "name": "SILVA ANA CONSTANZA", "ibc_salud": 4200000, "ibc_pension": 4200000, "ibc_arl": 4200000, "ibc_ccf": 4200000, "salud": 168000, "pension": 672000, "arl": 21924, "ccf": 168000},
            {"id": "70555666", "name": "GOMEZ MEJIA DANIEL", "ibc_salud": 1850000, "ibc_pension": 1850000, "ibc_arl": 1850000, "ibc_ccf": 1850000, "salud": 74000, "pension": 296000, "arl": 9657, "ccf": 74000},
            {"id": "1033222111", "name": "PATIÑO RUIZ MANUELA", "ibc_salud": 3100000, "ibc_pension": 3100000, "ibc_arl": 3100000, "ibc_ccf": 3100000, "salud": 124000, "pension": 496000, "arl": 16182, "ccf": 124000}
        ]
        
        # Mapeamos a ARUS con leves discrepancias
        arus_employees = {
            "1017234567": {"ibc_salud": 1300000, "ibc_pension": 1300000, "ibc_arl": 1300000, "ibc_ccf": 1300000, "salud": 52000, "pension": 208000, "arl": 6786, "ccf": 52000}, # Ok
            "1020444555": {"ibc_salud": 2500000, "ibc_pension": 2500000, "ibc_arl": 2500000, "ibc_ccf": 2500000, "salud": 100000, "pension": 400000, "arl": 13050, "ccf": 100000}, # Ok
            "39444198": {"ibc_salud": 4000000, "ibc_pension": 4000000, "ibc_arl": 4000000, "ibc_ccf": 4200000, "salud": 160000, "pension": 640000, "arl": 20880, "ccf": 168000}, # Diferencia en IBC salud/pension/ARL
            "70555666": {"ibc_salud": 1850000, "ibc_pension": 1850000, "ibc_arl": 1850000, "ibc_ccf": 1850000, "salud": 74000, "pension": 296000, "arl": 12000, "ccf": 74000}, # Diferencia centavos/redondeo ARL
            # Patino Ruiz Manuela no aparece en ARUS (Novedad de ingreso no cargada)
        }
        
        comparison_rows = []
        for emp in employees:
            eid = emp["id"]
            name = emp["name"]
            
            # SIIMED values
            s_ibc_salud = emp["ibc_salud"]
            s_ibc_pension = emp["ibc_pension"]
            s_ibc_arl = emp["ibc_arl"]
            s_ibc_ccf = emp["ibc_ccf"]
            s_val_salud = emp["salud"]
            s_val_pension = emp["pension"]
            s_val_arl = emp["arl"]
            s_val_ccf = emp["ccf"]
            s_total = s_val_salud + s_val_pension + s_val_arl + s_val_ccf
            
            if eid in arus_employees:
                a_emp = arus_employees[eid]
                a_ibc_salud = a_emp["ibc_salud"]
                a_ibc_pension = a_emp["ibc_pension"]
                a_ibc_arl = a_emp["ibc_arl"]
                a_ibc_ccf = a_emp["ibc_ccf"]
                a_val_salud = a_emp["salud"]
                a_val_pension = a_emp["pension"]
                a_val_arl = a_emp["arl"]
                a_val_ccf = a_emp["ccf"]
                a_total = a_val_salud + a_val_pension + a_val_arl + a_val_ccf
                present_in_arus = True
            else:
                a_ibc_salud = a_ibc_pension = a_ibc_arl = a_ibc_ccf = 0.0
                a_val_salud = a_val_pension = a_val_arl = a_val_ccf = 0.0
                a_total = 0.0
                present_in_arus = False
                
            has_diff = (
                s_ibc_salud != a_ibc_salud or
                s_ibc_pension != a_ibc_pension or
                s_ibc_arl != a_ibc_arl or
                s_ibc_ccf != a_ibc_ccf or
                s_total != a_total
            )

            comparison_rows.append({
                "id": eid,
                "name": name,
                "present_in_siimed": True,
                "present_in_arus": present_in_arus,
                "siimed": {
                    "ibc_salud": s_ibc_salud,
                    "ibc_pension": s_ibc_pension,
                    "ibc_arl": s_ibc_arl,
                    "ibc_ccf": s_ibc_ccf,
                    "val_salud": s_val_salud,
                    "val_pension": s_val_pension,
                    "val_arl": s_val_arl,
                    "val_ccf": s_val_ccf,
                    "total": s_total
                },
                "arus": {
                    "ibc_salud": a_ibc_salud,
                    "ibc_pension": a_ibc_pension,
                    "ibc_arl": a_ibc_arl,
                    "ibc_ccf": a_ibc_ccf,
                    "val_salud": a_val_salud,
                    "val_pension": a_val_pension,
                    "val_arl": a_val_arl,
                    "val_ccf": a_val_ccf,
                    "total": a_total
                },
                "diff": {
                    "ibc_salud": s_ibc_salud - a_ibc_salud,
                    "ibc_pension": s_ibc_pension - a_ibc_pension,
                    "ibc_arl": s_ibc_arl - a_ibc_arl,
                    "ibc_ccf": s_ibc_ccf - a_ibc_ccf,
                    "total": s_total - a_total
                },
                "has_discrepancy": has_diff
            })
            
        summary = {
            "total_siimed": sum(r["siimed"]["total"] for r in comparison_rows),
            "total_arus": sum(r["arus"]["total"] for r in comparison_rows),
            "total_discrepancies": sum(1 for r in comparison_rows if r["has_discrepancy"]),
            "cotizantes_siimed": len(comparison_rows),
            "cotizantes_arus": sum(1 for r in comparison_rows if r["present_in_arus"]),
            "is_demo": True,
            "message": "Cargado en Modo Demostración. Adjunte sus planillas 'Mayo S.S Conser' para ajustar la detección de columnas real."
        }
        
        return {"summary": summary, "details": comparison_rows}

    # 3. Procesar datos reales si identificamos columnas mínimas
    # Normalizar IDs quitando decimales (ej. 1234.0 -> 1234)
    df_siimed[siimed_id_col] = df_siimed[siimed_id_col].astype(str).str.split('.').str[0].str.strip()
    df_arus[arus_id_col] = df_arus[arus_id_col].astype(str).str.split('.').str[0].str.strip()

    # Agrupar / consolidar si hay duplicados por ID
    # SIIMED
    siimed_records = {}
    for _, row in df_siimed.iterrows():
        eid = str(row[siimed_id_col]).strip()
        if not eid or eid == "nan" or eid == "":
            continue
        
        # Extraer valores numéricos con limpieza
        ibc_s = clean_numeric(row[siimed_ibc_salud]) if siimed_ibc_salud else 0.0
        ibc_p = clean_numeric(row[siimed_ibc_pension]) if siimed_ibc_pension else ibc_s
        ibc_a = clean_numeric(row[siimed_ibc_arl]) if siimed_ibc_arl else ibc_s
        ibc_c = clean_numeric(row[siimed_ibc_ccf]) if siimed_ibc_ccf else ibc_s
        
        val_s = clean_numeric(row[siimed_val_salud]) if siimed_val_salud else 0.0
        val_p = clean_numeric(row[siimed_val_pension]) if siimed_val_pension else 0.0
        val_a = clean_numeric(row[siimed_val_arl]) if siimed_val_arl else 0.0
        val_c = clean_numeric(row[siimed_val_ccf]) if siimed_val_ccf else 0.0
        
        name = str(row[siimed_name_col]).strip() if siimed_name_col else "Empleado SIIMED"
        
        if eid in siimed_records:
            # Acumular
            siimed_records[eid]["ibc_salud"] += ibc_s
            siimed_records[eid]["ibc_pension"] += ibc_p
            siimed_records[eid]["ibc_arl"] += ibc_a
            siimed_records[eid]["ibc_ccf"] += ibc_c
            siimed_records[eid]["val_salud"] += val_s
            siimed_records[eid]["val_pension"] += val_p
            siimed_records[eid]["val_arl"] += val_a
            siimed_records[eid]["val_ccf"] += val_c
        else:
            siimed_records[eid] = {
                "name": name,
                "ibc_salud": ibc_s,
                "ibc_pension": ibc_p,
                "ibc_arl": ibc_a,
                "ibc_ccf": ibc_c,
                "val_salud": val_s,
                "val_pension": val_p,
                "val_arl": val_a,
                "val_ccf": val_c
            }

    # ARUS
    arus_records = {}
    for _, row in df_arus.iterrows():
        eid = str(row[arus_id_col]).strip()
        if not eid or eid == "nan" or eid == "":
            continue
            
        ibc_s = clean_numeric(row[arus_ibc_salud]) if arus_ibc_salud else 0.0
        ibc_p = clean_numeric(row[arus_ibc_pension]) if arus_ibc_pension else ibc_s
        ibc_a = clean_numeric(row[arus_ibc_arl]) if arus_ibc_arl else ibc_s
        ibc_c = clean_numeric(row[arus_ibc_ccf]) if arus_ibc_ccf else ibc_s
        
        val_s = clean_numeric(row[arus_val_salud]) if arus_val_salud else 0.0
        val_p = clean_numeric(row[arus_val_pension]) if arus_val_pension else 0.0
        val_a = clean_numeric(row[arus_val_arl]) if arus_val_arl else 0.0
        val_c = clean_numeric(row[arus_val_ccf]) if arus_val_ccf else 0.0
        
        name = str(row[arus_name_col]).strip() if arus_name_col else "Cotizante ARUS"
        
        if eid in arus_records:
            arus_records[eid]["ibc_salud"] += ibc_s
            arus_records[eid]["ibc_pension"] += ibc_p
            arus_records[eid]["ibc_arl"] += ibc_a
            arus_records[eid]["ibc_ccf"] += ibc_c
            arus_records[eid]["val_salud"] += val_s
            arus_records[eid]["val_pension"] += val_p
            arus_records[eid]["val_arl"] += val_a
            arus_records[eid]["val_ccf"] += val_c
        else:
            arus_records[eid] = {
                "name": name,
                "ibc_salud": ibc_s,
                "ibc_pension": ibc_p,
                "ibc_arl": ibc_a,
                "ibc_ccf": ibc_c,
                "val_salud": val_s,
                "val_pension": val_p,
                "val_arl": val_a,
                "val_ccf": val_c
            }

    # Cruzar datos
    all_ids = set(siimed_records.keys()).union(set(arus_records.keys()))
    comparison_rows = []
    
    for eid in all_ids:
        in_siimed = eid in siimed_records
        in_arus = eid in arus_records
        
        s_rec = siimed_records.get(eid, {
            "name": "No en SIIMED", "ibc_salud": 0.0, "ibc_pension": 0.0, "ibc_arl": 0.0, "ibc_ccf": 0.0,
            "val_salud": 0.0, "val_pension": 0.0, "val_arl": 0.0, "val_ccf": 0.0
        })
        a_rec = arus_records.get(eid, {
            "name": "No en ARUS", "ibc_salud": 0.0, "ibc_pension": 0.0, "ibc_arl": 0.0, "ibc_ccf": 0.0,
            "val_salud": 0.0, "val_pension": 0.0, "val_arl": 0.0, "val_ccf": 0.0
        })

        name = s_rec["name"] if in_siimed else a_rec["name"]
        
        s_total = s_rec["val_salud"] + s_rec["val_pension"] + s_rec["val_arl"] + s_rec["val_ccf"]
        a_total = a_rec["val_salud"] + a_rec["val_pension"] + a_rec["val_arl"] + a_rec["val_ccf"]

        has_diff = (
            abs(s_rec["ibc_salud"] - a_rec["ibc_salud"]) > 1.0 or
            abs(s_rec["ibc_pension"] - a_rec["ibc_pension"]) > 1.0 or
            abs(s_rec["ibc_arl"] - a_rec["ibc_arl"]) > 1.0 or
            abs(s_rec["ibc_ccf"] - a_rec["ibc_ccf"]) > 1.0 or
            abs(s_total - a_total) > 1.0 or
            (in_siimed != in_arus)
        )

        comparison_rows.append({
            "id": eid,
            "name": name,
            "present_in_siimed": in_siimed,
            "present_in_arus": in_arus,
            "siimed": {
                "ibc_salud": s_rec["ibc_salud"],
                "ibc_pension": s_rec["ibc_pension"],
                "ibc_arl": s_rec["ibc_arl"],
                "ibc_ccf": s_rec["ibc_ccf"],
                "val_salud": s_rec["val_salud"],
                "val_pension": s_rec["val_pension"],
                "val_arl": s_rec["val_arl"],
                "val_ccf": s_rec["val_ccf"],
                "total": s_total
            },
            "arus": {
                "ibc_salud": a_rec["ibc_salud"],
                "ibc_pension": a_rec["ibc_pension"],
                "ibc_arl": a_rec["ibc_arl"],
                "ibc_ccf": a_rec["ibc_ccf"],
                "val_salud": a_rec["val_salud"],
                "val_pension": a_rec["val_pension"],
                "val_arl": a_rec["val_arl"],
                "val_ccf": a_rec["val_ccf"],
                "total": a_total
            },
            "diff": {
                "ibc_salud": s_rec["ibc_salud"] - a_rec["ibc_salud"],
                "ibc_pension": s_rec["ibc_pension"] - a_rec["ibc_pension"],
                "ibc_arl": s_rec["ibc_arl"] - a_rec["ibc_arl"],
                "ibc_ccf": s_rec["ibc_ccf"] - a_rec["ibc_ccf"],
                "total": s_total - a_total
            },
            "has_discrepancy": has_diff
        })

    # Ordenar por nombre
    comparison_rows.sort(key=lambda x: x["name"])

    summary = {
        "total_siimed": sum(r["siimed"]["total"] for r in comparison_rows),
        "total_arus": sum(r["arus"]["total"] for r in comparison_rows),
        "total_discrepancies": sum(1 for r in comparison_rows if r["has_discrepancy"]),
        "cotizantes_siimed": len(siimed_records),
        "cotizantes_arus": len(arus_records),
        "is_demo": False,
        "message": "Planilla comparada exitosamente a partir de los datos cargados."
    }

    return {"summary": summary, "details": comparison_rows}
