/**
 * BASE DE CONOCIMIENTO TÉCNICO DE INGENIERÍA DE OBRA CIVIL Y URBANISMO (CONSTRUCTORA SERVING S.A.S.)
 *
 * Contiene la taxonomía completa, el glosario de términos de construcción colombiana,
 * y la matriz de prerrequisitos técnicos (DAG) para que los agentes y el motor
 * semántico asocien determinísticamente presupuestos y cronogramas.
 */

export interface ConstructionDomain {
  id: string;
  name: string;
  chapters: string[];
  description: string;
  keyKeywords: string[];
}

export interface PrerequisiteRuleDAG {
  ruleId: string;
  domainId: string;
  targetTaskKeywords: string[];
  prerequisites: {
    budgetKeyword: string;
    chapterAffinity?: string;
    daysShiftBeforeStart: number; // Offset en días antes del inicio de la tarea principal
    role: "EXCAVACION_PREVIA" | "SOLERA_CAMASOLERA" | "BASE_GEOTEXTIL" | "CIMENTACION_ESTRUCTURAL" | "DUCTADO_SUBTERRANEO" | "POST_PRUEBA_RELLENO";
    description: string;
  }[];
}

// 1. TAXONOMÍA DE DOMINIOS TÉCNICOS
export const TECHNICAL_CONSTRUCTION_DOMAINS: ConstructionDomain[] = [
  {
    id: "DOM_PRELIMINARES",
    name: "1. PRELIMINARES Y ADECUACIÓN DEL TERRENO",
    chapters: ["ADECUACION LOTE", "INSTALACIONES PROVISIONALES", "REDES PROVISIONALES"],
    description: "Trabajos iniciales de localización topográfica, descapote, tala de árboles, cerramientos y campamentos.",
    keyKeywords: ["localizacion", "replanteo", "descapote", "tala", "raices", "campamento", "cerramiento", "sarancito", "zing"]
  },
  {
    id: "DOM_MOVIMIENTO_TIERRAS",
    name: "2. MOVIMIENTO DE TIERRAS Y EXCAVACIONES",
    chapters: ["EXCAVACIONES", "LLENOS", "URBANISMO - MOVIMIENTO DE TIERRA", "MOVIMIENTO DE TIERRA DE LOTES 33,34,45"],
    description: "Corte, cajeo de vías, perfilación de subrasante, excavación de zanjas y retiros a botadero.",
    keyKeywords: ["cajeo", "excavacion", "zanja", "corte", "relleno", "afirmado", "terraplen", "subrasante", "escombros"]
  },
  {
    id: "DOM_REDES_SANIDARIAS",
    name: "3. REDES SUBTERRÁNEAS (Alcantarillado Pluvial, Residuales, Acueducto, Gas)",
    chapters: [
      "RED ALCANTARILLADO LLUVIAS",
      "RED ALCANTARILLADO RESIDUALES",
      "RED DE BOMBEO DE ALCANTARILLADO RESIDUALES",
      "RED DE DISTRIBUCION DE ACUEDUCTO",
      "RED DE GAS",
      "FILTROS",
      "CUNETAS"
    ],
    description: "Tuberías Novafort, cámaras de inspección/pozos, sumideros, EBAR, red de agua potable y red de gas.",
    keyKeywords: ["novafort", "tuberia", "alcantarillado", "acueducto", "gas", "camara", "pozo", "sumidero", "ebar", "valvula", "polivalvula"]
  },
  {
    id: "DOM_VIAS_PAVIMENTOS",
    name: "4. ESTRUCTURA DE PAVIMENTO Y VÍAS",
    chapters: ["ESTRUCTURA", "ANDENES", "VARIOS URBANISMO  - VIA"],
    description: "Geotextil, subbase, base granular, cordonería/sardineles y carpeta de pavimento.",
    keyKeywords: ["pavimento", "pavimentacion", "asfalto", "geotextil", "base granular", "subbase", "sardinel", "cordoneria", "anden"]
  },
  {
    id: "DOM_ESTRUCTURAS_EDIFICACIONES",
    name: "5. ESTRUCTURAS, PORTERÍA Y CERRAMIENTOS",
    chapters: ["PORTERIA", "CERRAMIENTOS PERIMETRALES GENERALES", "ZONAS DE BIENESTAR GENERALES", "OBRAS COMPLEMENTARIAS"],
    description: "Construcción de portería, muros, zapatas, losas, cubiertas metálicas y cerramientos perimetrales.",
    keyKeywords: ["porteria", "cerramiento", "tubular", "concreto", "acero", "zapata", "columna", "viga", "cubierta", "puerta"]
  },
  {
    id: "DOM_REDES_ELECTRICAS",
    name: "6. REDES ELÉCTRICAS, ILUMINACIÓN Y TELECOMUNICACIONES",
    chapters: [
      "RED ELECTRICA OBRA CIVIL",
      "RED ELECTRICA",
      "RED DE ILUMINACION  OBRA CIVIL",
      "RED DE ILUMINACION ELECTRICOS",
      "RED DE TELECOMUNICACIONES"
    ],
    description: "Ductado subterráneo, cajas RS3, transformadores pedestal (37.5-75 kVA), luminarias LED solares, RETIE/RETILAP.",
    keyKeywords: ["electrica", "transformador", "luminaria", "retie", "retilap", "rs3", "telecomunicaciones", "pedestal", "totem", "cableado"]
  }
];

