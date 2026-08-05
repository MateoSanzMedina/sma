"""
MOTOR DE CADENA CONSTRUCTIVA Y PRERREQUISITOS TÉCNICOS (PYTHON)
Define las reglas explícitas de ingeniería para que los agentes y el motor semántico
asocien ítems de presupuesto que son prerrequisitos implícitos (Excavación, Solera, Base, Cordonería)
con sus tareas principales de instalación/construcción en el cronograma.
"""

CONSTRUCTIVE_PREREQUISITE_RULES = [
    {
        "id": "RULE_TUBERIAS_REDES",
        "name": "Redes Subterráneas (Tuberías Novafort, Acueducto, Gas)",
        "task_keywords": ["tuberia", "novafort", "alcantarillado", "acueducto", "gas", "pluvial", "residual"],
        "prerequisite_keywords": [
            {"keyword": "excavacion", "shift_days": 3, "type": "PRE_EXCAVACION"},
            {"keyword": "caja", "shift_days": 0, "type": "PRE_CAMASOLERA"},
            {"keyword": "camara", "shift_days": 0, "type": "PRE_CAMASOLERA"},
            {"keyword": "relleno", "shift_days": 0, "type": "POST_RELLENO"}
        ]
    },
    {
        "id": "RULE_PAVIMENTO_VIAS",
        "name": "Estructura de Vías y Pavimentación",
        "task_keywords": ["pavimento", "pavimentacion", "via", "calzada", "asfalto", "rodadura"],
        "prerequisite_keywords": [
            {"keyword": "cajeo", "shift_days": 10, "type": "PRE_EXCAVACION"},
            {"keyword": "geotextil", "shift_days": 5, "type": "PRE_BASE_GEOTEXTIL"},
            {"keyword": "base granular", "shift_days": 4, "type": "PRE_BASE_GEOTEXTIL"},
            {"keyword": "subbase", "shift_days": 6, "type": "PRE_BASE_GEOTEXTIL"},
            {"keyword": "cordoneria", "shift_days": 2, "type": "PRE_BASE_GEOTEXTIL"}
        ]
    },
    {
        "id": "RULE_ESTRUCTURAS_PORTERIA_EBAR",
        "name": "Edificaciones y Obras Estructurales (Portería, EBAR, Muros)",
        "task_keywords": ["porteria", "ebar", "estacion de bombeo", "cerramiento"],
        "prerequisite_keywords": [
            {"keyword": "excavacion", "shift_days": 7, "type": "PRE_EXCAVACION"},
            {"keyword": "concreto", "shift_days": 3, "type": "PRE_CIMENTACION"},
            {"keyword": "acero", "shift_days": 5, "type": "PRE_CIMENTACION"},
            {"keyword": "cubierta", "shift_days": 0, "type": "PRE_CIMENTACION"}
        ]
    }
]

def find_constructive_prerequisite(budgetItemDesc: str, taskName: str):
    import unicodedata, re
    def normalize(text):
        if not text: return ""
        clean = ''.join(c for c in unicodedata.normalize('NFD', str(text).lower()) if unicodedata.category(c) != 'Mn')
        return re.sub(r'[^a-z0-9\s]', ' ', clean)

    clean_item = normalize(budgetItemDesc)
    clean_task = normalize(taskName)

    for rule in CONSTRUCTIVE_PREREQUISITE_RULES:
        if any(kw in clean_task for kw in rule["task_keywords"]):
            for prereq in rule["prerequisite_keywords"]:
                if prereq["keyword"] in clean_item:
                    return {
                        "is_match": True,
                        "rule_id": rule["id"],
                        "shift_days": prereq["shift_days"],
                        "type": prereq["type"]
                    }
    return {"is_match": False, "rule_id": None, "shift_days": 0, "type": None}
