import os
import sys
import shutil
import openpyxl
from openpyxl.utils import get_column_letter
from copy import copy
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.formatting.rule import CellIsRule

# ---------------------------------------------------------------------------
# Constants – canonical header keywords used to locate columns.
# ---------------------------------------------------------------------------
SHEET0_ITEM_KEYWORDS   = ['ítem', 'item', 'código', 'codigo']   # col with APU codes (sheet 0)
SHEET0_ACCUM_KEYWORDS  = ['cant', 'ejecut', 'acumul']           # col with accumulated quantity (sheet 0, ALL must match)
SHEET1_CODE_KEYWORDS   = ['código', 'codigo']                    # col with APU codes (sheet 1)
SHEET1_INSUMO_KEYWORDS = ['insumo']                              # col with insumo codes (sheet 1)
SHEET1_NAME_KEYWORDS   = ['descripción', 'descripcion', 'nombre', 'concepto'] # col with description/name
SHEET1_GROUP_KEYWORDS  = ['análisis unitario ejecución',
                           'analisis unitario ejecucion']         # group header spanning the execution section
SHEET1_SUBHDR_KEYWORDS = ['cant', 'ejecut']                      # subheader col label inside execution section (ALL must match)

HEADER_SEARCH_ROWS = 30   # how many rows from the top to scan for headers


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def copy_cell_style(src, dst):
    """Copy font, border, fill, number_format, protection and alignment."""
    if src and src.has_style:
        dst.font          = copy(src.font)
        dst.border        = copy(src.border)
        dst.fill          = copy(src.fill)
        dst.number_format = src.number_format
        dst.protection    = copy(src.protection)
        dst.alignment     = copy(src.alignment)


def normalize(val):
    """Lower-case, strip, collapse whitespace."""
    if val and isinstance(val, str):
        return ' '.join(val.lower().split())
    return ''


def all_keywords_in(text, keywords):
    """Return True if every keyword in the list appears in text."""
    return all(k in text for k in keywords)


def find_header_cell(ws, keywords, match_all=True,
                     max_row=HEADER_SEARCH_ROWS, max_col=None):
    """
    Scan the worksheet up to max_row rows and return (row, col) of the first
    cell whose normalised text satisfies the keyword condition.
    """
    max_col = max_col or ws.max_column
    for r in range(1, min(max_row + 1, ws.max_row + 1)):
        for c in range(1, max_col + 1):
            text = normalize(ws.cell(r, c).value)
            if not text:
                continue
            hit = all_keywords_in(text, keywords) if match_all \
                  else any(k in text for k in keywords)
            if hit:
                return r, c
    return None, None


def find_column_in_row(ws, row, keywords, match_all=True,
                        col_start=1, col_end=None):
    """Scan a single row between col_start and col_end."""
    col_end = col_end or ws.max_column
    for c in range(col_start, col_end + 1):
        text = normalize(ws.cell(row, c).value)
        if not text:
            continue
        hit = all_keywords_in(text, keywords) if match_all \
              else any(k in text for k in keywords)
        if hit:
            return c
    return None


# ---------------------------------------------------------------------------
# Sheet-0 reader
# ---------------------------------------------------------------------------
def read_accumulated_values(wb):
    """Read the first sheet and build a dict { item_code_str -> float(accumulated) }."""
    ws = wb.worksheets[0]
    print(f"\n[Hoja 0 – '{ws.title}'] Buscando cabeceras...")

    item_row, item_col = find_header_cell(ws, SHEET0_ITEM_KEYWORDS, match_all=False)
    accum_row, accum_col = find_header_cell(ws, SHEET0_ACCUM_KEYWORDS, match_all=True)

    if item_col is None or accum_col is None:
        item_row, item_col = 7, 2
        accum_row, accum_col = 7, 10
        print("  Advertencia: cabeceras no encontradas. Usando columnas por defecto (B, J, fila 7).")
    else:
        print(f"  Ítem/Código -> fila {item_row}, col {item_col}")
        print(f"  Cant. Ejecutada acumulada -> fila {accum_row}, col {accum_col}")

    data_start = max(item_row or 0, accum_row or 0) + 1

    accum_dict = {}
    for r in range(data_start, ws.max_row + 1):
        code_val  = ws.cell(r, item_col).value
        accum_val = ws.cell(r, accum_col).value
        if code_val is None:
            continue
        code_str = str(code_val).strip()
        if not code_str:
            continue
        try:
            accum_dict[code_str] = float(accum_val) if accum_val is not None else 0.0
        except (ValueError, TypeError):
            accum_dict[code_str] = accum_val

    print(f"  {len(accum_dict)} ítem(s) registrados.")
    return accum_dict


