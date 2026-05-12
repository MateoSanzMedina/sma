import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import * as xlsx from "xlsx";
import Papa from "papaparse";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const scheduleFile = formData.get("schedule") as File | null;
    const budgetFile = formData.get("budget") as File | null;

    if (!scheduleFile || !budgetFile) {
      return NextResponse.json(
        { error: "Ambos archivos (cronograma CSV y presupuesto XLSX) son requeridos." },
        { status: 400 }
      );
    }

    // 1. Parsear el archivo Excel de Presupuesto
    const budgetBuffer = await budgetFile.arrayBuffer();
    const workbook = xlsx.read(budgetBuffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    // Extraer a JSON (tomamos los datos crudos para que la IA los analice)
    const budgetJson = xlsx.utils.sheet_to_json(worksheet, { defval: "" });

    // 2. Parsear el archivo CSV del Cronograma (MS Project)
    const scheduleText = await scheduleFile.text();
    const scheduleParsed = Papa.parse(scheduleText, {
      header: true,
      skipEmptyLines: true,
    });
    const scheduleJson = scheduleParsed.data;

    // 3. Inicializar Gemini
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "La variable GEMINI_API_KEY no está configurada en el servidor." },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey: apiKey });

    // 4. Prompt para Gemini
    const prompt = `
Eres un experto en gerencia de proyectos de construcción y analista financiero.
He extraído datos de dos archivos:
1. Un cronograma exportado en CSV (proveniente de MS Project) que contiene tareas, fechas de inicio y fechas de fin.
2. Un presupuesto en XLSX exportado a JSON que contiene conceptos de obra, costos, y cantidades.

Tu objetivo es correlacionar de forma inteligente los ítems del presupuesto con las tareas del cronograma. Debes deducir qué costos del presupuesto corresponden a qué fechas del cronograma según la similitud semántica de las tareas/conceptos. 

Luego, debes distribuir los costos a lo largo de las fechas del cronograma para crear un flujo de caja proyectado o una gráfica de "Presupuesto requerido según la fecha". Si una tarea dura varios días, asume que el costo se distribuye a lo largo de esos días o se requiere en la fecha de inicio (lo que sea más lógico para construcción, preferiblemente agrupado por mes o hito).

Datos del Presupuesto (JSON):
${JSON.stringify(budgetJson).substring(0, 50000)} // Truncado por seguridad

Datos del Cronograma (JSON):
${JSON.stringify(scheduleJson).substring(0, 50000)} // Truncado por seguridad

IMPORTANTE: DEBES RESPONDER ESTRICTAMENTE EN FORMATO JSON VÁLIDO. NO USES BACKTICKS NI TEXTO ADICIONAL ANTES O DESPUÉS DEL JSON.

El formato JSON debe tener la siguiente estructura exacta:
{
  "analysis": "Un resumen ejecutivo (texto) de 2-3 párrafos explicando cómo se correlacionaron los datos, los meses/hitos con mayor requerimiento de capital, y recomendaciones financieras.",
  "dataPoints": [
    {
      "date": "YYYY-MM-DD", (o "YYYY-MM" si agrupas por mes)
      "budget_required": 150000.00,
      "task_name": "Nombre de la fase o hito agrupado"
    }
  ],
  "totalBudget": 5000000.00
}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.2, // Baja temperatura para resultados deterministas y analíticos
      }
    });

    const textResponse = response.text;
    
    if (!textResponse) {
       throw new Error("Respuesta vacía del modelo Gemini");
    }

    // Parsear y devolver el resultado
    const resultData = JSON.parse(textResponse);
    
    return NextResponse.json({ success: true, data: resultData });

  } catch (error: any) {
    console.error("Error procesando análisis:", error);
    return NextResponse.json(
      { error: "Error interno al procesar los archivos: " + error.message },
      { status: 500 }
    );
  }
}