// 2. DICCIONARIO DE SINÓNIMOS DE CONSTRUCCIÓN COLOMBIANA
export const CONSTRUCTION_SYNONYMS: { [key: string]: string[] } = {
  tuberia: ["tubo", "novafort", "pvc", "conduit", "ducto", "red", "hidraulica", "sanitaria"],
  cajeo: ["excavacion via", "corte subrasante", "perfilacion via", "descapote via"],
  sardinel: ["cordoneria", "bordillo", "confinamiento", "vaciado anden"],
  camara: ["pozo manhole", "caja inspeccion", "camara alcantarillado", "resane externo"],
  solera: ["concreto pobre", "concreto limpieza", "losa apoyo", "cama asentamiento"],
  geotextil: ["geotextil vial", "malla separadora", "sub-base textil"],
  transformador: ["transfo", "pedestal electrico", "estacion transformadora", "75 kva", "50 kva", "37.5 kva"],
  luminaria: ["alumbrado publico", "led solar", "reflector", "retilap"],
  ebar: ["estacion de bombeo", "bombeo residuales", "pozo de succion"]
};

// 3. MATRIZ DE PRERREQUISITOS TÉCNICOS DE OBRA (DAG)
export const PREREQUISITE_RULES_DAG: PrerequisiteRuleDAG[] = [
  {
    ruleId: "DAG_REDES_SUBTERRANEAS",
    domainId: "DOM_REDES_SANIDARIAS",
    targetTaskKeywords: ["tuberia", "novafort", "alcantarillado", "acueducto", "gas", "pluvial", "residual"],
    prerequisites: [
      {
        budgetKeyword: "excavacion",
        chapterAffinity: "EXCAVACIONES",
        daysShiftBeforeStart: 3,
        role: "EXCAVACION_PREVIA",
        description: "Excavación de zanja a cota de clave antes de instalar tubería."
      },
      {
        budgetKeyword: "cama",
        chapterAffinity: "RED ALCANTARILLADO LLUVIAS",
        daysShiftBeforeStart: 1,
        role: "SOLERA_CAMASOLERA",
        description: "Cama de apoyo en arena / atracado granular para asentamiento del tubo."
      },
      {
        budgetKeyword: "camara",
        chapterAffinity: "RED ALCANTARILLADO RESIDUALES",
        daysShiftBeforeStart: 0,
        role: "SOLERA_CAMASOLERA",
        description: "Solera de concreto y cámaras de inspección en manholes."
      },
      {
        budgetKeyword: "relleno",
        chapterAffinity: "LLENOS",
        daysShiftBeforeStart: 0,
        role: "POST_PRUEBA_RELLENO",
        description: "Relleno y compactación de zanja previa prueba hidrostática."
      }
    ]
  },
  {
    ruleId: "DAG_VIAS_PAVIMENTACION",
    domainId: "DOM_VIAS_PAVIMENTOS",
    targetTaskKeywords: ["pavimento", "pavimentacion", "via", "calzada", "asfalto", "rodadura"],
    prerequisites: [
      {
        budgetKeyword: "cajeo",
        chapterAffinity: "URBANISMO - MOVIMIENTO DE TIERRA",
        daysShiftBeforeStart: 10,
        role: "EXCAVACION_PREVIA",
        description: "Cajeo y perfilación de subrasante de vía."
      },
      {
        budgetKeyword: "geotextil",
        chapterAffinity: "ESTRUCTURA",
        daysShiftBeforeStart: 5,
        role: "BASE_GEOTEXTIL",
        description: "Tendido de geotextil de separación sobre subrasante."
      },
      {
        budgetKeyword: "base granular",
        chapterAffinity: "ESTRUCTURA",
        daysShiftBeforeStart: 4,
        role: "BASE_GEOTEXTIL",
        description: "Subbase y base granular compactada a densidad Proctór."
      },
      {
        budgetKeyword: "cordoneria",
        chapterAffinity: "ESTRUCTURA",
        daysShiftBeforeStart: 2,
        role: "BASE_GEOTEXTIL",
        description: "Instalación de cordonería / sardineles como bordes de confinamiento."
      }
    ]
  },
  {
    ruleId: "DAG_ESTRUCTURAS_PORTERIA",
    domainId: "DOM_ESTRUCTURAS_EDIFICACIONES",
    targetTaskKeywords: ["porteria", "ebar", "estacion de bombeo", "cerramiento"],
    prerequisites: [
      {
        budgetKeyword: "excavacion",
        daysShiftBeforeStart: 7,
        role: "EXCAVACION_PREVIA",
        description: "Excavación estructural para zapatas y cimentación."
      },
      {
        budgetKeyword: "concreto",
        daysShiftBeforeStart: 3,
        role: "CIMENTACION_ESTRUCTURAL",
        description: "Vaciado de solera de limpieza y concreto estructural."
      },
      {
        budgetKeyword: "acero",
        daysShiftBeforeStart: 5,
        role: "CIMENTACION_ESTRUCTURAL",
        description: "Figurado y amarrado de acero de refuerzo."
      }
    ]
  },
  {
    ruleId: "DAG_REDES_ELECTRICAS_CIVIL",
    domainId: "DOM_REDES_ELECTRICAS",
    targetTaskKeywords: ["electrica", "transformador", "luminaria", "telecomunicaciones"],
    prerequisites: [
      {
        budgetKeyword: "canalizada",
        chapterAffinity: "RED ELECTRICA OBRA CIVIL",
        daysShiftBeforeStart: 4,
        role: "DUCTADO_SUBTERRANEO",
        description: "Ductado conduit subterráneo instalado previo a pavimentos."
      },
      {
        budgetKeyword: "caja",
        chapterAffinity: "RED ELECTRICA OBRA CIVIL",
        daysShiftBeforeStart: 2,
        role: "DUCTADO_SUBTERRANEO",
        description: "Vaciado de cajas RS3-003 / RS3-005 para halado de cables."
      }
    ]
  }
];

