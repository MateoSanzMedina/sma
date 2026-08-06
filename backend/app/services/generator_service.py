import os
import io
import pandas as pd
import openpyxl
from openpyxl import load_workbook
import datetime

TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")

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

def parse_siimed_file(content: bytes, filename: str):
    """
    Lee un archivo Excel/CSV de SIIMED e identifica las cabeceras a partir de la fila 6.
    """
    try:
        if filename.endswith(".csv"):
            try:
                df = pd.read_csv(io.BytesIO(content), skiprows=6)
            except Exception:
                df = pd.read_csv(io.BytesIO(content), skiprows=6, sep=";")
        else:
            df = pd.read_excel(io.BytesIO(content), skiprows=6)
        
        # Eliminar columnas sin nombre
        df = df.loc[:, ~df.columns.str.contains('^Unnamed')]
        # Quitar espacios de los nombres de columnas
        df.columns = [str(c).strip() for c in df.columns]
        return df
    except Exception as e:
        print(f"Error parseando {filename}: {e}")
        return pd.DataFrame()

def split_full_name(name_str):
    """
    Divide un nombre completo en Primer/Segundo nombre y Primer/Segundo apellido.
    """
    if pd.isna(name_str) or not str(name_str).strip():
        return "", "", "", ""
    parts = str(name_str).strip().split()
    if len(parts) == 1:
        return parts[0], "", "", ""
    elif len(parts) == 2:
        return parts[1], "", parts[0], ""
    elif len(parts) == 3:
        return parts[2], "", parts[0], parts[1]
    else:
        apellidos = parts[-2:]
        nombres = parts[:-2]
        p_nombre = nombres[0]
        s_nombre = " ".join(nombres[1:]) if len(nombres) > 1 else ""
        p_apellido = apellidos[0]
        s_apellido = apellidos[1]
        return p_nombre, s_nombre, p_apellido, s_apellido

def classify_and_consolidate_files(files_data: list[tuple[bytes, str]]):
    """
    Recibe una lista de tuplas (contenido, nombre) y clasifica de forma dinámica
    cada archivo según sus columnas o nombre para admitir cualquier cantidad de informes.
    """
    parsed_dfs = {
        "extras": [],
        "incapacidades": [],
        "licencias": [],
        "vacaciones": [],
        "consolidado": []
    }
    
    for content, filename in files_data:
        df = parse_siimed_file(content, filename)
        if df.empty:
            continue
            
        col_str = " ".join([str(c).lower() for c in df.columns])
        fn_lower = filename.lower()
        
        # 1. Vacaciones
        if "vacacion" in fn_lower or "vac" in fn_lower or any(kw in col_str for kw in ["vacacion", "disfrute", "periodo vac"]):
            parsed_dfs["vacaciones"].append(df)
            print(f"Clasificado {filename} como VACACIONES")
            
        # 2. Incapacidades
        elif "incapacidad" in fn_lower or "ige" in fn_lower or any(kw in col_str for kw in ["incapacidad", "ige", "diagnostico", "cie10"]):
            parsed_dfs["incapacidades"].append(df)
            print(f"Clasificado {filename} como INCAPACIDADES")
            
        # 3. Licencias
        elif "licencia" in fn_lower or "sln" in fn_lower or any(kw in col_str for kw in ["licencia", "sln", "suspension"]):
            parsed_dfs["licencias"].append(df)
            print(f"Clasificado {filename} como LICENCIAS")
            
        # 4. Horas Extras / Salarios
        elif "extra" in fn_lower or "recargo" in fn_lower or any(kw in col_str for kw in ["extra", "recargo", "horas rec", "nit", "nombre"]):
            parsed_dfs["extras"].append(df)
            print(f"Clasificado {filename} como EXTRAS")
            
        # 5. Consolidado / Nómina General
        elif "nomina" in fn_lower or "consolidado" in fn_lower or any(kw in col_str for kw in ["ibc", "salario basico", "aporte"]):
            parsed_dfs["consolidado"].append(df)
            print(f"Clasificado {filename} como CONSOLIDADO")
            
        else:
            # Fallback por columnas comunes
            if "nit" in col_str or "cedula" in col_str or "documento" in col_str:
                parsed_dfs["extras"].append(df)
                print(f"Clasificado {filename} por descarte como EXTRAS")

    # Consolidar
    consolidated_dfs = {}
    for key, list_dfs in parsed_dfs.items():
        if list_dfs:
            consolidated_dfs[key] = pd.concat(list_dfs, ignore_index=True)
        else:
            consolidated_dfs[key] = pd.DataFrame()
            
    return consolidated_dfs