# ---------------------------------------------------------------------------
# Sheet-1 header detection
# ---------------------------------------------------------------------------
def detect_sheet1_headers(ws):
    """Locate relevant columns in the second sheet dynamically."""
    print(f"\n[Hoja 1 – '{ws.title}'] Buscando cabeceras...")

    code_row, code_col = find_header_cell(ws, SHEET1_CODE_KEYWORDS, match_all=False)
    insumo_row, insumo_col = find_header_cell(ws, SHEET1_INSUMO_KEYWORDS, match_all=False)
    name_row, name_col = find_header_cell(ws, SHEET1_NAME_KEYWORDS, match_all=False)
    group_row, group_col = find_header_cell(ws, SHEET1_GROUP_KEYWORDS, match_all=False)

    ejecutada_col  = None
    subheader_row  = None

    if group_row is not None and group_col is not None:
        for r in range(group_row + 1, min(group_row + HEADER_SEARCH_ROWS, ws.max_row + 1)):
            col = find_column_in_row(ws, r, SHEET1_SUBHDR_KEYWORDS,
                                     match_all=True, col_start=group_col)
            if col is not None:
                ejecutada_col = col
                subheader_row = r
                break

    if ejecutada_col is None:
        subheader_row, ejecutada_col = find_header_cell(
            ws, SHEET1_SUBHDR_KEYWORDS, match_all=True)

    unitaria_col = None
    precio_col   = None

    if subheader_row is not None and ejecutada_col is not None:
        for c in range(ejecutada_col + 1, ws.max_column + 1):
            text = normalize(ws.cell(subheader_row, c).value)
            if unitaria_col is None and 'unitaria' in text:
                unitaria_col = c
            if precio_col is None and 'precio' in text:
                precio_col = c
            if unitaria_col and precio_col:
                break

    # Fallbacks
    if code_col is None:
        code_row, code_col = 2, 1
        print("  Advertencia: columna 'Codigo' no encontrada. Usando col 1.")
    if insumo_col is None:
        insumo_col = code_col + 1
        print("  Advertencia: columna 'Insumo' no encontrada. Usando col siguiente al codigo.")
    if name_col is None:
        name_col = code_col + 2
        print(f"  Advertencia: columna 'Nombre/Descripción' no encontrada. Usando col {name_col}.")
    if ejecutada_col is None or subheader_row is None:
        subheader_row, ejecutada_col = 3, 9
        print("  Advertencia: 'Cant. Ejecutada' no encontrada. Usando col 9, fila 3.")
    if unitaria_col is None:
        unitaria_col = ejecutada_col + 1
        print(f"  Advertencia: 'Cant. Unitaria' no encontrada. Usando col {unitaria_col}.")
    if precio_col is None:
        precio_col = ejecutada_col + 2
        print(f"  Advertencia: 'Precio' no encontrada. Usando col {precio_col}.")

    group_header_row = group_row if group_row is not None else subheader_row

    print(f"  Codigo          -> fila {code_row}, col {code_col}")
    print(f"  Insumo          -> col {insumo_col}")
    print(f"  Nombre          -> col {name_col}")
    print(f"  Grupo ejecucion -> fila {group_header_row}, col {group_col}")
    print(f"  Cant. Ejecutada -> fila {subheader_row}, col {ejecutada_col}")
    print(f"  Cant. Unitaria   -> col {unitaria_col}")
    print(f"  Precio           -> col {precio_col}")

    return {
        'code_col':         code_col,
        'insumo_col':       insumo_col,
        'name_col':         name_col,
        'group_header_row': group_header_row,
        'subheader_row':    subheader_row,
        'ejecutada_col':    ejecutada_col,
        'unitaria_col':     unitaria_col,
        'precio_col':       precio_col,
    }


