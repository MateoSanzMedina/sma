import pandas as pd
import json
import re

def test_matching():
    # Load schedule
    schedule_df = pd.read_excel(r'c:\Users\ssanz\OneDrive\Documentos\ChainPointAI\SERVING\SMA\backend\documents\1111.xlsx')
    meses = {
        'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04', 
        'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08', 
        'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
    }
    
    def parse_spanish_date(date_str):
        if not isinstance(date_str, str): return str(date_str)
        try:
            parts = date_str.lower().split()
            day = parts[0].zfill(2)
            month = meses.get(parts[1], '01')
            year = parts[2]
            return f'{year}-{month}-{day}'
        except:
            return date_str

    schedule_tasks = []
    for _, row in schedule_df.iterrows():
        if pd.notna(row['Nombre']) and pd.notna(row['Comienzo']):
            schedule_tasks.append({
                'name': str(row['Nombre']),
                'start': parse_spanish_date(row['Comienzo'])
            })

    # Load budget
    df = pd.read_excel(r'c:\Users\ssanz\OneDrive\Documentos\ChainPointAI\SERVING\SMA\backend\documents\20260303 Presupuesto Bosque de Agua V5.xlsx', sheet_name='Presupuesto V5', header=None)
    budget_items = []
    current_chapter = 'Sin Capítulo'
    
    def is_code(s):
        s_clean = s.replace('.0', '').replace('.', '').strip()
        return s_clean.isdigit() and len(s_clean) >= 4

    for idx, row in df.iterrows():
        val0 = str(row[0]).strip() if pd.notna(row[0]) else ''
        val1 = str(row[1]).strip() if pd.notna(row[1]) else ''
        val2 = str(row[2]).strip() if pd.notna(row[2]) else ''
        
        code, desc, total_val = None, None, None
        if is_code(val0):
            code = val0
            desc = val1
            for col_idx in [7, 8, 6, 9]:
                if col_idx < len(row) and pd.notna(row[col_idx]) and isinstance(row[col_idx], (int, float)) and row[col_idx] > 0:
                    total_val = row[col_idx]
                    break
        elif is_code(val1):
            code = val1
            desc = val2
            for col_idx in [8, 9, 7, 10]:
                if col_idx < len(row) and pd.notna(row[col_idx]) and isinstance(row[col_idx], (int, float)) and row[col_idx] > 0:
                    total_val = row[col_idx]
                    break

        if code and desc:
            code_clean = code.replace('.0', '').replace('.', '').strip()
            is_chapter = code_clean.endswith('0000') or code_clean.endswith('00')
            if is_chapter:
                current_chapter = desc
            else:
                budget_items.append({
                    'code': code_clean,
                    'desc': desc,
                    'total': total_val or 0,
                    'chapter': current_chapter
                })

    # Let's perform simple matching
    def tokenize(s):
        s = s.lower()
        # Remove accents
        s = re.sub(r'[áäâà]', 'a', s)
        s = re.sub(r'[éëêè]', 'e', s)
        s = re.sub(r'[íïîì]', 'i', s)
        s = re.sub(r'[óöôò]', 'o', s)
        s = re.sub(r'[úüûù]', 'u', s)
        s = re.sub(r'[^a-z0-9\s]', '', s)
        return set(s.split())

    matched = 0
    for b in budget_items:
        b_tokens = tokenize(b['desc'])
        b_chapter_tokens = tokenize(b['chapter'])
        best_task = None
        best_score = 0
        
        for t in schedule_tasks:
            t_tokens = tokenize(t['name'])
            
            # Match tokens between description and task name
            desc_intersection = b_tokens.intersection(t_tokens)
            chapter_intersection = b_chapter_tokens.intersection(t_tokens)
            
            score = 0
            if desc_intersection:
                score += len(desc_intersection) * 2.0 / (len(b_tokens) + len(t_tokens))
            if chapter_intersection:
                score += len(chapter_intersection) * 0.5 / (len(b_chapter_tokens) + len(t_tokens))
                
            # If the chapter name matches exactly or closely, boost it
            if score > best_score:
                best_score = score
                best_task = t
        
        if best_task and best_score > 0.1:
            matched += 1
            print(f"MATCHED ({best_score:.2f}): '{b['desc']}' (Cap: {b['chapter']}) -> '{best_task['name']}' (Start: {best_task['start']})")
        else:
            print(f"UNMATCHED: '{b['desc']}' in chapter '{b['chapter']}'")

    print(f"\nMatched {matched} out of {len(budget_items)} ({matched/len(budget_items)*100:.1f}%)")

if __name__ == "__main__":
    test_matching()