def extract_unique_employees(dfs):
    """
    Extrae la lista única de empleados de todos los dataframes de SIIMED.
    """
    employees = {}
    
    # 1. Buscar en Horas Extras / Salarios
    df_extras = dfs.get("extras")
    if df_extras is not None and not df_extras.empty:
        id_col = "NIT" if "NIT" in df_extras.columns else None
        name_col = "NOMBRE" if "NOMBRE" in df_extras.columns else None
        saldo_col = "NUEVO SALDO" if "NUEVO SALDO" in df_extras.columns else ("SALDO ANTERIOR" if "SALDO ANTERIOR" in df_extras.columns else None)
        if id_col and name_col:
            for _, row in df_extras.iterrows():
                eid = str(row[id_col]).split('.')[0].strip()
                if not eid or eid == "nan" or eid == "0":
                    continue
                salario = clean_numeric(row[saldo_col]) if saldo_col else 1300000.0
                if salario < 1300000.0:
                    salario = 1300000.0
                if eid not in employees:
                    p_nom, s_nom, p_ape, s_ape = split_full_name(row[name_col])
                    employees[eid] = {
                        "id": eid,
                        "p_nombre": p_nom,
                        "s_nombre": s_nom,
                        "p_apellido": p_ape,
                        "s_apellido": s_ape,
                        "nombre_completo": str(row[name_col]).strip(),
                        "salario": salario
                    }

    # 2. Buscar en Incapacidades
    df_inc = dfs.get("incapacidades")
    if df_inc is not None and not df_inc.empty:
        id_col = "IDENTIFICACION" if "IDENTIFICACION" in df_inc.columns else None
        if id_col:
            for _, row in df_inc.iterrows():
                eid = str(row[id_col]).split('.')[0].strip()
                if not eid or eid == "nan" or eid == "0":
                    continue
                if eid not in employees:
                    nom = str(row.get("NOMBRE", "")).strip()
                    ape = str(row.get("APELLIDO", "")).strip()
                    p_nom = nom.split()[0] if nom else ""
                    s_nom = " ".join(nom.split()[1:]) if len(nom.split()) > 1 else ""
                    p_ape = ape.split()[0] if ape else ""
                    s_ape = " ".join(ape.split()[1:]) if len(ape.split()) > 1 else ""
                    employees[eid] = {
                        "id": eid,
                        "p_nombre": p_nom,
                        "s_nombre": s_nom,
                        "p_apellido": p_ape,
                        "s_apellido": s_ape,
                        "nombre_completo": f"{nom} {ape}".strip(),
                        "salario": 1300000.0
                    }

    # 3. Buscar en Licencias
    df_lic = dfs.get("licencias")
    if df_lic is not None and not df_lic.empty:
        id_col = "IDENTIFICACION" if "IDENTIFICACION" in df_lic.columns else None
        name_col = "NOMBRE" if "NOMBRE" in df_lic.columns else None
        if id_col and name_col:
            for _, row in df_lic.iterrows():
                eid = str(row[id_col]).split('.')[0].strip()
                if not eid or eid == "nan" or eid == "0":
                    continue
                if eid not in employees:
                    p_nom, s_nom, p_ape, s_ape = split_full_name(row[name_col])
                    employees[eid] = {
                        "id": eid,
                        "p_nombre": p_nom,
                        "s_nombre": s_nom,
                        "p_apellido": p_ape,
                        "s_apellido": s_ape,
                        "nombre_completo": str(row[name_col]).strip(),
                        "salario": 1300000.0
                    }

    # 4. Buscar en Vacaciones
    df_vac = dfs.get("vacaciones")
    if df_vac is not None and not df_vac.empty:
        id_col = "IDENTIFICACION" if "IDENTIFICACION" in df_vac.columns else None
        if id_col:
            for _, row in df_vac.iterrows():
                eid = str(row[id_col]).split('.')[0].strip()
                if not eid or eid == "nan" or eid == "0":
                    continue
                if eid not in employees:
                    nom = str(row.get("NOMBRE", "")).strip()
                    ape = str(row.get("APELLIDO", "")).strip()
                    p_nom = nom.split()[0] if nom else ""
                    s_nom = " ".join(nom.split()[1:]) if len(nom.split()) > 1 else ""
                    p_ape = ape.split()[0] if ape else ""
                    s_ape = " ".join(ape.split()[1:]) if len(ape.split()) > 1 else ""
                    employees[eid] = {
                        "id": eid,
                        "p_nombre": p_nom,
                        "s_nombre": s_nom,
                        "p_apellido": p_ape,
                        "s_apellido": s_ape,
                        "nombre_completo": f"{nom} {ape}".strip(),
                        "salario": 1300000.0
                    }

    return employees

