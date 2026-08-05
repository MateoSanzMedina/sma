import openpyxl
from openpyxl.utils import get_column_letter
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.formatting.rule import CellIsRule
import io
import re
import math
import base64
from copy import copy

# ---------------------------------------------------------------------------
# Constants & Keywords
# ---------------------------------------------------------------------------
SHEET0_ITEM_KEYWORDS   = ['ítem', 'item', 'código', 'codigo']
SHEET0_ACCUM_KEYWORDS  = ['cant', 'ejecut', 'acumul']
SHEET1_CODE_KEYWORDS   = ['código', 'codigo']
SHEET1_INSUMO_KEYWORDS = ['insumo']
SHEET1_NAME_KEYWORDS   = ['descripción', 'descripcion', 'nombre', 'concepto']
SHEET1_GROUP_KEYWORDS  = ['análisis unitario ejecución', 'analisis unitario ejecucion']
SHEET1_SUBHDR_KEYWORDS = ['cant', 'ejecut']

HEADER_SEARCH_ROWS = 30
TOLERANCIA_CONCRETO = 0.15


def set_cell_value_safe(ws, row, col, value):
    """Establece un valor de celda de forma segura, incluso si es una celda combinada (MergedCell)."""
    cell = ws.cell(row, col)
    if type(cell).__name__ == 'MergedCell':
        for merged_range in ws.merged_cells.ranges:
            if cell.coordinate in merged_range:
                top_left = ws.cell(merged_range.min_row, merged_range.min_col)
                top_left.value = value
                return top_left
        return cell
    else:
        cell.value = value
        return cell


def copy_cell_style(src, dst):
    if src and src.has_style and type(dst).__name__ != 'MergedCell':
        dst.font          = copy(src.font)
        dst.border        = copy(src.border)
        dst.fill          = copy(src.fill)
        dst.number_format = src.number_format
        dst.protection    = copy(src.protection)
        dst.alignment     = copy(src.alignment)


def normalize(val):
    if val and isinstance(val, str):
        return ' '.join(val.lower().split())
    return ''


def all_keywords_in(text, keywords):
    return all(k in text for k in keywords)


def find_header_cell(ws, keywords, match_all=True, max_row=HEADER_SEARCH_ROWS, max_col=None):
    max_col = max_col or ws.max_column
    for r in range(1, min(max_row + 1, ws.max_row + 1)):
        for c in range(1, max_col + 1):
            text = normalize(ws.cell(r, c).value)
            if not text:
                continue
            hit = all_keywords_in(text, keywords) if match_all else any(k in text for k in keywords)
            if hit:
                return r, c
    return None, None


def find_column_in_row(ws, row, keywords, match_all=True, col_start=1, col_end=None):
    col_end = col_end or ws.max_column
    for c in range(col_start, col_end + 1):
        text = normalize(ws.cell(row, c).value)
        if not text:
            continue
        hit = all_keywords_in(text, keywords) if match_all else any(k in text for k in keywords)
        if hit:
            return c
    return None


def clean_numeric(val):
    if val is None:
        return 0.0
    if isinstance(val, (int, float)):
        if math.isnan(val):
            return 0.0
        return float(val)
    val_str = str(val).replace("$", "").replace(",", "").replace(" ", "").strip()
    try:
        return float(val_str)
    except ValueError:
        return 0.0


def find_apu_sheet(wb):
    """Encuentra dinámicamente la hoja que contiene la tabla principal de APUs mediante puntuación."""
    best_ws = wb.worksheets[0]
    best_score = -1

    for ws in wb.worksheets:
        score = 0
        for r in range(1, min(HEADER_SEARCH_ROWS, ws.max_row + 1)):
            row_str = ' '.join(normalize(ws.cell(r, c).value) for c in range(1, min(25, ws.max_column + 1)))
            if 'análisis unitario ejecución' in row_str or 'analisis unitario ejecucion' in row_str:
                score += 100
            elif 'ejecuci' in row_str:
                score += 50
            if 'análisis unitario base' in row_str or 'analisis unitario base' in row_str or 'base' in row_str:
                score += 30
            if 'código' in row_str or 'codigo' in row_str:
                score += 20
            if 'insumo' in row_str:
                score += 20

        if score > best_score:
            best_score = score
            best_ws = ws

    return best_ws


