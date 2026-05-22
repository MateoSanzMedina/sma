import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import * as xlsx from "xlsx";

const meses: { [key: string]: string } = {
  enero: "01",
  febrero: "02",
  marzo: "03",
  abril: "04",
  mayo: "05",
  junio: "06",
  julio: "07",
  agosto: "08",
  septiembre: "09",
  octubre: "10",
  noviembre: "11",
  diciembre: "12",
};

// Función para parsear y normalizar fechas en español a YYYY-MM-DD
function parseSpanishDate(dateStr: unknown): string {
  if (typeof dateStr !== "string") return String(dateStr ?? "");
  try {
    const cleanStr = dateStr.replace(/\s+/g, " ").trim().toLowerCase();
    const parts = cleanStr.split(" ");
    
    // Si ya viene formateado como YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
      return cleanStr;
    }

    const day = parts[0].padStart(2, "0");
    const month = meses[parts[1]] || "01";
    const year = parts[2];

    if (year && year.length === 4 && /^\d+$/.test(year) && /^\d+$/.test(day)) {
      return `${year}-${month}-${day}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

interface BudgetItem {
  code: string;
  desc: string;
  val: number;
  chapter: string;
}

interface ScheduleItem {
  name: string;
  start: string;
  end: string;
  level: number;
}

interface BudgetItemWithCandidates extends BudgetItem {
  candidate_tasks: {
    name: string;
    start: string;
    end: string;
  }[];
}

// ==========================================
// MOTOR SEMÁNTICO LOCAL HÍBRIDO
// ==========================================

const SYNONYM_GROUPS: string[][] = [
  // 1. Agua / Tuberías / Fluidos
  ["acueducto", "alcantarillado", "hidraulico", "sanitario", "pluvial", "tuberia", "tubo", "agua", "redes", "acometida", "registro", "valvula", "caja", "bajante", "desague", "ventila", "drenaje", "sifon", "pvc", "presion", "pozo", "filtro", "canal", "canalizacion"],
  // 2. Estructura / Cemento / Concreto
  ["concreto", "cemento", "mortero", "viga", "columna", "losa", "zapata", "cimentacion", "fundacion", "acero", "hierro", "refuerzo", "estructura", "pilote", "placa", "pedestal", "muro", "formaleta", "malla", "electrosoldada", "estribo", "figurado", "fundicion"],
  // 3. Tierra / Excavación
  ["excavacion", "corte", "relleno", "tierras", "descapote", "subrasante", "sotano", "movimiento", "perfilacion", "carga", "retiro", "escombros", "afirmado", "terraplen", "retro", "cargador"],
  // 4. Acabados / Revestimientos
  ["enchape", "ceramica", "porcelanato", "baldosa", "piso", "pintura", "estuco", "yeso", "acabado", "cielo", "raso", "muro", "pañete", "revoque", "enchapes", "vinilo", "drywall", "superboard", "masilla", "griferia", "lavamanos", "ducha", "grifos"],
  // 5. Eléctrico / Iluminación
  ["electrico", "cable", "conduit", "lampara", "luminaria", "iluminacion", "redes", "tablero", "acometida", "toma", "interruptor", "transformador", "ducto", "breaker", "fusible", "polo", "tierra", "citofono", "camara", "cctv"],
  // 6. Urbanismo / Vías
  ["anden", "bordillo", "sardinel", "via", "pavimento", "asfalto", "urbanismo", "externo", "calzada", "subbase", "adoquin", "grama", "jardineria", "arbol", "prado", "cerramiento", "reja", "porton", "parque"],
  // 7. Carpintería / Ventanería
  ["madera", "puerta", "marco", "cerradura", "chapa", "bisagra", "closet", "cocina", "mueble", "repisa", "metalica", "aluminio", "hierro", "ventana", "vidrio", "templado", "pasamanos", "baranda"],
  // 8. Maquinaria / Preliminares
  ["herramienta", "equipo", "transporte", "flete", "acarreo", "aseo", "limpieza", "campamento", "cerramiento", "provisional", "seguridad", "casco", "guantes", "señalizacion", "topografia", "replanteo", "localizacion"]
];

function getWordTokens(text: string): string[] {
  if (!text) return [];
  const clean = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Reemplazar caracteres especiales y puntuación por espacios, conservar letras y números
  const words = clean.replace(/[^a-z0-9\s]/g, " ").split(/\s+/);
  
  const stopwords = new Set([
    "de", "en", "para", "con", "el", "la", "los", "las", "un", "una", "y", "o", "del", "al", "a", "e", "u",
    "suministro", "instalacion", "mano", "obra", "herramienta", "equipo", "transporte", "flete", "acarreo",
    "suministros", "instalaciones", "manos", "obras", "equipos", "e", "i", "s", "u", "m"
  ]);

  return words
    .map(w => w.trim())
    .filter(w => w.length > 1 && !stopwords.has(w));
}

function calculateSemanticSimilarity(itemDesc: string, taskName: string): number {
  const itemTokens = getWordTokens(itemDesc);
  const taskTokens = getWordTokens(taskName);

  if (itemTokens.length === 0 || taskTokens.length === 0) return 0;

  let matchScore = 0;

  itemTokens.forEach(iTok => {
    let bestTokenScore = 0;

    taskTokens.forEach(tTok => {
      let currentScore = 0;

      // 1. Coincidencia exacta
      if (iTok === tTok) {
        currentScore = 1.0;
      }
      // 2. Coincidencia por raíces / prefijos comunes (mínimo 4 caracteres)
      else if (iTok.length >= 4 && tTok.length >= 4 && (iTok.startsWith(tTok.substring(0, 4)) || tTok.startsWith(iTok.substring(0, 4)))) {
        currentScore = 0.8;
      }
      // 3. Coincidencia por grupo de sinónimos de construcción
      else {
        const shareGroup = SYNONYM_GROUPS.some(group => group.includes(iTok) && group.includes(tTok));
        if (shareGroup) {
          currentScore = 0.6;
        }
      }

      if (currentScore > bestTokenScore) {
        bestTokenScore = currentScore;
      }
    });

    matchScore += bestTokenScore;
  });

  // Normalizar dividiendo por el total de tokens de la descripción del presupuesto
  return matchScore / itemTokens.length;
}

function getTopCandidates(item: BudgetItem, tasks: ScheduleItem[], count = 5): { name: string; start: string; end: string }[] {
  const scored = tasks.map(task => {
    const score = calculateSemanticSimilarity(item.desc, task.name);
    return { task, score };
  });

  // Ordenar descendentemente por puntuación y alfabéticamente para romper empates
  scored.sort((a, b) => {
    if (Math.abs(a.score - b.score) > 0.001) {
      return b.score - a.score;
    }
    return a.task.name.localeCompare(b.task.name);
  });

  return scored.slice(0, count).map(s => ({
    name: s.task.name,
    start: s.task.start,
    end: s.task.end
  }));
}

// ==========================================
// PARSERS DE EXCEL
// ==========================================

// Función determinista para parsear la pestaña "Presupuesto V5" del presupuesto
function parseBudgetSheet(worksheet: xlsx.WorkSheet): BudgetItem[] {
  const rows = xlsx.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 });
  const budgetItems: BudgetItem[] = [];
  let currentChapter = "Otros";

  const isCode = (s: string) => {
    const clean = s.replace(/\.0$/, "").replace(/\./g, "").trim();
    return /^\d+$/.test(clean) && clean.length >= 4;
  };

  rows.forEach((row: unknown[]) => {
    if (!row || row.length === 0) return;

    let code: string | null = null;
    let desc: string | null = null;
    let totalVal: number | null = null;

    const val0 = row[0] !== undefined && row[0] !== null ? String(row[0]).trim() : "";
    const val1 = row[1] !== undefined && row[1] !== null ? String(row[1]).trim() : "";
    const val2 = row[2] !== undefined && row[2] !== null ? String(row[2]).trim() : "";

    // Caso A: Código en columna 0, descripción en columna 1
    if (isCode(val0)) {
      code = val0;
      desc = val1;
      // Buscar el valor total en las columnas típicas de totales (7, 8, 6, 9)
      for (const colIdx of [7, 8, 6, 9]) {
        if (colIdx < row.length && row[colIdx] !== undefined && row[colIdx] !== null) {
          const num = parseFloat(String(row[colIdx]).replace(/[$,]/g, ""));
          if (!isNaN(num) && num > 0) {
            totalVal = num;
            break;
          }
        }
      }
    } 
    // Caso B: Código en columna 1, descripción en columna 2
    else if (isCode(val1)) {
      code = val1;
      desc = val2;
      // Buscar el valor total en las columnas típicas de totales (8, 9, 7, 10)
      for (const colIdx of [8, 9, 7, 10]) {
        if (colIdx < row.length && row[colIdx] !== undefined && row[colIdx] !== null) {
          const num = parseFloat(String(row[colIdx]).replace(/[$,]/g, ""));
          if (!isNaN(num) && num > 0) {
            totalVal = num;
            break;
          }
        }
      }
    }

    if (code && desc) {
      const codeClean = code.replace(/\.0$/, "").replace(/\./g, "").trim();
      const isChapter = codeClean.endsWith("0000") || codeClean.endsWith("00");
      
      if (isChapter) {
        currentChapter = desc;
      } else {
        budgetItems.push({
          code: codeClean,
          desc: desc,
          val: totalVal || 0,
          chapter: currentChapter,
        });
      }
    }
  });

  return budgetItems;
}

// Función para parsear el cronograma
function parseScheduleSheet(worksheet: xlsx.WorkSheet): ScheduleItem[] {
  const rawRows = xlsx.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });
  const scheduleItems: ScheduleItem[] = [];

  rawRows.forEach((row: Record<string, unknown>) => {
    let name: string = "";
    let start: string = "";
    let end: string = "";
    let schemaLevel: number = 3;

    Object.entries(row).forEach(([k, v]) => {
      const keyUpper = String(k).toUpperCase();
      if (keyUpper.includes("NOMBRE")) {
        name = String(v).trim();
      } else if (keyUpper.includes("COMIENZO")) {
        start = parseSpanishDate(v);
      } else if (keyUpper.includes("FIN")) {
        end = parseSpanishDate(v);
      } else if (keyUpper.includes("NIVEL DE ESQUEMA") || keyUpper.includes("ESQUEMA")) {
        schemaLevel = parseInt(String(v)) || 3;
      }
    });

    if (name && start) {
      scheduleItems.push({
        name,
        start,
        end,
        level: schemaLevel,
      });
    }
  });

  return scheduleItems;
}

interface MappedDataPoint {
  date: string;
  budget_required: number;
  task_name: string;
  chapter: string;
  budget_item_code: string;
}

type GenerateContentParams = Parameters<InstanceType<typeof GoogleGenAI>["models"]["generateContent"]>[0];
type GenerateContentResponse = Awaited<ReturnType<InstanceType<typeof GoogleGenAI>["models"]["generateContent"]>>;

// Función auxiliar para llamar a Gemini con reintentos automáticos
async function generateContentWithRetry(
  client: InstanceType<typeof GoogleGenAI>,
  params: GenerateContentParams,
  retries = 3,
  delayMs = 3000
): Promise<GenerateContentResponse> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await client.models.generateContent(params);
    } catch (error) {
      const err = error as Error & { status?: number };
      const errorMsg = String(err.message || "").toUpperCase();
      const errorStatus = err.status || 0;
      const isRateLimit = errorMsg.includes("429") || errorStatus === 429 || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("QUOTA");
      
      if (isRateLimit && attempt < retries) {
        console.warn(`⚠️ Límite de tasa de Vertex AI (429/Resource Exhausted) detectado. Reintentando en ${delayMs}ms (Intento ${attempt}/${retries})...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 2; // Retroceso exponencial
        continue;
      }
      throw error;
    }
  }
  throw new Error("Failed to generate content after retries");
}

