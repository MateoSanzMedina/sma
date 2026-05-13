import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import * as xlsx from "xlsx";

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

    // 1. Parsear el archivo Excel de Presupuesto
    const budgetBuffer = await budgetFile.arrayBuffer();
    const budgetWorkbook = xlsx.read(budgetBuffer, { type: "array" });
    
    // Intentar buscar la pestaña "Presupuesto V5" o la primera disponible
    const budgetSheetName = budgetWorkbook.SheetNames.find(n => n.includes("V5")) || budgetWorkbook.SheetNames[0];
    const budgetWorksheet = budgetWorkbook.Sheets[budgetSheetName];
    const rawBudgetJson = xlsx.utils.sheet_to_json(budgetWorksheet, { defval: "" });
    
    // Filtrar filas del presupuesto - Ser más permisivo para no perder ítems
    const budgetJson = rawBudgetJson.filter((row: any) => {
      const vals = Object.values(row).map(v => String(v).toLowerCase());
      // Buscar si la fila parece tener datos (no solo celdas vacías)
      const hasData = vals.some(v => v.length > 0 && v !== "0");
      return hasData;
    }).map(row => {
      const cleanRow: any = {};
      Object.entries(row).forEach(([k, v]) => {
        const lowerK = k.toLowerCase();
        // Capturar columnas clave sin ser tan restrictivo
        if (lowerK.includes("desc") || lowerK.includes("item") || lowerK.includes("total") || 
            lowerK.includes("valor") || lowerK.includes("cant") || lowerK.includes("unidad") ||
            lowerK.includes("p.u") || lowerK.includes("precio")) {
          cleanRow[k] = v;
        }
      });
      return cleanRow;
    });

    console.log(`Presupuesto: Procesadas ${budgetJson.length} filas.`);

    // 2. Parsear el archivo Excel del Cronograma
    const scheduleBuffer = await scheduleFile.arrayBuffer();
    const scheduleWorkbook = xlsx.read(scheduleBuffer, { type: "array" });
    const scheduleSheetName = scheduleWorkbook.SheetNames[0];
    const scheduleWorksheet = scheduleWorkbook.Sheets[scheduleSheetName];
    const rawScheduleJson = xlsx.utils.sheet_to_json(scheduleWorksheet, { defval: "" });
    
    const scheduleJson = rawScheduleJson.filter((row: any) => {
      const vals = Object.values(row).map(v => String(v).toLowerCase());
      return vals.some(v => v.length > 0);
    }).map(row => {
      const cleanRow: any = {};
      Object.entries(row).forEach(([k, v]) => {
        const lowerK = k.toLowerCase();
        if (lowerK.includes("nombre") || lowerK.includes("tarea") || lowerK.includes("comienzo") || 
            lowerK.includes("fin") || lowerK.includes("inicio") || lowerK.includes("duracion") ||
            lowerK.includes("nombre de la tarea")) {
          cleanRow[k] = v;
        }
      });
      return cleanRow;
    });

    console.log(`Cronograma: Procesadas ${scheduleJson.length} tareas.`);

    // 3. Inicializar Gemini con @google/genai
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "La variable GEMINI_API_KEY no está configurada." },
        { status: 500 }
      );
    }

    const client = new GoogleGenAI({ apiKey });

    const systemInstruction = `Eres un analista senior de control de costos en Constructora Serving S.A.S.
Tu tarea es correlacionar cada uno de los cientos de ítems del presupuesto con las tareas del cronograma.

REGLAS CRÍTICAS DE PROCESAMIENTO:
1. NO RESUMAS. Genera un punto de datos individual por cada ítem identificado en el presupuesto.
2. Si el presupuesto tiene 500 ítems, espero exactamente ~500 dataPoints en el JSON de salida.
3. El resultado DEBE ser un listado exhaustivo. Si omites ítems para ahorrar espacio, el análisis será inútil.
4. Mapea cada ítem a la fecha de inicio de la tarea del cronograma más relacionada por nombre o contexto.
5. Usa el campo "chapter" para agrupar por los títulos de sección del presupuesto.`;

    const userPrompt = `
Datos del Presupuesto:
${JSON.stringify(budgetJson).substring(0, 120000)}

Datos del Cronograma:
${JSON.stringify(scheduleJson).substring(0, 120000)}

RESPUESTA REQUERIDA (ESTRICTAMENTE JSON):
{
  "analysis": "Breve análisis de la coherencia.",
  "dataPoints": [
    {
      "date": "YYYY-MM-DD",
      "budget_required": 1234.56,
      "task_name": "Nombre exacto del ítem del presupuesto",
      "chapter": "Nombre del capítulo"
    }
  ],
  "totalBudget": 0.0
}
`;

    const result = await client.models.generateContent({
      model: "gemini-3-flash-preview",
      systemInstruction,
      contents: userPrompt,
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 65536,
        temperature: 0.1,
      }
    });

    // En @google/genai v2, el resultado suele estar en result.value o similar dependiendo del helper
    // Pero lo más seguro es usar el campo 'response'
    const textResponse = result.response.text();
    const resultData = JSON.parse(textResponse);
    
    // Asegurar que el totalBudget esté calculado si la IA no lo hizo bien
    if (resultData.dataPoints && (!resultData.totalBudget || resultData.totalBudget === 0)) {
      resultData.totalBudget = resultData.dataPoints.reduce((sum: number, dp: any) => sum + (dp.budget_required || 0), 0);
    }
    
    return NextResponse.json({ success: true, data: resultData });

  } catch (error: any) {
    console.error("Error procesando análisis:", error);
    return NextResponse.json(
      { error: "Error interno: " + error.message },
      { status: 500 }
    );
  }
}