/**
 * Función para expandir cualquier palabra clave con su diccionario de sinónimos
 */
export function getExpandedKeywords(keyword: string): string[] {
  const clean = keyword.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const baseList = [clean];
  if (CONSTRUCTION_SYNONYMS[clean]) {
    baseList.push(...CONSTRUCTION_SYNONYMS[clean]);
  }
  return baseList;
}

/**
 * Evalúa si un ítem de presupuesto es un prerrequisito técnico implícito de una tarea del cronograma
 */
export function checkImplicitPrerequisite(
  budgetItemDesc: string,
  budgetItemChapter: string,
  taskName: string
): { isPrerequisite: boolean; daysShift: number; role?: string; ruleId?: string; description?: string } {
  const cleanItem = budgetItemDesc.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const cleanTask = taskName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  for (const rule of PREREQUISITE_RULES_DAG) {
    const taskMatch = rule.targetTaskKeywords.some(kw => {
      const expanded = getExpandedKeywords(kw);
      return expanded.some(expKw => cleanTask.includes(expKw));
    });

    if (taskMatch) {
      for (const prereq of rule.prerequisites) {
        const itemMatch = cleanItem.includes(prereq.budgetKeyword);
        if (itemMatch) {
          return {
            isPrerequisite: true,
            daysShift: prereq.daysShiftBeforeStart,
            role: prereq.role,
            ruleId: rule.ruleId,
            description: prereq.description
          };
        }
      }
    }
  }

  return { isPrerequisite: false, daysShift: 0 };
}