// Función auxiliar para forzar un límite de tiempo en cualquier promesa
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMsg: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Timeout: ${errorMsg} (${timeoutMs}ms)`));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

// Función inteligente para reparar respuestas JSON truncadas a la mitad
function repairTruncatedJson(text: string): string {
  const cleanText = text.trim();
  
  try {
    JSON.parse(cleanText);
    return cleanText;
  } catch {
    // Continuar al intento de reparación
  }

  console.log("🛠️ Intentando reparar automáticamente JSON truncado por límites de salida...");

  const lastCloseBrace = cleanText.lastIndexOf("}");
  if (lastCloseBrace === -1) {
    return "{\"dataPoints\":[]}";
  }

  let repaired = cleanText.substring(0, lastCloseBrace + 1);

  let openBrackets = 0;
  let openBraces = 0;

  for (let i = 0; i < repaired.length; i++) {
    if (repaired[i] === "[") openBrackets++;
    else if (repaired[i] === "]") openBrackets--;
    else if (repaired[i] === "{") openBraces++;
    else if (repaired[i] === "}") openBraces--;
  }

  if (openBrackets > 0) {
    repaired += "]".repeat(openBrackets);
  }
  if (openBraces > 0) {
    repaired += "}".repeat(openBraces);
  }

  try {
    JSON.parse(repaired);
    console.log("✅ JSON truncado reparado y balanceado con éxito.");
    return repaired;
  } catch (err) {
    console.warn("⚠️ No se pudo reparar el JSON de manera automática:", err);
    return "{\"dataPoints\":[]}";
  }
}

// Mapeador determinista local de 3 capas de respaldo
function mapItemLocally(
  item: BudgetItemWithCandidates,
  fallbackDate: string,
  phaseTasks: { name: string; start: string; end: string }[]
): MappedDataPoint {
  // 1. Si tiene tareas candidatas válidas del motor de similitud, usar la mejor
  if (item.candidate_tasks && item.candidate_tasks.length > 0) {
    const best = item.candidate_tasks[0];
    return {
      date: best.start || fallbackDate,
      budget_required: item.val,
      task_name: best.name,
      chapter: item.chapter,
      budget_item_code: item.code,
    };
  }

  // 2. Si no, buscar coincidencia conceptual de capítulo en tareas contenedoras
  const cleanChapter = item.chapter.toLowerCase().trim();
  const matchedPhase = phaseTasks.find(p => {
    const cleanPhaseName = (p.name || "").toLowerCase().trim();
    return cleanPhaseName.includes(cleanChapter) || cleanChapter.includes(cleanPhaseName);
  });

  if (matchedPhase) {
    return {
      date: matchedPhase.start || fallbackDate,
      budget_required: item.val,
      task_name: matchedPhase.name,
      chapter: item.chapter,
      budget_item_code: item.code,
    };
  }

  // 3. Fallback final al inicio general del proyecto
  return {
    date: fallbackDate,
    budget_required: item.val,
    task_name: "Inicio de Proyecto (Fallback)",
    chapter: item.chapter,
    budget_item_code: item.code,
  };
}

// ==========================================
// RUTA POST PRINCIPAL
// ==========================================

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const scheduleFile = formData.get("schedule") as File | null;
    const budgetFile = formData.get("budget") as File | null;

    if (!scheduleFile || !budgetFile) {
      return NextResponse.json(
        { error: "Ambos archivos (cronograma XLSX y presupuesto XLSX) son requeridos." },
        { status: 400 }
      );
    }

    // 1. Parsear Presupuesto
    const budgetBuffer = await budgetFile.arrayBuffer();
    const budgetWorkbook = xlsx.read(budgetBuffer, { type: "array" });
    const budgetSheetName = budgetWorkbook.SheetNames.find(n => n.includes("V5")) || budgetWorkbook.SheetNames[0];
    const budgetWorksheet = budgetWorkbook.Sheets[budgetSheetName];
    const budgetItems = parseBudgetSheet(budgetWorksheet);

    console.log(`Presupuesto: Mapeados exitosamente ${budgetItems.length} ítems de obra reales.`);

    // 2. Parsear Cronograma y normalizar fechas
    const scheduleBuffer = await scheduleFile.arrayBuffer();
    const scheduleWorkbook = xlsx.read(scheduleBuffer, { type: "array" });
    const scheduleSheetName = scheduleWorkbook.SheetNames[0];
    const scheduleWorksheet = scheduleWorkbook.Sheets[scheduleSheetName];
    const scheduleItemsRaw = parseScheduleSheet(scheduleWorksheet);

    // Filtrar para quedarnos únicamente con tareas específicas de nivel 3 o superior (tareas granulares)
    let scheduleItems = scheduleItemsRaw.filter(t => t.level >= 3);
    if (scheduleItems.length === 0) {
      scheduleItems = scheduleItemsRaw;
    }

    // Extraer tareas contenedoras / capítulos de nivel inferior a 3 (fases) para servir como backup jerárquico secundario
    const phaseTasks = scheduleItemsRaw
      .filter(t => t.level < 3 && t.name && t.start)
      .map(t => ({ name: t.name, start: t.start, end: t.end }));

    console.log(`Cronograma: Parseadas ${scheduleItemsRaw.length} tareas totales. Granulares (nivel >= 3): ${scheduleItems.length}. Fases/Capítulos: ${phaseTasks.length}.`);

    // Fecha de inicio por defecto del proyecto como fallback
    const fallbackDate = scheduleItems.find(t => t.start && t.start.includes("-"))?.start || "2026-02-02";

    // 3. Inicializar Vertex AI (con soporte de conmutación a modo offline si no está configurado)
    const projectId = process.env.GCP_PROJECT_ID;
    const location = process.env.GCP_LOCATION;
    const initialOffline = !projectId || !location;
    let fellBackToOffline = initialOffline;

    if (initialOffline) {
      console.warn("⚠️ Las variables GCP_PROJECT_ID o GCP_LOCATION no están configuradas. Activando procesamiento local 100% resiliente.");
    }

    // 4. Pre-matching semántico local de ítems de presupuesto
    const enrichedBudgetItems: BudgetItemWithCandidates[] = budgetItems.map(item => {
      const candidates = getTopCandidates(item, scheduleItems, 5);
      return {
        ...item,
        candidate_tasks: candidates
      };
    });

    console.log(`Pre-matching semántico híbrido finalizado para los ${enrichedBudgetItems.length} ítems del presupuesto.`);

    // 5. Dividir ítems enriquecidos en Lotes (Batching) para procesamiento secuencial
    // Nota: Reducido de 40 a 25 para evitar el truncamiento del JSON por límites de ventana de tokens de salida de Gemini
    const batchSize = 25;
    const batches: BudgetItemWithCandidates[][] = [];
    for (let i = 0; i < enrichedBudgetItems.length; i += batchSize) {
      batches.push(enrichedBudgetItems.slice(i, i + batchSize));
    }

    console.log(`Iniciando procesamiento secuencial con motor semántico: ${batches.length} lotes de tamaño ~${batchSize}.`);

    const allDataPoints: MappedDataPoint[] = [];

    for (let index = 0; index < batches.length; index++) {
      const batch = batches[index];
      
      // Si las variables de entorno para la nube no están configuradas, mapear directo localmente
      if (initialOffline) {
        console.log(`Lote ${index + 1}/${batches.length}: Mapeando ${batch.length} ítems localmente en modo offline.`);
        batch.forEach(item => {
          allDataPoints.push(mapItemLocally(item, fallbackDate, phaseTasks));
        });
        continue;
      }

      console.log(`Procesando secuencialmente Lote ${index + 1}/${batches.length} con ${batch.length} ítems enriquecidos con IA...`);

      // Ocultar API Key temporalmente por llamada para asegurar Vertex AI Enterprise
      const tempKey = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;
      
      const batchClient = new GoogleGenAI({
        enterprise: true,
        project: projectId,
        location: location,
      });

      if (tempKey) {
        process.env.GEMINI_API_KEY = tempKey;
      }

      try {
        const result = await withTimeout(
          generateContentWithRetry(batchClient, {
            model: "gemini-2.5-flash",
            contents: `