async def generate_arus_ingresos(files_data: list[tuple[bytes, str]]):
    """
    Genera el archivo PLANILLA INGRESOS ARUS.xlsx a partir de los cotizantes identificados dinámicamente.
    """
    dfs = classify_and_consolidate_files(files_data)
    employees = extract_unique_employees(dfs)
    
    template_path = os.path.join(TEMPLATES_DIR, "PLANILLA INGRESOS ARUS.xlsx")
    wb = load_workbook(template_path)
    ws = wb["COTIZANTES"]
    
    if ws.max_row > 1:
        ws.delete_rows(2, ws.max_row)
        
    for emp_id, emp in employees.items():
        salario = emp.get("salario", 1300000.0)
        row_data = [
            "CC",
            int(emp_id) if emp_id.isdigit() else emp_id,
            emp["p_nombre"],
            emp["s_nombre"],
            emp["p_apellido"],
            emp["s_apellido"],
            int(salario),
            "1",           # Tipo cotizante: Dependiente
            "0",           # Subtipo cotizante: Ninguno
            "SALARIO FIJO",# Tipo salario
            "NO",          # Extranjero
            "NO",          # Colombiano en exterior
            "",            # Fecha radicación exterior
            "SI",          # Exonerado
            "05",          # Departamento Antioquia
            "001",         # Municipio Medellín
            "231001",      # AFP Protección
            "0.16",        # Tarifa AFP 16%
            "EPS002",      # EPS Sura
            "0.04",        # Tarifa EPS 4%
            "1",           # Centro de trabajo
            "1",           # Clase tarifa ARL (I)
            "4110",        # Código actividad económica
            "CCF04",       # CCF Comfama
            "0.04",        # Tarifa CCF 4%
            "0",           # Tarifa SENA
            "0",           # Tarifa ICBF
            "240",         # Horas laboradas
            "0", "", "", "", "", ""
        ]
        ws.append(row_data)
        
    out = io.BytesIO()
    wb.save(out)
    out.seek(0)
    return out.getvalue()

