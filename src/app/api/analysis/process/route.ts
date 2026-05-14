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
      const vals = Object.values(row).map(v => String(v).trim());
      // Buscar si la fila tiene datos reales
      return vals.some(v => v.length > 0 && v !== "0");
    }).map((row: any) => {
      // Limpiar columnas vacías para ahorrar tokens y no saturar la IA
      const cleanRow: any = {};
      Object.entries(row).forEach(([k, v]) => {
        if (v !== "" && v !== null && v !== undefined) {
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
      const vals = Object.values(row).map(v => String(v).trim());
      // Buscar si la fila tiene datos reales
      return vals.some(v => v.length > 0);
    }).map((row: any) => {
      // Limpiar columnas vacías
      const cleanRow: any = {};
      Object.entries(row).forEach(([k, v]) => {
        if (v !== "" && v !== null && v !== undefined) {
          cleanRow[k] = v;
        }
      });
      return cleanRow;
    });

    console.log(`Cronograma: Procesadas ${scheduleJson.length} tareas.`);

    // 3. Inicializar Vertex AI usando el SDK Unificado (@google/genai)
    const projectId = process.env.GCP_PROJECT_ID;
    const location = process.env.GCP_LOCATION;

    if (!projectId || !location) {
      return NextResponse.json(
        { error: "Las variables GCP_PROJECT_ID o GCP_LOCATION no están configuradas para Vertex AI." },
        { status: 500 }
      );
    }

    // Para obligar al SDK a usar las credenciales empresariales de Vertex AI en lugar de la API Key,
    // ocultamos temporalmente la GEMINI_API_KEY del entorno de Node.js
    const tempApiKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    // Al inicializar con enterprise: true, el SDK usa GOOGLE_APPLICATION_CREDENTIALS automáticamente
    const client = new GoogleGenAI({
      enterprise: true,
      project: projectId,
      location: location,
    });

    // Restauramos la API Key por si otros servicios de Next.js la necesitan
    if (tempApiKey) {
      process.env.GEMINI_API_KEY = tempApiKey;
    }

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
${JSON.stringify(budgetJson)}

Datos del Cronograma:
${JSON.stringify(scheduleJson)}

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
      model: "gemini-2.5-flash", // Modelo unificado
      contents: userPrompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.1, // REGLA DE ORO: 0.1 o 0.0 para mapeo estricto de datos. Evita alucinaciones y hace que la generación sea 10x más rápida.
        maxOutputTokens: 8192, // Garantiza que no se corte por límite de tokens tan rápido
      }
    });

    // Extraer respuesta del SDK v2
    let textResponse = result.text || "{}";
    
    // Reparación de emergencia: si por alguna razón la IA cortó el texto por tiempo, intentamos cerrar el JSON
    if (!textResponse.trim().endsWith("}")) {
      console.warn("⚠️ Advertencia: El JSON generado se cortó a la mitad. Intentando auto-reparar el final del JSON...");
      
      // Buscar el último cierre válido de un objeto
      const lastValidEnd = textResponse.lastIndexOf("}");
      if (lastValidEnd > 0) {
        textResponse = textResponse.substring(0, lastValidEnd + 1) + "\n  ],\n  \"totalBudget\": 0\n}";
      } else {
        textResponse += ']\n}';
      }
    }

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