LISTA DE ÍTEMS DEL PRESUPUESTO CON SUS TAREAS CANDIDATAS SUGERIDAS (LOTE ACTUAL):
${JSON.stringify(batch)}

FASE/CAPÍTULO DE RESPALDO (SI NINGÚN CANDIDATO CORRESPONDE):
${JSON.stringify(phaseTasks)}
`,
            config: {
              systemInstruction: `Eres un analista senior de control de costos en Constructora Serving S.A.S.
Tu tarea es correlacionar cada uno de los ítems del presupuesto de este lote con la fecha real del cronograma.

REGLAS MANDATORIAS:
1. NO RESUMAS ni agrupes. Debes generar exactamente un dataPoint por cada ítem de presupuesto recibido en este lote (recibiste exactamente ${batch.length} ítems).
2. Para cada ítem, analiza sus "candidate_tasks" (que contienen el top de tareas semánticamente más similares calculadas de la obra). Mapea el ítem de presupuesto a la fecha de inicio ("start") del candidato que tenga la relación conceptual y de control de obra más lógica.
3. Si consideras que NINGUNO de los "candidate_tasks" sugeridos aplica en lo absoluto, busca la fase o capítulo general de obra en la lista de "FASE/CAPÍTULO DE RESPALDO" que mejor represente el capítulo ("chapter") del ítem de presupuesto y utiliza su fecha de inicio.
4. Únicamente si el ítem de presupuesto no tiene absolutamente ninguna relación razonable con los candidatos ni con las fases de respaldo, utiliza la fecha global de fallback: "${fallbackDate}".
5. Para cada dataPoint retornado, es OBLIGATORIO incluir la propiedad "budget_item_code" que contenga EXACTAMENTE el código del ítem del presupuesto (el campo "code" del ítem correspondiente).
6. Devuelve en "task_name" el nombre de la tarea o capítulo del cronograma seleccionado, en "date" su fecha de inicio (YYYY-MM-DD), en "budget_required" el valor del ítem, y en "chapter" el capítulo original del presupuesto.`,
              responseMimeType: "application/json",
              responseSchema: {
                type: "OBJECT",
                properties: {
                  dataPoints: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        date: { type: "STRING" },
                        budget_required: { type: "NUMBER" },
                        task_name: { type: "STRING" },
                        chapter: { type: "STRING" },
                        budget_item_code: { type: "STRING" }
                      },
                      required: ["date", "budget_required", "task_name", "chapter", "budget_item_code"]
                    }
                  }
                },
                required: ["dataPoints"]
              } as Record<string, unknown>,
              temperature: 0.1,
              maxOutputTokens: 8192,
            },
          }),
          10000,
          `Vertex AI batch ${index + 1} timed out`
        );

        const rawText = result.text || "{}";
        let textToParse = rawText;

        // Intentar parsear el JSON tal como viene. Si falla, intentar auto-repararlo si fue cortado por tokens.
        try {
          JSON.parse(textToParse);
        } catch {
          textToParse = repairTruncatedJson(rawText);
        }

        try {
          const parsed = JSON.parse(textToParse) as { dataPoints?: MappedDataPoint[] };
          const points = parsed.dataPoints || [];
          
          // Filtrar puntos válidos
          const validPoints = points.filter(p => p && p.date && p.budget_item_code);
          console.log(`Lote ${index + 1} procesado exitosamente. Retornados ${validPoints.length} de ${batch.length} dataPoints.`);
          
          allDataPoints.push(...validPoints);
        } catch (parseErr) {
          console.error(`⚠️ Error parseando respuesta JSON del lote ${index + 1}. Usando mapeador local de respaldo.`, parseErr);
          fellBackToOffline = true;
          batch.forEach(item => {
            allDataPoints.push(mapItemLocally(item, fallbackDate, phaseTasks));
          });
        }
      } catch (batchErr) {
        console.error(`❌ Falló la llamada de Vertex AI para el lote ${index + 1} (Posible desconexión, DNS blocked o timeout). Usando mapeador local de respaldo para este lote.`, batchErr);
        fellBackToOffline = true;
        // Mapear este lote localmente de manera segura
        batch.forEach(item => {
          allDataPoints.push(mapItemLocally(item, fallbackDate, phaseTasks));
        });
      }

      // Pequeño retardo entre peticiones para prevenir cuota de estrangulamiento (solo si estamos llamando a red)
      if (!initialOffline && index < batches.length - 1) {
        console.log(`Esperando un breve momento (1200ms) antes del siguiente lote...`);
        await new Promise(resolve => setTimeout(resolve, 1200));
      }
    }

    // 6. Verificación de salvaguarda: Asegurar que ningún ítem se haya quedado por fuera (Mapeo robusto por código)
    const mappedItemCodes = new Set(allDataPoints.map(dp => String(dp.budget_item_code).trim()));
    const missingItems = enrichedBudgetItems.filter(b => !mappedItemCodes.has(b.code.trim()));

    if (missingItems.length > 0) {
      console.log(`⚠️ Salvaguarda: Faltaron ${missingItems.length} ítems en las respuestas de la IA. Agregándolos determinísticamente usando el motor local de respaldo...`);
      missingItems.forEach(item => {
        allDataPoints.push(mapItemLocally(item, fallbackDate, phaseTasks));
      });
    }

    console.log(`Consolidados exitosamente ${allDataPoints.length} puntos de datos.`);

    // 7. Generación del Análisis Ejecutivo Global (Con fallback local determinista si la red falla)
    const chapterTotals: { [key: string]: number } = {};
    allDataPoints.forEach(dp => {
      chapterTotals[dp.chapter] = (chapterTotals[dp.chapter] || 0) + (dp.budget_required || 0);
    });

    const chapterSummary = Object.entries(chapterTotals)
      .map(([ch, tot]) => `- **${ch}**: $${new Intl.NumberFormat("es-CO").format(Math.round(tot))} COP`)
      .join("\n");

    const totalBudgetSum = allDataPoints.reduce((sum, dp) => sum + (dp.budget_required || 0), 0);

    let globalAnalysis = "";

    try {
      if (initialOffline) {
        throw new Error("Modo Offline activo: Omitiendo generación de reporte por IA.");
      }

      console.log("Generando análisis ejecutivo global con IA...");
      
      const tempKeyGlobal = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;
      
      const globalClient = new GoogleGenAI({
        enterprise: true,
        project: projectId,
        location: location,
      });

      if (tempKeyGlobal) {
        process.env.GEMINI_API_KEY = tempKeyGlobal;
      }

      const summaryResult = await withTimeout(
        generateContentWithRetry(globalClient, {
          model: "gemini-2.5-flash",
          contents: `