# ---------------------------------------------------------------------------
# Main processing function
# ---------------------------------------------------------------------------
def map_accumulated_in_place(input_path):
    """
    1. Read accumulated quantities from sheet 0.
    2. Detect headers dynamically in sheet 1.
    3. Append calculated columns to sheet 1 (Obra faltante, Proporcion, Cant. Unitaria, Precio, Costo, Total, Diferencia).
    4. Save in-place with .bak backup.
    """
    wb_ro = openpyxl.load_workbook(input_path, data_only=True)
    accum_dict = read_accumulated_values(wb_ro)
    wb_ro.close()

    print(f"\n[Mapeo] Abriendo '{input_path}' en modo edición...")
    wb = openpyxl.load_workbook(input_path)

    if len(wb.sheetnames) < 2:
        print(f"Error: El archivo solo tiene {len(wb.sheetnames)} hoja(s). Se necesitan al menos 2.")
        return False

    ws = wb.worksheets[1]
    h = detect_sheet1_headers(ws)

    code_col         = h['code_col']
    insumo_col       = h['insumo_col']
    group_header_row = h['group_header_row']
    subheader_row    = h['subheader_row']
    ejecutada_col    = h['ejecutada_col']
    unitaria_col     = h['unitaria_col']
    precio_col       = h['precio_col']

    # Column: 'Obra faltante'
    col_accum = None
    for c in range(1, ws.max_column + 1):
        if normalize(ws.cell(group_header_row, c).value) == 'obra faltante':
            col_accum = c
            print(f"\nColumna 'Obra faltante' ya existente en '{get_column_letter(col_accum)}'. Sobreescribiendo...")
            break

    if col_accum is None:
        last_col = 1
        for c in range(1, ws.max_column + 1):
            v1 = ws.cell(group_header_row, c).value
            v2 = ws.cell(subheader_row,    c).value
            if v1 is not None or v2 is not None:
                last_col = c
        col_accum = last_col + 1
        print(f"\nInsertando nueva columna 'Obra faltante' en '{get_column_letter(col_accum)}'...")

    col_accum_letter = get_column_letter(col_accum)

    # Column: 'Proporción'
    col_ratio = None
    for c in range(1, ws.max_column + 1):
        if normalize(ws.cell(group_header_row, c).value) in ('proporcion', 'proporción'):
            col_ratio = c
            print(f"Columna 'Proporcion' ya existente en '{get_column_letter(col_ratio)}'. Sobreescribiendo...")
            break

    if col_ratio is None:
        col_ratio = col_accum + 1
        print(f"Insertando nueva columna 'Proporcion' en '{get_column_letter(col_ratio)}'...")

    col_ratio_letter = get_column_letter(col_ratio)

    # Column: 'Cant. Unitaria'
    col_unitaria = None
    for c in range(1, ws.max_column + 1):
        if normalize(ws.cell(subheader_row, c).value) in ('cant. unitaria ejecucion', 'cant. unitaria ejec'):
            col_unitaria = c
            break
    if col_unitaria is None:
        col_unitaria = col_ratio + 1
    col_unitaria_letter = get_column_letter(col_unitaria)

    # Column: 'Precio'
    col_precio = None
    for c in range(1, ws.max_column + 1):
        if normalize(ws.cell(subheader_row, c).value) in ('precio ejecucion', 'precio ejec'):
            col_precio = c
            break
    if col_precio is None:
        col_precio = col_unitaria + 1
    col_precio_letter = get_column_letter(col_precio)

    # Column: 'Costo Ejec'
    col_costo = None
    for c in range(1, ws.max_column + 1):
        if normalize(ws.cell(subheader_row, c).value) in ('costo ejec', 'costo ejecucion'):
            col_costo = c
            break
    if col_costo is None:
        col_costo = col_precio + 1
    col_costo_letter = get_column_letter(col_costo)

    # Column: 'Total Unitaria'
    col_total = None
    for c in range(1, ws.max_column + 1):
        if normalize(ws.cell(subheader_row, c).value) in ('total unitaria', 'total unid'):
            col_total = c
            break
    if col_total is None:
        col_total = col_costo + 1
    col_total_letter = get_column_letter(col_total)

    # Column: 'Diferencia'
    col_diff = None
    for c in range(1, ws.max_column + 1):
        if normalize(ws.cell(subheader_row, c).value) in ('diferencia', 'dif'):
            col_diff = c
            break
    if col_diff is None:
        col_diff = col_total + 1
    col_diff_letter = get_column_letter(col_diff)

    grp_src = ws.cell(group_header_row, ejecutada_col)
    for col, label in [
        (col_accum,    "Obra faltante"),
        (col_ratio,    "Proporcion"),
        (col_unitaria, "Analisis unitario ejecucion"),
        (col_precio,   "Analisis unitario ejecucion"),
        (col_costo,    "Analisis unitario ejecucion"),
        (col_total,    "Analisis unitario ejecucion"),
        (col_diff,     "Analisis unitario ejecucion"),
    ]:
        cell = ws.cell(group_header_row, col)
        cell.value = label
        copy_cell_style(grp_src, cell)

    sub_src = ws.cell(subheader_row, ejecutada_col)
    for col, label in [
        (col_accum,    "Cant. Ejecutada"),
        (col_ratio,    "Sub / APU"),
        (col_unitaria, "Cant. Unitaria Ejec"),
        (col_precio,   "Precio Ejec"),
        (col_costo,    "Costo Ejec"),
        (col_total,    "Total Unitaria"),
        (col_diff,     "Diferencia"),
    ]:
        cell = ws.cell(subheader_row, col)
        cell.value = label
        copy_cell_style(sub_src, cell)

    data_start_row = subheader_row + 1
    current_parent_row = None

    for r in range(data_start_row, ws.max_row + 1):
        code   = ws.cell(r, code_col).value
        insumo = ws.cell(r, insumo_col).value

        code_str = str(code).strip() if code is not None else ""
        if not code_str:
            continue

        is_parent = insumo is None or str(insumo).strip() == ""
        src_cell  = ws.cell(r, ejecutada_col)

        if is_parent:
            if code_str in accum_dict:
                dst_cell = ws.cell(r, col_accum)
                copy_cell_style(src_cell, dst_cell)
                dst_cell.value = accum_dict[code_str]
                current_parent_row = r
            for col in (col_ratio, col_unitaria, col_precio, col_costo, col_total, col_diff):
                ws.cell(r, col).value = None
        else:
            raw_val = src_cell.value
            dst_cell = ws.cell(r, col_accum)
            if raw_val is not None:
                copy_cell_style(src_cell, dst_cell)
                dst_cell.value = raw_val

            ratio_cell = ws.cell(r, col_ratio)
            copy_cell_style(src_cell, ratio_cell)
            if current_parent_row is not None:
                ratio_cell.value = (
                    f"=IF(AND(ISNUMBER({col_accum_letter}{current_parent_row}), {col_accum_letter}{current_parent_row}<>0),"
                    f"{col_accum_letter}{r}/{col_accum_letter}{current_parent_row},\"\")"
                )
            else:
                ratio_cell.value = None

            u_src  = ws.cell(r, unitaria_col)
            u_cell = ws.cell(r, col_unitaria)
            copy_cell_style(u_src, u_cell)
            u_cell.value = u_src.value

            p_src  = ws.cell(r, precio_col)
            p_cell = ws.cell(r, col_precio)
            copy_cell_style(p_src, p_cell)
            p_cell.value = p_src.value

            c_cell = ws.cell(r, col_costo)
            copy_cell_style(p_src, c_cell)
            if current_parent_row is not None:
                c_cell.value = (
                    f'=IF({col_ratio_letter}{r}<>"", {col_precio_letter}{r}*{col_ratio_letter}{r}, "")'
                )

            t_cell = ws.cell(r, col_total)
            copy_cell_style(u_src, t_cell)
            if current_parent_row is not None:
                t_cell.value = (
                    f'=IF(AND(ISNUMBER({col_accum_letter}{current_parent_row}), {col_accum_letter}{current_parent_row}<>0), {col_unitaria_letter}{r}*{col_accum_letter}{current_parent_row}, "")'
                )

            d_cell = ws.cell(r, col_diff)
            copy_cell_style(u_src, d_cell)
            if current_parent_row is not None:
                d_cell.value = (
                    f'=IF(AND(ISNUMBER({col_accum_letter}{current_parent_row}), {col_accum_letter}{current_parent_row}<>0), {col_total_letter}{r}-{col_accum_letter}{r}, "")'
                )

    ws.column_dimensions[col_accum_letter].width    = 20
    ws.column_dimensions[col_ratio_letter].width    = 15
    ws.column_dimensions[col_unitaria_letter].width = 20
    ws.column_dimensions[col_precio_letter].width   = 18
    ws.column_dimensions[col_costo_letter].width    = 18
    ws.column_dimensions[col_total_letter].width    = 18
    ws.column_dimensions[col_diff_letter].width     = 18

    backup_path = input_path + ".bak"
    try:
        shutil.copyfile(input_path, backup_path)
        print(f"Copia de seguridad creada en: '{backup_path}'")
    except Exception as e:
        print(f"Advertencia: no se pudo crear la copia de seguridad: {e}")

    wb.save(input_path)
    print(f"¡Éxito! Archivo guardado en: '{input_path}'")
    return True


