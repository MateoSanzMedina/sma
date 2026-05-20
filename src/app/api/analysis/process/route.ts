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
function parseSpanishDate(dateStr: any): string {
  if (typeof dateStr !== "string") return String(dateStr);
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

// Función determinista para parsear la pestaña "Presupuesto V5" del presupuesto
function parseBudgetSheet(worksheet: xlsx.WorkSheet): any[] {
  const rows: any[][] = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
  const budgetItems: any[] = [];
  let currentChapter = "Otros";

  const isCode = (s: string) => {
    const clean = s.replace(/\.0$/, "").replace(/\./g, "").trim();
    return /^\d+$/.test(clean) && clean.length >= 4;
  };

  rows.forEach((row: any[]) => {
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
function parseScheduleSheet(worksheet: xlsx.WorkSheet): any[] {
  const rawRows: any[] = xlsx.utils.sheet_to_json(worksheet, { defval: "" });
  const scheduleItems: any[] = [];

  rawRows.forEach((row: any) => {
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

// Función auxiliar para llamar a Gemini con reintentos automáticos y retroceso exponencial en caso de cuotas de recursos agotadas (429)
async function generateContentWithRetry(client: any, params: any, retries = 3, delayMs = 3000): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await client.models.generateContent(params);
    } catch (error: any) {
      const errorMsg = String(error.message || "").toUpperCase();
      const errorStatus = error.status || 0;
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
}

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

    // 1. Parsear Presupuesto con parser determinista
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

    // Filtrar para quedarnos únicamente con tareas específicas de nivel 3 o superior (hojas del cronograma)
    // Esto reduce drásticamente el tamaño del prompt y evita exceder límites o confundir al modelo con grupos contenedores
    let scheduleItems = scheduleItemsRaw.filter(t => t.level >= 3);
    if (scheduleItems.length === 0) {
      scheduleItems = scheduleItemsRaw; // Respaldo a todas si el cronograma no tiene tareas nivel >= 3
    }

    console.log(`Cronograma: Parseadas ${scheduleItemsRaw.length} tareas totales, de las cuales ${scheduleItems.length} son tareas reales (nivel >= 3).`);

    // Fecha de inicio por defecto del proyecto como fallback
    const fallbackDate = scheduleItems.find(t => t.start && t.start.includes("-"))?.start || "2026-02-02";

    // 3. Inicializar Vertex AI
    const projectId = process.env.GCP_PROJECT_ID;
    const location = process.env.GCP_LOCATION;

    if (!projectId || !location) {
      return NextResponse.json(
        { error: "Las variables GCP_PROJECT_ID o GCP_LOCATION no están configuradas para Vertex AI." },
        { status: 500 }
      );
    }

    // Ocultar GEMINI_API_KEY temporalmente para obligar al SDK a usar Vertex AI Enterprise
    const tempApiKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const client = new GoogleGenAI({
      enterprise: true,
      project: projectId,
      location: location,
    });

    if (tempApiKey) {
      process.env.GEMINI_API_KEY = tempApiKey;
    }

    // 4. Dividir ítems de presupuesto en Lotes (Batching) para procesamiento secuencial
    const batchSize = 40;
    const batches: any[][] = [];
    for (let i = 0; i < budgetItems.length; i += batchSize) {
      batches.push(budgetItems.slice(i, i + batchSize));
    }

    console.log(`Iniciando procesamiento secuencial robusto: ${batches.length} lotes de tamaño ~${batchSize}.`);

    const allDataPoints: any[] = [];

    for (let index = 0; index < batches.length; index++) {
      const batch = batches[index];
      console.log(`Procesando secuencialmente Lote ${index + 1}/${batches.length} con ${batch.length} ítems...`);

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
        const result = await generateContentWithRetry(batchClient, {
          model: "gemini-2.5-flash",
          contents: `
LISTA DE ÍTEMS DEL PRESUPUESTO A MAPEAR (LOTE ACTUAL):
${JSON.stringify(batch)}

CRONOGRAMA DE TAREAS DISPONIBLES EN LA OBRA:
${JSON.stringify(scheduleItems)}
`,
          config: {
            systemInstruction: `Eres un analista senior de control de costos en Constructora Serving S.A.S.
Tu tarea es correlacionar cada uno de los ítems del presupuesto de este lote con las tareas del cronograma.
REGLAS MANDATORIAS:
1. NO RESUMAS ni agrupes. Debes generar exactamente un dataPoint por cada ítem de presupuesto recibido en este lote (recibiste exactamente ${batch.length} ítems).
2. Mapea cada ítem a la fecha de inicio de la tarea del cronograma más relacionada por su nombre o contexto (ej: excavaciones, concreto, tubería, andenes, etc.).
3. Si un ítem no tiene relación clara o el cronograma no lo especifica, usa la fecha de fallback: "${fallbackDate}".
4. Conserva el nombre exacto de la tarea y su capítulo.`,
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
                      chapter: { type: "STRING" }
                    },
                    required: ["date", "budget_required", "task_name", "chapter"]
                  }
                }
              },
              required: ["dataPoints"]
            } as any,
            temperature: 0.1,
            maxOutputTokens: 8192, // Ampliar para asegurar espacio completo para todos los items
          },
        });

        const text = result.text || "{}";
        try {
          const parsed = JSON.parse(text);
          const points = parsed.dataPoints || [];
          console.log(`Lote ${index + 1} procesado exitosamente. Retornados ${points.length} de ${batch.length} dataPoints.`);
          allDataPoints.push(...points);
        } catch (parseErr: any) {
          console.error(`⚠️ Error parseando respuesta JSON del lote ${index + 1}:`, parseErr);
          console.log("Texto devuelto por la IA:", text);
          // Si por algún motivo falla, la salvaguarda reinsertará los ítems con el fallback
        }
      } catch (batchErr: any) {
        console.error(`❌ Error de Vertex AI procesando el lote ${index + 1}:`, batchErr);
      }

      // Pequeño retardo entre peticiones para prevenir estrangulamiento de tasa de Vertex AI (quota rates)
      if (index < batches.length - 1) {
        console.log(`Esperando un breve momento (1200ms) antes del siguiente lote...`);
        await new Promise(resolve => setTimeout(resolve, 1200));
      }
    }

    // 5. Verificación de salvaguarda: Asegurar que ningún ítem se haya quedado por fuera
    const mappedTaskNames = new Set(allDataPoints.map(dp => String(dp.task_name).trim().toLowerCase()));
    const missingItems = budgetItems.filter(b => !mappedTaskNames.has(b.desc.trim().toLowerCase()));

    if (missingItems.length > 0) {
      console.log(`⚠️ Mapeador: Faltaron ${missingItems.length} ítems en las respuestas de la IA. Agregándolos con la fecha de fallback...`);
      missingItems.forEach(item => {
        allDataPoints.push({
          date: fallbackDate,
          budget_required: item.val,
          task_name: item.desc,
          chapter: item.chapter,
        });
      });
    }

    console.log(`Consolidados exitosamente ${allDataPoints.length} puntos de datos.`);

    // 6. Generación del Análisis Ejecutivo Global
    const chapterTotals: { [key: string]: number } = {};
    allDataPoints.forEach(dp => {
      chapterTotals[dp.chapter] = (chapterTotals[dp.chapter] || 0) + (dp.budget_required || 0);
    });

    const chapterSummary = Object.entries(chapterTotals)
      .map(([ch, tot]) => `- **${ch}**: $${new Intl.NumberFormat("es-CO").format(Math.round(tot))} COP`)
      .join("\n");

    const totalBudgetSum = allDataPoints.reduce((sum, dp) => sum + (dp.budget_required || 0), 0);

    console.log("Generando análisis ejecutivo global con IA (con reintentos en caso de límite de tasa)...");
    
    // Ocultar API Key temporalmente por llamada para asegurar Vertex AI Enterprise
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

    const summaryResult = await generateContentWithRetry(globalClient, {
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
    });

    const globalAnalysis = summaryResult.text || "Análisis de flujo de caja generado exitosamente.";

    // 7. Retornar el JSON estructurado final
    const finalResult = {
      analysis: globalAnalysis,
      dataPoints: allDataPoints,
      totalBudget: totalBudgetSum,
    };

    return NextResponse.json({ success: true, data: finalResult });

  } catch (error: any) {
    console.error("Error procesando análisis:", error);
    return NextResponse.json(
      { error: "Error interno: " + error.message },
      { status: 500 }
    );
  }
}