def read_accumulated_values(wb, apu_sheet_title):
    accum_dict = {}
    for ws in wb.worksheets:
        if ws.title == apu_sheet_title:
            continue
        item_row, item_col = find_header_cell(ws, SHEET0_ITEM_KEYWORDS, match_all=False)
        accum_row, accum_col = find_header_cell(ws, SHEET0_ACCUM_KEYWORDS, match_all=True)

        if item_col is not None and accum_col is not None:
            data_start = max(item_row or 0, accum_row or 0) + 1
            for r in range(data_start, ws.max_row + 1):
                code_val  = ws.cell(r, item_col).value
                accum_val = ws.cell(r, accum_col).value
                if code_val is None:
                    continue
                code_str = str(code_val).strip()
                if not code_str:
                    continue
                accum_dict[code_str] = clean_numeric(accum_val)
            break

    return accum_dict


def detect_sheet1_headers(ws):
    code_row, code_col = find_header_cell(ws, SHEET1_CODE_KEYWORDS, match_all=False)
    insumo_row, insumo_col = find_header_cell(ws, SHEET1_INSUMO_KEYWORDS, match_all=False)
    name_row, name_col = find_header_cell(ws, SHEET1_NAME_KEYWORDS, match_all=False)
    group_row, group_col = find_header_cell(ws, SHEET1_GROUP_KEYWORDS, match_all=False)

    header_row = group_row or code_row or 2

    base_group_col = 5
    ejec_group_col = 9
    faltante_group_col = None

    for c in range(1, ws.max_column + 1):
        v = normalize(ws.cell(header_row, c).value)
        if 'base' in v:
            base_group_col = c
        elif 'ejecuci' in v:
            ejec_group_col = c
        elif 'faltante' in v or 'obra faltante' in v:
            faltante_group_col = c

    ejecutada_col = None
    subheader_row = None

    if group_row is not None and group_col is not None:
        for r in range(group_row + 1, min(group_row + HEADER_SEARCH_ROWS, ws.max_row + 1)):
            col = find_column_in_row(ws, r, SHEET1_SUBHDR_KEYWORDS, match_all=True, col_start=group_col)
            if col is not None:
                ejecutada_col = col
                subheader_row = r
                break

    if ejecutada_col is None:
        subheader_row, ejecutada_col = find_header_cell(ws, SHEET1_SUBHDR_KEYWORDS, match_all=True)

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

    if code_col is None:
        code_col = 1
    if insumo_col is None:
        insumo_col = code_col + 1
    if name_col is None:
        name_col = code_col + 2
    if subheader_row is None:
        subheader_row = header_row + 1
    if ejecutada_col is None:
        ejecutada_col = ejec_group_col
    if unitaria_col is None:
        unitaria_col = ejecutada_col + 1
    if precio_col is None:
        precio_col = ejecutada_col + 2

    return {
        'code_col':           code_col,
        'insumo_col':         insumo_col,
        'name_col':           name_col,
        'group_header_row':   header_row,
        'subheader_row':      subheader_row,
        'base_group_col':     base_group_col,
        'ejec_group_col':     ejec_group_col,
        'faltante_group_col': faltante_group_col,
        'ejecutada_col':      ejecutada_col,
        'unitaria_col':       unitaria_col,
        'precio_col':         precio_col,
    }