# ---------------------------------------------------------------------------
# Concrete Mix Validation Module
# ---------------------------------------------------------------------------
TOLERANCIA = 0.15   # 15% tolerance

def find_mix_design_sheets(wb, exclude_titles):
    fichas = []
    for ws in wb.worksheets:
        if ws.title in exclude_titles:
            continue

        insumo_row, insumo_col = find_header_cell(ws, ['insumo'], match_all=False)
        if insumo_col is None:
            continue
        qty_row, qty_col = find_header_cell(ws, ['cantidad'], match_all=False)
        if qty_col is None:
            qty_col = insumo_col + 2

        rows = {}
        for r in range(insumo_row + 1, ws.max_row + 1):
            name = normalize(ws.cell(r, insumo_col).value)
            if not name:
                continue
            if 'cemento' in name and 'cemento' not in rows:
                rows['cemento'] = r
            elif 'arena' in name and 'arena' not in rows:
                rows['arena'] = r
            elif 'triturado' in name and 'triturado' not in rows:
                rows['triturado'] = r

        if {'cemento', 'arena', 'triturado'} <= rows.keys():
            fichas.append({
                'sheet': ws,
                'title': ws.title,
                'cemento_row': rows['cemento'],
                'arena_row': rows['arena'],
                'triturado_row': rows['triturado'],
                'qty_col': qty_col,
            })
    return fichas