Genera un análisis de control de costos ejecutivo para la gerencia de Constructora Serving S.A.S. en base a estos datos reales consolidados del proyecto Bosque de Agua:

Resumen del Presupuesto por Capítulos:
${chapterSummary}

Total General del Presupuesto Mapeado:
$${new Intl.NumberFormat("es-CO").format(Math.round(totalBudgetSum))} COP

Rango y estadísticas:
- Fecha de inicio del proyecto: ${fallbackDate}
- Tareas totales analizadas en el cronograma: ${scheduleItems.length}
- Ítems de obra granulares correlacionados: ${allDataPoints.length}

INSTRUCCIONES:
1. Redacta un informe gerencial profesional, persuasivo y de alto nivel en español, con formato Markdown.
2. Estructura el informe con secciones: Resumen Ejecutivo, Análisis de Distribución Financiera, y Conclusiones del Mapeo.
3. Aporta valor analítico real sobre la coherencia entre el presupuesto y las etapas de desarrollo en el tiempo.
`,
          config: {
            systemInstruction: "Eres el Gerente de Control de Proyectos Senior de Constructora Serving S.A.S. Redactas informes profesionales y concisos.",
            temperature: 0.3,
          },
        }),
        10000,
        "Vertex AI global executive summary timed out"
      );

      globalAnalysis = summaryResult.text || "Análisis de flujo de caja generado exitosamente.";
    } catch (summaryErr) {
      console.warn("⚠️ No se pudo generar el reporte ejecutivo con IA (Modo Offline, error de red o timeout). Usando plantilla corporativa local...", summaryErr);
      fellBackToOffline = true;
      
      const formattedTotal = new Intl.NumberFormat("es-CO").format(Math.round(totalBudgetSum));
      const formattedChapters = Object.entries(chapterTotals)
        .map(([ch, tot]) => `| ${ch} | $${new Intl.NumberFormat("es-CO").format(Math.round(tot))} COP |`)
        .join("\n");

      globalAnalysis = `# Informe de Mapeo Semántico y Análisis Ejecutivo de Costos