def populate_excel_calculated_columns(wb, ws, accum_dict, h):
    code_col         = h['code_col']
    insumo_col       = h['insumo_col']
    group_header_row = h['group_header_row']
    subheader_row    = h['subheader_row']
    ejecutada_col    = h['ejecutada_col']
    unitaria_col     = h['unitaria_col']
    precio_col       = h['precio_col']
    faltante_col     = h['faltante_group_col']

    col_accum = None
    for c in range(1, ws.max_column + 1):
        if normalize(ws.cell(group_header_row, c).value) == 'obra faltante':
            col_accum = c
            break

    if col_accum is None:
        last_col = 1
        for c in range(1, ws.max_column + 1):
            v1 = ws.cell(group_header_row, c).value
            v2 = ws.cell(subheader_row, c).value
            if v1 is not None or v2 is not None:
                last_col = c
        col_accum = last_col + 1

    col_accum_letter = get_column_letter(col_accum)

    col_ratio = None
    for c in range(1, ws.max_column + 1):
        if normalize(ws.cell(group_header_row, c).value) in ('proporcion', 'proporción'):
            col_ratio = c
            break
    if col_ratio is None:
        col_ratio = col_accum + 1
    col_ratio_letter = get_column_letter(col_ratio)

    col_unitaria = None
    for c in range(1, ws.max_column + 1):
        if normalize(ws.cell(subheader_row, c).value) in ('cant. unitaria ejecucion', 'cant. unitaria ejec'):
            col_unitaria = c
            break
    if col_unitaria is None:
        col_unitaria = col_ratio + 1
    col_unitaria_letter = get_column_letter(col_unitaria)

    col_precio = None
    for c in range(1, ws.max_column + 1):
        if normalize(ws.cell(subheader_row, c).value) in ('precio ejecucion', 'precio ejec'):
            col_precio = c
            break
    if col_precio is None:
        col_precio = col_unitaria + 1
    col_precio_letter = get_column_letter(col_precio)

    col_costo = None
    for c in range(1, ws.max_column + 1):
        if normalize(ws.cell(subheader_row, c).value) in ('costo ejec', 'costo ejecucion'):
            col_costo = c
            break
    if col_costo is None:
        col_costo = col_precio + 1
    col_costo_letter = get_column_letter(col_costo)

    col_total = None
    for c in range(1, ws.max_column + 1):
        if normalize(ws.cell(subheader_row, c).value) in ('total unitaria', 'total unid'):
            col_total = c
            break
    if col_total is None:
        col_total = col_costo + 1
    col_total_letter = get_column_letter(col_total)

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
        cell = set_cell_value_safe(ws, group_header_row, col, label)
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
        cell = set_cell_value_safe(ws, subheader_row, col, label)
        copy_cell_style(sub_src, cell)

    data_start_row = subheader_row + 1
    current_parent_row = None

    for r in range(data_start_row, ws.max_row + 1):
        code   = ws.cell(r, code_col).value
        insumo = ws.cell(r, insumo_col).value

        code_str = str(code).strip() if code is not None else ""
        if not code_str:
            continue

        is_parent = insumo is None or str(insumo).strip() == "" or str(insumo).lower() in ("none", "nan")
        src_cell  = ws.cell(r, ejecutada_col)

        if is_parent:
            dst_cell = set_cell_value_safe(ws, r, col_accum, None)
            copy_cell_style(src_cell, dst_cell)

            if code_str in accum_dict:
                dst_cell.value = accum_dict[code_str]
            elif faltante_col is not None:
                dst_cell.value = clean_numeric(ws.cell(r, faltante_col).value)
            else:
                b_q = clean_numeric(ws.cell(r, h['base_group_col']).value)
                e_q = clean_numeric(src_cell.value)
                dst_cell.value = max(0.0, b_q - e_q) if b_q > e_q else e_q

            current_parent_row = r

            for col in (col_ratio, col_unitaria, col_precio, col_costo, col_total, col_diff):
                set_cell_value_safe(ws, r, col, None)
        else:
            raw_val = src_cell.value
            dst_cell = set_cell_value_safe(ws, r, col_accum, raw_val)
            copy_cell_style(src_cell, dst_cell)

            ratio_cell = set_cell_value_safe(ws, r, col_ratio, None)
            copy_cell_style(src_cell, ratio_cell)
            if current_parent_row is not None:
                ratio_cell.value = (
                    f"=IF(AND(ISNUMBER({col_accum_letter}{current_parent_row}), {col_accum_letter}{current_parent_row}<>0),"
                    f"{col_accum_letter}{r}/{col_accum_letter}{current_parent_row},\"\")"
                )

            u_src  = ws.cell(r, unitaria_col)
            u_cell = set_cell_value_safe(ws, r, col_unitaria, u_src.value)
            copy_cell_style(u_src, u_cell)

            p_src  = ws.cell(r, precio_col)
            p_cell = set_cell_value_safe(ws, r, col_precio, p_src.value)
            copy_cell_style(p_src, p_cell)

            c_cell = set_cell_value_safe(ws, r, col_costo, None)
            copy_cell_style(p_src, c_cell)
            if current_parent_row is not None:
                c_cell.value = (
                    f'=IF({col_ratio_letter}{r}<>"", {col_precio_letter}{r}*{col_ratio_letter}{r}, "")'
                )

            t_cell = set_cell_value_safe(ws, r, col_total, None)
            copy_cell_style(u_src, t_cell)
            if current_parent_row is not None:
                t_cell.value = (
                    f'=IF(AND(ISNUMBER({col_accum_letter}{current_parent_row}), {col_accum_letter}{current_parent_row}<>0), {col_unitaria_letter}{r}*{col_accum_letter}{current_parent_row}, "")'
                )

            d_cell = set_cell_value_safe(ws, r, col_diff, None)
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