async def generate_arus_novedades(files_data: list[tuple[bytes, str]]):
    """
    Genera el archivo PLANILLA NOVEDADES ARUS.xlsx a partir de los informes cargados.
    """
    dfs = classify_and_consolidate_files(files_data)
    
    df_inc = dfs.get("incapacidades", pd.DataFrame())
    df_lic = dfs.get("licencias", pd.DataFrame())
    df_vac = dfs.get("vacaciones", pd.DataFrame())
    
    template_path = os.path.join(TEMPLATES_DIR, "PLANILLA NOVEDADES ARUS.xlsx")
    wb = load_workbook(template_path)
    ws = wb["NOVEDADES"]
    
    if ws.max_row > 1:
        ws.delete_rows(2, ws.max_row)
        
    novedades_list = []
    
    # 1. Incapacidades
    if df_inc is not None and not df_inc.empty:
        id_col = "IDENTIFICACION" if "IDENTIFICACION" in df_inc.columns else None
        if id_col:
            for _, row in df_inc.iterrows():
                eid = str(row[id_col]).split('.')[0].strip()
                if not eid or eid == "nan" or eid == "0":
                    continue
                f_ini = row.get("FECHA INICIAL")
                f_fin = row.get("FECHA FINAL")
                
                novedades_list.append([
                    "CC",
                    int(eid) if eid.isdigit() else eid,
                    "IGE",
                    "66.67", "", "", "", "",
                    f_ini.strftime("%Y-%m-%d") if isinstance(f_ini, datetime.datetime) else str(f_ini),
                    f_fin.strftime("%Y-%m-%d") if isinstance(f_fin, datetime.datetime) else str(f_fin),
                    "", "", "", "1", "1", "4110", ""
                ])

    # 2. Licencias
    if df_lic is not None and not df_lic.empty:
        id_col = "IDENTIFICACION" if "IDENTIFICACION" in df_lic.columns else None
        if id_col:
            for _, row in df_lic.iterrows():
                eid = str(row[id_col]).split('.')[0].strip()
                if not eid or eid == "nan" or eid == "0":
                    continue
                t_lic = str(row.get("TIPO LICENCIA", "")).lower()
                f_ini = row.get("FECHA INICIAL")
                f_fin = row.get("FECHA FINAL")
                
                code = "SLN" if "no remunerada" in t_lic else "VAC-LR"
                
                novedades_list.append([
                    "CC",
                    int(eid) if eid.isdigit() else eid,
                    code,
                    "", "", "", "", "",
                    f_ini.strftime("%Y-%m-%d") if isinstance(f_ini, datetime.datetime) else str(f_ini),
                    f_fin.strftime("%Y-%m-%d") if isinstance(f_fin, datetime.datetime) else str(f_fin),
                    "", "", "", "1", "1", "4110", ""
                ])

    # 3. Vacaciones
    if df_vac is not None and not df_vac.empty:
        id_col = "IDENTIFICACION" if "IDENTIFICACION" in df_vac.columns else None
        if id_col:
            for _, row in df_vac.iterrows():
                eid = str(row[id_col]).split('.')[0].strip()
                if not eid or eid == "nan" or eid == "0":
                    continue
                f_ini = row.get("FECHA INICIAL")
                f_fin = row.get("FECHA FINAL")
                
                novedades_list.append([
                    "CC",
                    int(eid) if eid.isdigit() else eid,
                    "VAC-LR",
                    "", "", "", "", "",
                    f_ini.strftime("%Y-%m-%d") if isinstance(f_ini, datetime.datetime) else str(f_ini),
                    f_fin.strftime("%Y-%m-%d") if isinstance(f_fin, datetime.datetime) else str(f_fin),
                    "", "", "", "1", "1", "4110", ""
                ])

    for nov in novedades_list:
        ws.append(nov)
        
    out = io.BytesIO()
    wb.save(out)
    out.seek(0)
    return out.getvalue()