def find_concrete_apus(ws, code_col, insumo_col, nombre_col, ejec_col_real):
    items = []
    current = None

    for r in range(1, ws.max_row + 1):
        code = ws.cell(r, code_col).value
        insumo = ws.cell(r, insumo_col).value
        nombre = ws.cell(r, nombre_col).value

        code_str = str(code).strip() if code is not None else ""
        if not code_str:
            continue

        is_parent = insumo is None or str(insumo).strip() == ""

        if is_parent:
            if current and {'cemento', 'arena', 'triturado'} <= current['rows'].keys():
                items.append(current)
            current = {'codigo': code_str, 'nombre_item': nombre or "",
                       'fila_padre': r, 'rows': {}}
            continue

        if current is None:
            continue

        name_norm = normalize(nombre)
        if 'subtotales' in name_norm:
            continue
        if 'cemento' in name_norm and 'cemento' not in current['rows']:
            current['rows']['cemento'] = r
        elif 'arena' in name_norm and 'arena' not in current['rows']:
            current['rows']['arena'] = r
        elif 'triturado' in name_norm and 'triturado' not in current['rows']:
            current['rows']['triturado'] = r

    if current and {'cemento', 'arena', 'triturado'} <= current['rows'].keys():
        items.append(current)

    return items


def col_letter(ws_title, col, row):
    return f"'{ws_title}'!{get_column_letter(col)}{row}"