def create_concrete_validation_sheet(wb, apu_ws_title, h, qty_col):
    ws_apu = wb[apu_ws_title]
    code_col = h['code_col']
    insumo_col = h['insumo_col']
    nombre_col = h['name_col']

    fichas = []
    exclude_titles = {apu_ws_title}

    for ws in wb.worksheets:
        if ws.title in exclude_titles:
            continue
        insumo_row, insumo_col_idx = find_header_cell(ws, ['insumo'], match_all=False)
        if insumo_col_idx is None:
            continue
        qty_row, q_col_idx = find_header_cell(ws, ['cantidad'], match_all=False)
        if q_col_idx is None:
            q_col_idx = insumo_col_idx + 2

        rows = {}
        for r in range(insumo_row + 1, ws.max_row + 1):
            name = normalize(ws.cell(r, insumo_col_idx).value)
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
                'qty_col': q_col_idx,
            })

    if not fichas:
        return

    items = []
    current = None
    for r in range(h['subheader_row'] + 1, ws_apu.max_row + 1):
        code = ws_apu.cell(r, code_col).value
        insumo = ws_apu.cell(r, insumo_col).value
        nombre = ws_apu.cell(r, nombre_col).value

        code_str = str(code).strip() if code is not None else ""
        if not code_str:
            continue

        is_parent = insumo is None or str(insumo).strip() == "" or str(insumo).lower() in ("none", "nan")

        if is_parent:
            if current and {'cemento', 'arena', 'triturado'} <= current['rows'].keys():
                items.append(current)
            current = {'codigo': code_str, 'nombre_item': str(nombre or ""),
                       'fila_padre': r, 'rows': {}}
            continue

        if current is None:
            continue

        name_norm = normalize(str(nombre))
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

    if not items:
        return

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
    vs['A2'] = f"Compara el cemento REGISTRADO en cada APU contra el cemento teórico. Tolerancia: ±{TOLERANCIA_CONCRETO * 100:.0f}%."
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

    def col_letter(ws_title, col, row):
        return f"'{ws_title}'!{get_column_letter(col)}{row}"

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

        cemento_real_ref = col_letter(apu_ws_title, qty_col, item['rows']['cemento'])
        arena_real_ref = col_letter(apu_ws_title, qty_col, item['rows']['arena'])
        triturado_real_ref = col_letter(apu_ws_title, qty_col, item['rows']['triturado'])

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
                f'=IF(OR(ABS({col_i}{row})>{TOLERANCIA_CONCRETO},ABS({col_j}{row})>{TOLERANCIA_CONCRETO},'
                f'ABS({col_k}{row})>{TOLERANCIA_CONCRETO}),"Revisar","OK")')

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