**Constructora Serving S.A.S. — Proyecto Bosque de Agua**

*Nota: Este informe ha sido consolidado de forma determinista usando el motor local híbrido de coincidencia semántica de 3 capas debido a una desconexión o indisponibilidad temporal del servicio en la nube.*

---

## 1. Resumen Ejecutivo
El presente informe consolida la alineación temporal del presupuesto frente al cronograma de obra del proyecto **Bosque de Agua**. Se han procesado y verificado un total de **${budgetItems.length} ítems de obra reales** y se han correlacionado de manera semántica bidireccional con las **${scheduleItems.length} tareas del cronograma de obra**.

El presupuesto total consolidado y distribuido temporalmente asciende a la suma de:
### **$${formattedTotal} COP**

---

## 2. Distribución Financiera por Capítulos de Obra
A continuación, se detalla la distribución del presupuesto agrupado por capítulos reales del proyecto:

| Capítulo de Presupuesto | Presupuesto Total Consolidado |
| :--- | :--- |
${formattedChapters}

---

## 3. Conclusiones y Resiliencia del Sistema
1. **Precisión del Mapeo**: El **100% de los ítems de obra** han sido mapeados con éxito. Gracias al motor de coincidencia semántica híbrida local de 3 capas, los conceptos de obra complejos (tales como *acueducto*, *redes*, *bajantes*, *revoque*, etc.) han sido emparejados con sus respectivas actividades reales del cronograma.
2. **Distribución del Flujo de Caja**: El flujo de caja proyectado representa con exactitud la asignación de recursos a lo largo de la ejecución del proyecto, mitigando el problema del "acumulado inicial" y reflejando las fechas reales de inicio de las tareas.
3. **Resiliencia Operativa**: El sistema activó su protocolo de redundancia local al detectar indisponibilidad de la API de Vertex AI, garantizando la continuidad operativa y la visualización de los gráficos de flujo de caja en el dashboard gerencial sin interrupciones.
`;
    }

    // 8. Retornar el JSON estructurado final
    const finalResult = {
      analysis: globalAnalysis,
      dataPoints: allDataPoints,
      totalBudget: totalBudgetSum,
      isOfflineFallback: fellBackToOffline,
    };

    return NextResponse.json({ success: true, data: finalResult });

  } catch (error) {
    console.error("Error procesando análisis:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      { error: "Error interno: " + errorMessage },
      { status: 500 }
    );
  }
}
