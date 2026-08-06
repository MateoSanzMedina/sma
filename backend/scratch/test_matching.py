import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.generator_service import classify_and_consolidate_files, extract_unique_employees
import pandas as pd

files_data = []
for name in ['INFORME HORAS EXTRAS.xlsx', 'INFORME INCAPACIDADES.xlsx', 'INFORME LICENCIAS.xlsx', 'INFORME VACACIONESxlsx.xlsx']:
    path = os.path.join('c:/Users/ssanz/OneDrive/Documentos/ChainPointAI/SERVING/Gestion Humana', name)
    with open(path, 'rb') as f:
        files_data.append((f.read(), name))

dfs = classify_and_consolidate_files(files_data)
employees = extract_unique_employees(dfs)
df_inc = dfs['incapacidades']
df_lic = dfs['licencias']
df_vac = dfs['vacaciones']

matches_inc, matches_lic, matches_vac = 0, 0, 0

for emp_id in employees.keys():
    emp_inc = df_inc[df_inc['IDENTIFICACION'].astype(str).str.split('.').str[0].str.strip() == emp_id]
    if not emp_inc.empty:
        matches_inc += 1
        print(f"Match INC for {emp_id}: {emp_inc.iloc[0].get('FECHA INICIAL')} -> {emp_inc.iloc[0].get('FECHA FINAL')}")

    emp_lic = df_lic[df_lic['IDENTIFICACION'].astype(str).str.split('.').str[0].str.strip() == emp_id]
    if not emp_lic.empty:
        matches_lic += 1
        print(f"Match LIC for {emp_id}: {emp_lic.iloc[0].get('FECHA INICIAL')} -> {emp_lic.iloc[0].get('FECHA FINAL')}")

    emp_vac = df_vac[df_vac['IDENTIFICACION'].astype(str).str.split('.').str[0].str.strip() == emp_id]
    if not emp_vac.empty:
        matches_vac += 1
        print(f"Match VAC for {emp_id}: {emp_vac.iloc[0].get('FECHA INICIAL')} -> {emp_vac.iloc[0].get('FECHA FINAL')}")

print(f"Total matches - Inc: {matches_inc}, Lic: {matches_lic}, Vac: {matches_vac}")