def create_alerts_sheet(wb, alerts):
    if not alerts:
        return
    sheet_name = "Alertas y Desviaciones"
    if sheet_name in wb.sheetnames:
        del wb[sheet_name]
    vs = wb.create_sheet(sheet_name)

    header_fill = PatternFill("solid", fgColor="C00000")
    header_font = Font(bold=True, color="FFFFFF")
    thin = Side(style='thin', color='B7B7B7')
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    wrap = Alignment(wrap_text=True, vertical='center', horizontal='left')

    vs['A1'] = "Reporte de Alertas Críticas de Costos y Rendimientos"
    vs['A1'].font = Font(bold=True, size=13)
    vs['A2'] = "Generado automáticamente por el motor de análisis SAO."
    vs['A2'].font = Font(italic=True, size=9, color="555555")

    headers = ["Nivel / Gravedad", "Código APU", "Código Insumo", "Tipo de Alerta", "Descripción / Mensaje"]
    header_row = 4
    for j, htext in enumerate(headers, start=1):
        cell = vs.cell(header_row, j, htext)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = wrap
        cell.border = border

    row = header_row + 1
    for a in alerts:
        severity = "CRÍTICO" if a.get("type") == "danger" else "ADVERTENCIA"
        vs.cell(row, 1, severity)
        vs.cell(row, 2, a.get("apu_code", ""))
        vs.cell(row, 3, a.get("insumo_code", ""))
        vs.cell(row, 4, a.get("title", ""))
        vs.cell(row, 5, a.get("message", ""))

        for c in range(1, 6):
            cell = vs.cell(row, c)
            cell.border = border
            if c == 1:
                fill_color = "F8CBAD" if severity == "CRÍTICO" else "FFF2CC"
                cell.fill = PatternFill("solid", fgColor=fill_color)
                cell.font = Font(bold=True)
        row += 1

    widths = [18, 16, 16, 32, 80]
    for j, w in enumerate(widths, start=1):
        vs.column_dimensions[get_column_letter(j)].width = w
    vs.freeze_panes = "A5"


def create_reutilization_sheet(wb, reutilizaciones):
    if not reutilizaciones:
        return
    sheet_name = "Oportunidades Reutilizacion"
    if sheet_name in wb.sheetnames:
        del wb[sheet_name]
    vs = wb.create_sheet(sheet_name)

    header_fill = PatternFill("solid", fgColor="385723")
    header_font = Font(bold=True, color="FFFFFF")
    thin = Side(style='thin', color='B7B7B7')
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    wrap = Alignment(wrap_text=True, vertical='center', horizontal='left')

    vs['A1'] = "Oportunidades de Reutilización y Compensación de Materiales"
    vs['A1'].font = Font(bold=True, size=13)
    vs['A2'] = "Identifica sobrantes proyectados en APUs para cubrir faltantes en otros APUs."
    vs['A2'].font = Font(italic=True, size=9, color="555555")

    headers = ["Código Insumo", "Nombre Material", "Unidad", "APU Origen (Excedente)", "APU Destino (Faltante)", "Cantidad a Reutilizar", "Recomendación de Obra"]
    header_row = 4
    for j, htext in enumerate(headers, start=1):
        cell = vs.cell(header_row, j, htext)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = wrap
        cell.border = border

    row = header_row + 1
    for r in reutilizaciones:
        vs.cell(row, 1, r.get("insumo_code", ""))
        vs.cell(row, 2, r.get("insumo_name", ""))
        vs.cell(row, 3, r.get("unit", ""))
        vs.cell(row, 4, f"{r.get('from_apu_code', '')} - {r.get('from_apu_name', '')}")
        vs.cell(row, 5, f"{r.get('to_apu_code', '')} - {r.get('to_apu_name', '')}")
        vs.cell(row, 6, r.get("qty", 0.0))
        vs.cell(row, 6).number_format = '#,##0.00'
        vs.cell(row, 7, r.get("message", ""))

        for c in range(1, 8):
            vs.cell(row, c).border = border

        row += 1

    widths = [16, 25, 10, 35, 35, 20, 75]
    for j, w in enumerate(widths, start=1):
        vs.column_dimensions[get_column_letter(j)].width = w
    vs.freeze_panes = "A5"