def build_validation_sheet(input_path, output_path=None):
    wb = openpyxl.load_workbook(input_path)

    apu_sheet_title = None
    for ws in wb.worksheets:
        r, c = find_header_cell(ws, ['análisis unitario ejecución', 'analisis unitario ejecucion'],
                                 match_all=False)
        if c is not None:
            apu_sheet_title = ws.title
            ws_apu = ws
            break

    if apu_sheet_title is None:
        raise RuntimeError("No se encontró la hoja de APUs (con 'Analisis unitario ejecucion').")

    h = detect_sheet1_headers(ws_apu)
    code_col = h['code_col']
    insumo_col = h['insumo_col']
    nombre_col = h['name_col']
    ejec_col_real = h['ejecutada_col']

    col_obra_faltante = None
    for c in range(1, ws_apu.max_column + 1):
        if normalize(ws_apu.cell(h['group_header_row'], c).value) == 'obra faltante':
            col_obra_faltante = c
            break
    qty_col = col_obra_faltante if col_obra_faltante else ejec_col_real

    fichas = find_mix_design_sheets(wb, exclude_titles={apu_sheet_title, wb.worksheets[0].title})
    if not fichas:
        raise RuntimeError("No se encontró ninguna hoja de ficha de mezcla (ej. '3000 PSI').")

    items = find_concrete_apus(ws_apu, code_col, insumo_col, nombre_col, qty_col)
    if not items:
        print("Advertencia: no se encontraron items con insumos Cemento+Arena+Triturado.")

    sheet_name = "Validacion Mezcla Concreto"
    if sheet_name in wb.sheetnames:
        del wb[sheet_name]
    vs = wb.create_sheet(sheet_name)

    header_fill = PatternFill("solid", fgColor="1F4E78")
    header_font = Font(bold=True, color="FFFFFF")
    thin = Side(style='thin', color='B7B7B7')
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    wrap = Alignment(wrap_text=True, vertical='center', horizontal='center')

    vs['A1'] = "Validación de mezcla de concreto: Cemento vs. Arena y Triturado"
    vs['A1'].font = Font(bold=True, size=13)
    vs['A2'] = f"Compara el cemento REGISTRADO en cada APU contra el cemento teórico. Tolerancia: ±{TOLERANCIA * 100:.0f}%."
    vs['A2'].font = Font(italic=True, size=9, color="555555")

    headers = [
        "Código Item", "Nombre Item", "Ficha usada",
        "Cemento registrado (sc)", "Arena registrada (m3)", "Triturado registrado (m3)",
        "Cemento esperado según Arena (sc)", "Cemento esperado según Triturado (sc)",
        "Dif. % Cemento vs. Arena", "Dif. % Cemento vs. Triturado",
        "Dif. % Arena vs Triturado (proporción)", "Estado"
    ]
    header_row = 4
    for j, htext in enumerate(headers, start=1):
        cell = vs.cell(header_row, j, htext)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = wrap
        cell.border = border

    row = header_row + 1
    for item in items:
        ficha = fichas[0]
        item_text = normalize(item['nombre_item'])
        for f in fichas:
            digits = ''.join(ch for ch in f['title'] if ch.isdigit())
            if digits and digits in item_text:
                ficha = f
                break

        f_title = ficha['sheet'].title
        f_qty_col = ficha['qty_col']
        cemento_ficha_ref = col_letter(f_title, f_qty_col, ficha['cemento_row'])
        arena_ficha_ref = col_letter(f_title, f_qty_col, ficha['arena_row'])
        triturado_ficha_ref = col_letter(f_title, f_qty_col, ficha['triturado_row'])

        cemento_real_ref = col_letter(apu_sheet_title, qty_col, item['rows']['cemento'])
        arena_real_ref = col_letter(apu_sheet_title, qty_col, item['rows']['arena'])
        triturado_real_ref = col_letter(apu_sheet_title, qty_col, item['rows']['triturado'])

        vs.cell(row, 1, item['codigo'])
        vs.cell(row, 2, item['nombre_item'])
        vs.cell(row, 3, f_title)
        vs.cell(row, 4, f"={cemento_real_ref}")
        vs.cell(row, 5, f"={arena_real_ref}")
        vs.cell(row, 6, f"={triturado_real_ref}")
        vs.cell(row, 7, f"=IFERROR({arena_real_ref}*({cemento_ficha_ref}/{arena_ficha_ref}),\"\")")
        vs.cell(row, 8, f"=IFERROR({triturado_real_ref}*({cemento_ficha_ref}/{triturado_ficha_ref}),\"\")")

        col_g = get_column_letter(7)
        col_h = get_column_letter(8)
        vs.cell(row, 9, f"=IFERROR(({cemento_real_ref}-{col_g}{row})/{col_g}{row},\"\")")
        vs.cell(row, 9).number_format = '0.0%'
        vs.cell(row, 10, f"=IFERROR(({cemento_real_ref}-{col_h}{row})/{col_h}{row},\"\")")
        vs.cell(row, 10).number_format = '0.0%'
        vs.cell(row, 11,
                f"=IFERROR((({arena_real_ref}/{triturado_real_ref})-({arena_ficha_ref}/{triturado_ficha_ref}))"
                f"/({arena_ficha_ref}/{triturado_ficha_ref}),\"\")")
        vs.cell(row, 11).number_format = '0.0%'

        col_i = get_column_letter(9)
        col_j = get_column_letter(10)
        col_k = get_column_letter(11)
        vs.cell(row, 12,
                f'=IF(OR(ABS({col_i}{row})>{TOLERANCIA},ABS({col_j}{row})>{TOLERANCIA},'
                f'ABS({col_k}{row})>{TOLERANCIA}),"Revisar","OK")')

        for c in range(1, 13):
            vs.cell(row, c).border = border
            if c in (4, 5, 6, 7, 8):
                vs.cell(row, c).number_format = '0.00'

        row += 1

    last_row = row - 1
    if last_row >= header_row + 1:
        vs.conditional_formatting.add(
            f"L{header_row+1}:L{last_row}",
            CellIsRule(operator='equal', formula=['"Revisar"'],
                       fill=PatternFill("solid", fgColor="F8CBAD"))
        )
        vs.conditional_formatting.add(
            f"L{header_row+1}:L{last_row}",
            CellIsRule(operator='equal', formula=['"OK"'],
                       fill=PatternFill("solid", fgColor="C6E0B4"))
        )

    widths = [14, 32, 14, 20, 18, 20, 22, 24, 20, 22, 24, 12]
    for j, w in enumerate(widths, start=1):
        vs.column_dimensions[get_column_letter(j)].width = w
    vs.freeze_panes = "A5"

    out = output_path or input_path
    backup_path = out + ".bak2"
    try:
        if os.path.exists(out):
            shutil.copyfile(out, backup_path)
            print(f"Copia de seguridad creada en: '{backup_path}'")
    except Exception as e:
        print(f"Advertencia: no se pudo crear la copia de seguridad: {e}")

    wb.save(out)
    print(f"Hoja '{sheet_name}' creada/actualizada. Archivo guardado en: '{out}'")
    return out


