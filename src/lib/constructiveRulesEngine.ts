/**
 * MOTOR DE REGLAS DE CADENA CONSTRUCTIVA Y PRERREQUISITOS DE OBRA
 *
 * Define la lógica de ingeniería civil para vincular ítems de presupuesto
 * que son prerrequisitos implícitos de tareas del cronograma, garantizando
 * la asignación cronológica exacta de fechas y presupuestos.
 */

export interface ConstructiveRule {
  id: string;
  name: string;
  chapterFilter: string[];
  taskKeywords: string[]; // Palabras clave en la tarea del cronograma (ej. "tubería novafort", "pavimentación")
  prerequisiteBudgetKeywords: {
    keyword: string;
    chapter?: string;
    daysShiftBeforeStart: number; // Días antes de que inicie la tarea principal (ej. 3 días antes para excavación)
    requiredType: "PRE_EXCAVACION" | "PRE_CAMASOLERA" | "PRE_BASE_GEOTEXTIL" | "PRE_CIMENTACION" | "POST_RELLENO";
  }[];
}

export const CONSTRUCTIVE_PREREQUISITE_RULES: ConstructiveRule[] = [
  {
    id: "RULE_TUBERIAS_REDES",
    name: "Redes Subterráneas (Tuberías Novafort, Acueducto, Gas)",
    chapterFilter: [
      "RED ALCANTARILLADO LLUVIAS",
      "RED ALCANTARILLADO RESIDUALES",
      "RED DE DISTRIBUCION DE ACUEDUCTO",
      "RED DE GAS",
      "EXCAVACIONES"
    ],
    taskKeywords: ["tuberia", "novafort", "alcantarillado", "acueducto", "gas", "pluvial", "residual"],
    prerequisiteBudgetKeywords: [
      {
        keyword: "excavacion",
        chapter: "EXCAVACIONES",
        daysShiftBeforeStart: 3, // Inicia 3 días antes de la colocación del tubo
        requiredType: "PRE_EXCAVACION"
      },
      {
        keyword: "caja",
        chapter: "RED ALCANTARILLADO LLUVIAS",
        daysShiftBeforeStart: 0,
        requiredType: "PRE_CAMASOLERA"
      },
      {
        keyword: "camara",
        chapter: "RED ALCANTARILLADO RESIDUALES",
        daysShiftBeforeStart: 0,
        requiredType: "PRE_CAMASOLERA"
      },
      {
        keyword: "relleno",
        chapter: "LLENOS",
        daysShiftBeforeStart: 0,
        requiredType: "POST_RELLENO"
      }
    ]
  },
  {
    id: "RULE_PAVIMENTO_VIAS",
    name: "Estructura de Vías y Pavimentación",
    chapterFilter: ["ESTRUCTURA", "URBANISMO - MOVIMIENTO DE TIERRA", "ANDENES", "CUNETAS"],
    taskKeywords: ["pavimento", "pavimentación", "vía", "calzada", "asfalto", "rodadura"],
    prerequisiteBudgetKeywords: [
      {
        keyword: "cajeo",
        chapter: "URBANISMO - MOVIMIENTO DE TIERRA",
        daysShiftBeforeStart: 10, // El cajeo inicia 10 días antes
        requiredType: "PRE_EXCAVACION"
      },
      {
        keyword: "geotextil",
        chapter: "ESTRUCTURA",
        daysShiftBeforeStart: 5,
        requiredType: "PRE_BASE_GEOTEXTIL"
      },
      {
        keyword: "base granular",
        chapter: "ESTRUCTURA",
        daysShiftBeforeStart: 4,
        requiredType: "PRE_BASE_GEOTEXTIL"
      },
      {
        keyword: "subbase",
        chapter: "ESTRUCTURA",
        daysShiftBeforeStart: 6,
        requiredType: "PRE_BASE_GEOTEXTIL"
      },
      {
        keyword: "cordoneria",
        chapter: "ESTRUCTURA",
        daysShiftBeforeStart: 2,
        requiredType: "PRE_BASE_GEOTEXTIL"
      }
    ]
  },
  {
    id: "RULE_ESTRUCTURAS_PORTERIA_EBAR",
    name: "Edificaciones y Obras Estructurales (Portería, EBAR, Muros)",
    chapterFilter: ["PORTERIA", "RED DE BOMBEO DE ALCANTARILLADO RESIDUALES", "CERRAMIENTOS PERIMETRALES GENERALES"],
    taskKeywords: ["porteria", "portería", "ebar", "estacion de bombeo", "estación de bombeo", "cerramiento"],
    prerequisiteBudgetKeywords: [
      {
        keyword: "excavacion",
        daysShiftBeforeStart: 7,
        requiredType: "PRE_EXCAVACION"
      },
      {
        keyword: "concreto",
        daysShiftBeforeStart: 3,
        requiredType: "PRE_CIMENTACION"
      },
      {
        keyword: "acero",
        daysShiftBeforeStart: 5,
        requiredType: "PRE_CIMENTACION"
      },
      {
        keyword: "cubierta",
        daysShiftBeforeStart: 0,
        requiredType: "PRE_CIMENTACION"
      }
    ]
  }
];

/**
 * Función para evaluar si un ítem de presupuesto huérfano es un prerrequisito
 * implícito de una tarea del cronograma basada en las reglas de cadena constructiva.
 */
export function matchPrerequisiteBudgetItem(
  budgetItemDesc: string,
  budgetItemChapter: string,
  taskName: string,
  _taskChapter: string
): { isMatch: boolean; ruleId?: string; daysShiftBeforeStart?: number; requiredType?: string } {
  void _taskChapter;
  const cleanItem = budgetItemDesc.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const cleanTask = taskName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  for (const rule of CONSTRUCTIVE_PREREQUISITE_RULES) {
    // Evaluar si la tarea del cronograma encaja en la regla
    const matchesTask = rule.taskKeywords.some(kw => cleanTask.includes(kw));

    if (matchesTask) {
      // Buscar si el ítem de presupuesto es un prerrequisito catalogado
      for (const prereq of rule.prerequisiteBudgetKeywords) {
        if (cleanItem.includes(prereq.keyword)) {
          return {
            isMatch: true,
            ruleId: rule.id,
            daysShiftBeforeStart: prereq.daysShiftBeforeStart,
            requiredType: prereq.requiredType
          };
        }
      }
    }
  }

  return { isMatch: false };
}