def find_concrete_validation_data(wb, apu_ws, headers_info):
    exclude_titles = {apu_ws.title}
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
            cemento_qty = clean_numeric(ws.cell(rows['cemento'], qty_col).value)
            arena_qty = clean_numeric(ws.cell(rows['arena'], qty_col).value)
            triturado_qty = clean_numeric(ws.cell(rows['triturado'], qty_col).value)
            
            fichas.append({
                'title': ws.title,
                'cemento_theo': cemento_qty,
                'arena_theo': arena_qty,
                'triturado_theo': triturado_qty,
            })

    if not fichas:
        return []

    code_col = headers_info['code_col']
    insumo_col = headers_info['insumo_col']
    name_col = headers_info['name_col']
    ejec_col = headers_info['ejecutada_col']

    concrete_items = []
    current = None

    for r in range(headers_info['subheader_row'] + 1, apu_ws.max_row + 1):
        code_val = apu_ws.cell(r, code_col).value
        insumo_val = apu_ws.cell(r, insumo_col).value
        name_val = apu_ws.cell(r, name_col).value

        code_str = str(code_val).strip() if code_val is not None else ""
        if not code_str:
            continue

        is_parent = insumo_val is None or str(insumo_val).strip() == "" or str(insumo_val).lower() in ("none", "nan")

        if is_parent:
            if current and {'cemento', 'arena', 'triturado'} <= current['insumos'].keys():
                concrete_items.append(current)
            current = {
                'code': code_str,
                'name': str(name_val).strip() if name_val else "",
                'insumos': {}
            }
            continue

        if current is None:
            continue

        name_norm = normalize(str(name_val))
        if 'subtotal' in name_norm:
            continue

        qty = clean_numeric(apu_ws.cell(r, ejec_col).value)
        if 'cemento' in name_norm and 'cemento' not in current['insumos']:
            current['insumos']['cemento'] = qty
        elif 'arena' in name_norm and 'arena' not in current['insumos']:
            current['insumos']['arena'] = qty
        elif 'triturado' in name_norm and 'triturado' not in current['insumos']:
            current['insumos']['triturado'] = qty

    if current and {'cemento', 'arena', 'triturado'} <= current['insumos'].keys():
        concrete_items.append(current)

    results = []
    for item in concrete_items:
        ficha = fichas[0]
        item_text = normalize(item['name'])
        for f in fichas:
            digits = ''.join(ch for ch in f['title'] if ch.isdigit())
            if digits and digits in item_text:
                ficha = f
                break

        c_reg = item['insumos']['cemento']
        a_reg = item['insumos']['arena']
        t_reg = item['insumos']['triturado']

        c_exp_arena = a_reg * (ficha['cemento_theo'] / ficha['arena_theo']) if ficha['arena_theo'] > 0 else 0.0
        c_exp_trit  = t_reg * (ficha['cemento_theo'] / ficha['triturado_theo']) if ficha['triturado_theo'] > 0 else 0.0

        dev_arena = ((c_reg - c_exp_arena) / c_exp_arena) if c_exp_arena > 0 else 0.0
        dev_trit  = ((c_reg - c_exp_trit) / c_exp_trit) if c_exp_trit > 0 else 0.0

        status = "Revisar" if (abs(dev_arena) > TOLERANCIA_CONCRETO or abs(dev_trit) > TOLERANCIA_CONCRETO) else "OK"

        results.append({
            "apu_code": item['code'],
            "apu_name": item['name'],
            "ficha_title": ficha['title'],
            "cemento_reg": c_reg,
            "arena_reg": a_reg,
            "triturado_reg": t_reg,
            "cemento_expected_arena": c_exp_arena,
            "cemento_expected_triturado": c_exp_trit,
            "dev_pct_arena": dev_arena * 100,
            "dev_pct_triturado": dev_trit * 100,
            "status": status
        })

    return results