async def generate_final_planilla_ss(files_data: list[tuple[bytes, str]]):
    """
    Genera el formato completo de 98 columnas de la Autoliquidación a partir de los informes dinámicos.
    """
    dfs = classify_and_consolidate_files(files_data)
    employees = extract_unique_employees(dfs)
    
    headers = [
        "Tipo de registro", "Secuencia", "Tipo documento cotizante", "Documento cotizante",
        "Tipo de cotizante", "Subtipo de cotizante", "Extranjero", "Colombiano en el exterior",
        "Departamento", "Municipio", "Primer apellido", "Segundo apellido", "Primer nombre", "Segundo nombre",
        "ING", "RET", "TDE", "TAE", "TDP", "TAP", "VSP", "Línea", "VST", "SLN", "IGE", "LMA", "VAC-LR",
        "AVP", "VCT", "IRL", "AFP", "AFP Traslado", "EPS", "EPS Traslado", "CCF",
        "Días AFP", "Días EPS", "Días ARL", "Días CCF",
        "Salario básico", "Tipo Salario", "IBC AFP", "IBC EPS", "IBC ARL", "IBC CCF",
        "Tarifa AFP", "Cotización AFP", "AVP afiliado", "AVP aportante", "Total AFP",
        "Aporte FSP", "Aporte FSPS", "Valor no retenido",
        "Tarifa EPS", "Cotización EPS", "Valor UPC",
        "Número IGE", "Valor IGE", "Número LMA", "Valor LMA",
        "Tarifa ARL", "Centro de trabajo", "Cotización ARL",
        "Tarifa CCF", "Aporte CCF",
        "Tarifa SENA", "Aporte SENA", "Tarifa ICBF", "Aporte ICBF",
        "Tarifa ESAP", "Aporte ESAP", "Tarifa MEN", "Aporte MEN",
        "Tipo documento UPC", "Documento UPC", "Exonerado",
        "ARL", "Clase riesgo", "Tarifa especial AFP",
        "Fecha ING", "Fecha RET", "Fecha inicio VSP", "Fecha inicio SLN", "Fecha final SLN",
        "Fecha inicio IGE", "Fecha final IGE", "Fecha inicio LMA", "Fecha final LMA",
        "Fecha inicio VAC-LR", "Fecha final VAC-LR", "Fecha inicio VCT", "Fecha final VCT",
        "Fecha inicio IRL", "Fecha final IRL",
        "IBC otros parafiscales", "Número horas laboradas", "Fecha radicación exterior", "Actividad económica para ARL"
    ]
    
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Planilla seguridad social"
    
    # Fila 0: Metadatos del aportante
    meta_row = ["1", "1", "1", "CONSTRUCTORA SERVING SA", "NI", "900231851", "7", "E", "", "", "U", "", "", "14-11", "2026-05", "2026-06", "86124578", "", "344", "984957729", "1", "89"]
    meta_row += [""] * (98 - len(meta_row))
    ws.append(meta_row)
    ws.append(headers)
    
    secuencia = 1
    for emp_id, emp in employees.items():
        row = [""] * 98
        row[0] = "2"                                 # Tipo de registro
        row[1] = str(secuencia)                      # Secuencia
        row[2] = "CC"                                # Tipo documento cotizante
        row[3] = str(emp_id)                         # Documento cotizante
        row[4] = "01"                                # Tipo de cotizante (01 = Dependiente)
        row[5] = "00"                                # Subtipo de cotizante (00 = Ninguno)
        row[6] = "N"                                 # Extranjero
        row[7] = "N"                                 # Colombiano en el exterior
        row[8] = "05"                                # Departamento (Antioquia)
        row[9] = "001"                               # Municipio (Medellín)
        row[10] = emp["p_apellido"]                  # Primer apellido
        row[11] = emp["s_apellido"]                  # Segundo apellido
        row[12] = emp["p_nombre"]                    # Primer nombre
        row[13] = emp["s_nombre"]                    # Segundo nombre
        
        # Codigos Entidades Administradoras
        row[30] = "231001"                           # AFP Proteccion
        row[32] = "EPS002"                           # EPS Sura
        row[34] = "CCF04"                            # CCF Comfama
        row[75] = "S"                                # Exonerado pago parafiscales y salud
        row[76] = "14-11"                            # ARL Positiva
        row[77] = "1"                                # Clase riesgo
        row[95] = "240"                              # Número horas laboradas (30 días * 8 horas)
        row[97] = "4110"                             # Actividad económica ARL
        
        dias_afp = 30
        dias_eps = 30
        dias_arl = 30
        dias_ccf = 30
        
        # 1. Cruzar incapacidades
        if dfs.get("incapacidades") is not None and not dfs["incapacidades"].empty:
            df_inc = dfs["incapacidades"]
            id_col = "IDENTIFICACION" if "IDENTIFICACION" in df_inc.columns else None
            if id_col:
                emp_inc = df_inc[df_inc[id_col].astype(str).str.split('.').str[0].str.strip() == emp_id]
                if not emp_inc.empty:
                    row[24] = "X"
                    f_ini = emp_inc.iloc[0].get("FECHA INICIAL")
                    f_fin = emp_inc.iloc[0].get("FECHA FINAL")
                    row[84] = f_ini.strftime("%Y-%m-%d") if isinstance(f_ini, datetime.datetime) else str(f_ini)
                    row[85] = f_fin.strftime("%Y-%m-%d") if isinstance(f_fin, datetime.datetime) else str(f_fin)
                    dias_nov = int(clean_numeric(emp_inc.iloc[0].get("CANTIDAD DE DIAS", 0)))
                    if dias_nov > 0:
                        dias_arl = max(0, 30 - dias_nov)
                    
        # 2. Cruzar licencias
        if dfs.get("licencias") is not None and not dfs["licencias"].empty:
            df_lic = dfs["licencias"]
            id_col = "IDENTIFICACION" if "IDENTIFICACION" in df_lic.columns else None
            if id_col:
                emp_lic = df_lic[df_lic[id_col].astype(str).str.split('.').str[0].str.strip() == emp_id]
                if not emp_lic.empty:
                    t_lic = str(emp_lic.iloc[0].get("TIPO LICENCIA", "")).lower()
                    f_ini = emp_lic.iloc[0].get("FECHA INICIAL")
                    f_fin = emp_lic.iloc[0].get("FECHA FINAL")
                    dias_nov = int(clean_numeric(emp_lic.iloc[0].get("DIAS LICENCIA", 0)))
                    if "no remunerada" in t_lic:
                        row[23] = "X"
                        row[82] = f_ini.strftime("%Y-%m-%d") if isinstance(f_ini, datetime.datetime) else str(f_ini)
                        row[83] = f_fin.strftime("%Y-%m-%d") if isinstance(f_fin, datetime.datetime) else str(f_fin)
                        if dias_nov > 0:
                            dias_afp = max(0, 30 - dias_nov)
                            dias_eps = max(0, 30 - dias_nov)
                            dias_arl = max(0, 30 - dias_nov)
                            dias_ccf = max(0, 30 - dias_nov)
                    else:
                        row[26] = "X"
                        row[88] = f_ini.strftime("%Y-%m-%d") if isinstance(f_ini, datetime.datetime) else str(f_ini)
                        row[89] = f_fin.strftime("%Y-%m-%d") if isinstance(f_fin, datetime.datetime) else str(f_fin)
                        
        # 3. Cruzar vacaciones
        if dfs.get("vacaciones") is not None and not dfs["vacaciones"].empty:
            df_vac = dfs["vacaciones"]
            id_col = "IDENTIFICACION" if "IDENTIFICACION" in df_vac.columns else None
            if id_col:
                emp_vac = df_vac[df_vac[id_col].astype(str).str.split('.').str[0].str.strip() == emp_id]
                if not emp_vac.empty:
                    row[26] = "X"
                    f_ini = emp_vac.iloc[0].get("FECHA INICIAL")
                    f_fin = emp_vac.iloc[0].get("FECHA FINAL")
                    row[88] = f_ini.strftime("%Y-%m-%d") if isinstance(f_ini, datetime.datetime) else str(f_ini)
                    row[89] = f_fin.strftime("%Y-%m-%d") if isinstance(f_fin, datetime.datetime) else str(f_fin)
                    dias_nov = int(clean_numeric(emp_vac.iloc[0].get("DIAS DISFRUTADOS", 0)))
                    if dias_nov > 0:
                        dias_arl = max(0, 30 - dias_nov)
                    
        # Días trabajados
        row[35] = str(dias_afp)
        row[36] = str(dias_eps)
        row[37] = str(dias_arl)
        row[38] = str(dias_ccf)

        # Salario básico y Tipo de Salario
        salario = emp.get("salario", 1300000.0)
        if salario < 1300000.0:
            salario = 1300000.0
            
        row[39] = f"{salario:.0f}"
        row[40] = "F"

        # IBCs proporcionales
        ibc_afp = salario * (dias_afp / 30.0)
        ibc_eps = salario * (dias_eps / 30.0)
        ibc_arl = salario * (dias_arl / 30.0)
        ibc_ccf = salario * (dias_ccf / 30.0)

        row[41] = f"{ibc_afp:.0f}"
        row[42] = f"{ibc_eps:.0f}"
        row[43] = f"{ibc_arl:.0f}"
        row[44] = f"{ibc_ccf:.0f}"

        # Tarifas y Cotizaciones
        row[45] = "0.16000"
        cotiz_afp = round(ibc_afp * 0.16)
        row[46] = str(cotiz_afp)
        row[47] = "0"
        row[48] = "0"
        row[49] = str(cotiz_afp)
        row[50] = "0"
        row[51] = "0"
        row[52] = "0"

        row[53] = "0.04000"
        cotiz_eps = round(ibc_eps * 0.04)
        row[54] = str(cotiz_eps)
        row[55] = "0"
        row[56] = ""
        row[57] = "0"
        row[58] = ""
        row[59] = "0"

        row[60] = "0.00522"
        row[61] = "1"
        cotiz_arl = round(ibc_arl * 0.00522)
        row[62] = str(cotiz_arl)

        row[63] = "0.04000"
        cotiz_ccf = round(ibc_ccf * 0.04)
        row[64] = str(cotiz_ccf)

        row[65] = "0.00000"
        row[66] = "0"
        row[67] = "0.00000"
        row[68] = "0"
        row[69] = "0.00000"
        row[70] = "0"
        row[71] = "0.00000"
        row[72] = "0"
        row[73] = ""
        row[74] = ""

        row[94] = f"{ibc_ccf:.0f}"

        ws.append(row)
        secuencia += 1
        
    out = io.BytesIO()
    wb.save(out)
    out.seek(0)
    return out.getvalue()
