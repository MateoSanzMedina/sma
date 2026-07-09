import os
import shutil

src_folder = r"c:\Users\ssanz\OneDrive\Documentos\ChainPointAI\SERVING\gestion humana"
dest_folder = r"c:\Users\ssanz\OneDrive\Documentos\ChainPointAI\SERVING\SMA\backend\app\templates"

if not os.path.exists(dest_folder):
    os.makedirs(dest_folder)
    print(f"Created directory: {dest_folder}")

files_to_copy = [
    "PLANILLA INGRESOS ARUS.xlsx",
    "PLANILLA NOVEDADES ARUS.xlsx"
]

for file in files_to_copy:
    src_path = os.path.join(src_folder, file)
    dest_path = os.path.join(dest_folder, file)
    if os.path.exists(src_path):
        shutil.copy2(src_path, dest_path)
        print(f"Successfully copied {file} to backend templates.")
    else:
        print(f"Source file not found: {src_path}")