async def process_sao_costs(file_content: bytes, filename: str):
    """
    Procesa cualquier archivo Excel de SAO (1 o múltiples hojas).
    Retorna el análisis JSON + la versión modificada en Excel en formato Base64.
    """
    try:
        wb = openpyxl.load_workbook(io.BytesIO(file_content), data_only=False)
    except Exception as e:
        raise ValueError(f"No se pudo leer el archivo Excel con openpyxl: {str(e)}")

    if not wb.sheetnames:
        raise ValueError("El archivo Excel no contiene hojas de cálculo.")

    ws_apu = find_apu_sheet(wb)
    apu_ws_title = ws_apu.title

    accum_dict = read_accumulated_values(wb, apu_ws_title)

    h = detect_sheet1_headers(ws_apu)
    code_col = h['code_col']
    insumo_col = h['insumo_col']
    name_col = h['name_col']
    subheader_row = h['subheader_row']
    base_group_col = h['base_group_col']
    ejec_group_col = h['ejec_group_col']
    faltante_group_col = h['faltante_group_col']

    ejecutada_col = h['ejecutada_col']
    unitaria_col = h['unitaria_col']
    precio_col = h['precio_col']

    apus = []
    current_apu = None

    for r in range(subheader_row + 1, ws_apu.max_row + 1):
        code_val = ws_apu.cell(r, code_col).value
        insumo_val = ws_apu.cell(r, insumo_col).value
        name_val = ws_apu.cell(r, name_col).value

        code_str = str(code_val).strip() if code_val is not None else ""
        if not code_str:
            continue

        clean_code = code_str.replace(".0", "").replace(".", "").strip()
        if not re.match(r'^\d+$', clean_code):
            continue

        insumo_str = str(insumo_val).strip() if insumo_val is not None else ""
        nombre = str(name_val).strip() if name_val is not None else ""
        unit_cell = ws_apu.cell(r, name_col + 1).value
        unidad = str(unit_cell).strip() if unit_cell is not None else ""

        is_parent = not insumo_str or insumo_str.lower() in ("none", "nan", "")

        if is_parent:
            base_qty = clean_numeric(ws_apu.cell(r, base_group_col).value)
            ejec_qty = clean_numeric(ws_apu.cell(r, ejecutada_col).value)

            if clean_code in accum_dict:
                obra_faltante = accum_dict[clean_code]
            elif faltante_group_col is not None:
                obra_faltante = clean_numeric(ws_apu.cell(r, faltante_group_col).value)
            else:
                obra_faltante = max(0.0, base_qty - ejec_qty) if base_qty > ejec_qty else ejec_qty

            current_apu = {
                "code": clean_code,
                "name": nombre,
                "unit": unidad,
                "base_qty": base_qty,
                "ejec_qty": ejec_qty,
                "faltante_qty_teorica": obra_faltante,
                "obra_faltante_qty": obra_faltante,
                "resources": []
            }
            apus.append(current_apu)

        elif insumo_str != "99999" and "subtotal" not in insumo_str.lower() and current_apu:
            base_qty = clean_numeric(ws_apu.cell(r, base_group_col).value)
            base_unit_qty = clean_numeric(ws_apu.cell(r, base_group_col + 1).value)
            base_price = clean_numeric(ws_apu.cell(r, base_group_col + 2).value)
            base_subtotal = clean_numeric(ws_apu.cell(r, base_group_col + 3).value) or (base_qty * base_price)

            ejec_qty = clean_numeric(ws_apu.cell(r, ejecutada_col).value)
            ejec_unit_qty = clean_numeric(ws_apu.cell(r, unitaria_col).value)
            ejec_price = clean_numeric(ws_apu.cell(r, precio_col).value)
            ejec_subtotal = ejec_qty * ejec_price

            current_apu["resources"].append({
                "insumo": insumo_str.replace(".0", "").strip(),
                "name": nombre,
                "unit": unidad,
                "base_qty": base_qty,
                "base_unit_qty": base_unit_qty,
                "base_price": base_price,
                "base_subtotal": base_subtotal,
                "ejec_qty": ejec_qty,
                "ejec_unit_qty": ejec_unit_qty,
                "ejec_price": ejec_price,
                "ejec_subtotal": ejec_subtotal,
                "excel_faltante_qty": 0.0,
                "excel_faltante_unit_qty": 0.0,
                "excel_faltante_price": 0.0,
                "excel_faltante_subtotal": 0.0
            })

    # Proyecciones y Reutilización
    material_balances = {}
    alerts = []
    reutilization_tips = []

    for apu in apus:
        q_rem = apu["obra_faltante_qty"]

        for res in apu["resources"]:
            ins_code = res["insumo"]
            ins_name = res["name"]
            ins_unit = res["unit"]

            proj_theo_rem_qty = q_rem * res["base_unit_qty"]
            proj_theo_rem_cost = proj_theo_rem_qty * res["base_price"]
            res["proj_theo"] = {
                "qty": res["ejec_qty"] + proj_theo_rem_qty,
                "cost": (res["ejec_qty"] * res["ejec_price"]) + proj_theo_rem_cost,
                "dev_qty": (res["ejec_qty"] + proj_theo_rem_qty) - res["base_qty"],
                "dev_cost": ((res["ejec_qty"] * res["ejec_price"]) + proj_theo_rem_cost) - (res["base_qty"] * res["base_price"])
            }

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

            dev_qty = res["proj_hist"]["dev_qty"]
            if abs(dev_qty) > 0.01:
                if ins_code not in material_balances:
                    material_balances[ins_code] = {
                        "name": ins_name,
                        "unit": ins_unit,
                        "surpluses": [],
                        "deficits": []
                    }
                if dev_qty < 0:
                    material_balances[ins_code]["surpluses"].append({
                        "apu_code": apu["code"],
                        "apu_name": apu["name"],
                        "qty": abs(dev_qty)
                    })
                else:
                    material_balances[ins_code]["deficits"].append({
                        "apu_code": apu["code"],
                        "apu_name": apu["name"],
                        "qty": dev_qty
                    })

            dev_cost = res["proj_hist"]["dev_cost"]
            base_cost = res["base_qty"] * res["base_price"]
            if dev_cost > 500000:
                pct = (dev_cost / base_cost * 100) if base_cost > 0 else 100
                alerts.append({
                    "type": "danger",
                    "title": "Sobrecosto Crítico en Insumo",
                    "message": f"El insumo '{res['name']}' en el APU '{apu['name']}' proyecta un sobrecosto de {pct:.1f}% ({dev_cost:,.0f} COP) sobre el presupuesto base.",
                    "apu_code": apu["code"],
                    "insumo_code": res["insumo"]
                })

            if res["ejec_qty"] > 0 and res["base_unit_qty"] > 0 and res["ejec_unit_qty"] > res["base_unit_qty"] * 1.15:
                alerts.append({
                    "type": "warning",
                    "title": "Desviación de Rendimiento",
                    "message": f"El rendimiento ejecutado de '{res['name']}' en '{apu['name']}' es un {((res['ejec_unit_qty']/res['base_unit_qty'] - 1)*100):.1f}% superior al presupuesto base.",
                    "apu_code": apu["code"],
                    "insumo_code": res["insumo"]
                })

    for ins_code, balance in material_balances.items():
        surpluses = balance["surpluses"]
        deficits = balance["deficits"]
        if surpluses and deficits:
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
                        sur["qty"] -= matched_qty
                        defic["qty"] -= matched_qty

    concrete_validation = find_concrete_validation_data(wb, ws_apu, h)
    for c_val in concrete_validation:
        if c_val["status"] == "Revisar":
            alerts.append({
                "type": "danger",
                "title": "Desviación en Mezcla de Concreto",
                "message": f"El APU '{c_val['apu_name']}' ({c_val['apu_code']}) presenta una desviación en la proporción de Cemento vs. Agregados contra la ficha '{c_val['ficha_title']}'.",
                "apu_code": c_val["apu_code"],
                "insumo_code": "CONCRETO"
            })

    populate_excel_calculated_columns(wb, ws_apu, accum_dict, h)
    
    col_obra_faltante = None
    for c in range(1, ws_apu.max_column + 1):
        if normalize(ws_apu.cell(h['group_header_row'], c).value) == 'obra faltante':
            col_obra_faltante = c
            break
    qty_col = col_obra_faltante if col_obra_faltante else ejecutada_col
    
    create_concrete_validation_sheet(wb, apu_ws_title, h, qty_col)
    create_alerts_sheet(wb, alerts)
    create_reutilization_sheet(wb, reutilization_tips)

    out_buffer = io.BytesIO()
    wb.save(out_buffer)
    out_buffer.seek(0)
    excel_b64 = base64.b64encode(out_buffer.getvalue()).decode('utf-8')

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
        "total_reutilizations": len(reutilization_tips),
        "total_concrete_audits": len(concrete_validation)
    }

    return {
        "summary": summary,
        "alerts": alerts,
        "reutilizaciones": reutilization_tips,
        "concrete_validation": concrete_validation,
        "details": apus,
        "excel_b64": excel_b64
    }