def main():
    files = [
        f for f in os.listdir('.')
        if f.endswith(('.xlsx', '.xls'))
        and not f.startswith('~$')
        and not f.endswith('.bak')
        and not f.endswith('.bak2')
    ]

    input_file = ""
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    elif len(files) == 1:
        input_file = files[0]
        print(f"Archivo encontrado: '{input_file}'")
    elif files:
        print("Archivos de Excel encontrados:")
        for idx, f in enumerate(files, 1):
            print(f"  {idx}. {f}")
        choice = input("Elige el número del archivo (o Enter para escribir la ruta): ").strip()
        if choice.isdigit() and 1 <= int(choice) <= len(files):
            input_file = files[int(choice) - 1]

    if not input_file:
        input_file = input("Ruta completa del archivo de Excel: ").strip().strip('\'"')

    if not os.path.exists(input_file):
        print(f"Error: '{input_file}' no existe.")
        return

    print(f"\n{'='*70}\nPASO 1/2: Mapeo de cantidades ejecutadas y análisis de APUs\n{'='*70}")
    map_accumulated_in_place(input_file)

    print(f"\n{'='*70}\nPASO 2/2: Validación de mezcla de concreto (Cemento / Arena / Triturado)\n{'='*70}")
    try:
        build_validation_sheet(input_file)
    except RuntimeError as e:
        print(f"Advertencia: se omitió la validación de mezcla de concreto -> {e}")

    print(f"\n{'='*70}\nProceso completo. Archivo final: '{input_file}'\n{'='*70}")


if __name__ == "__main__":
    main()
