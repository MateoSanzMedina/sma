import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, dataPoints, analysis, directBudget, totalBudget, model } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "El historial de mensajes es requerido." },
        { status: 400 }
      );
    }

    const projectId = process.env.GCP_PROJECT_ID;
    const location = process.env.GCP_LOCATION;
    const initialOffline = !projectId || !location;

    if (initialOffline) {
      return NextResponse.json(
        { error: "El servicio en la nube (Vertex AI) no está configurado." },
        { status: 503 }
      );
    }

    // Inicializar el cliente de Vertex AI
    const tempKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    
    let client: GoogleGenAI;
    try {
      client = new GoogleGenAI({
        vertexai: true,
        project: projectId,
        location: location,
      });
    } finally {
      if (tempKey) {
        process.env.GEMINI_API_KEY = tempKey;
      }
    }

    // Formatear los últimos 10 mensajes del chat
    const chatHistory = messages.slice(-10).map((msg: { role: string; content: string }) => {
      return {
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }]
      };
    });

    // Compilar Resumen Mensual de Flujo de Caja y Top 25 Partidas más costosas
    const monthlyTotals: { [key: string]: number } = {};
    if (dataPoints && Array.isArray(dataPoints)) {
      dataPoints.forEach((dp: any) => {
        if (!dp.date) return;
        const month = dp.date.slice(0, 7); // YYYY-MM
        monthlyTotals[month] = (monthlyTotals[month] || 0) + (dp.budget_required || 0);
      });
    }

    const sortedMonths = Object.keys(monthlyTotals).sort();
    const monthlySummaryText = sortedMonths.map(m => {
      return `- ${m}: $${new Intl.NumberFormat("es-CO").format(Math.round(monthlyTotals[m]))} COP`;
    }).join("\n");

    const topExpensiveItems = dataPoints && Array.isArray(dataPoints)
      ? [...dataPoints]
          .sort((a: any, b: any) => (b.budget_required || 0) - (a.budget_required || 0))
          .slice(0, 25)
          .map((dp: any) => {
            return `- [${dp.chapter || "Otros"}] ${dp.task_name}: $${new Intl.NumberFormat("es-CO").format(Math.round(dp.budget_required))} COP (Fecha Inicio: ${dp.date})`;
          }).join("\n")
      : "No disponible";

    // Inyectar el prompt de sistema y los datos del proyecto
    const systemInstruction = `Eres el Director Financiero, de Control de Costos y Planeación Estratégica Senior de Constructora Serving S.A.S.
Tu objetivo es ayudar a la alta gerencia a analizar, interrogar y comprender con precisión quirúrgica los resultados del mapeo semántico entre el presupuesto y el cronograma del proyecto Bosque de Agua.

DATOS CONSOLIDADOS DEL PROYECTO:
- Costo Directo Mapeado (Obra Física): $${new Intl.NumberFormat("es-CO").format(Math.round(directBudget))} COP
- Costo Total con Indirectos (9.5% AI + 3% IVA sobre Utilidad): $${new Intl.NumberFormat("es-CO").format(Math.round(totalBudget))} COP
- Diferencia de Costos Indirectos (AIU): $${new Intl.NumberFormat("es-CO").format(Math.round(totalBudget - directBudget))} COP
- Total de ítems de obra granular mapeados: ${dataPoints?.length || 222} ítems
- Fecha de inicio aproximada del proyecto: ${dataPoints?.[0]?.date || "2026-02-02"}

DISTRIBUCIÓN MENSUAL DEL FLUJO DE CAJA MAPEADO:
${monthlySummaryText}

PRINCIPALES PARTIDAS Y ÍTEMS MÁS COSTOSOS DEL PROYECTO (TOP 25):
${topExpensiveItems}

INFORME EJECUTIVO GLOBAL DE COSTOS:
${analysis}

REGLAS CRÍTICAS DE RESPUESTA:
1. ROL FINANCIERO DE ELITE: Habla con un tono analítico, gerencial, riguroso e institucional en español, como un CFO (Chief Financial Officer) experimentado en construcción pesada e infraestructura.
2. NO ESCRIBAS MEMORANDOS DE CORREO: Está ABSOLUTAMENTE PROHIBIDO iniciar las respuestas con formatos de correo corporativo (ej. "Para: Gerencia", "De: Director...", "Asunto: ..."). Responde DIRECTAMENTE al usuario de forma conversacional y estructurada.
3. CONCISIÓN EXTREMA Y LÍMITE DE PALABRAS: Tus respuestas deben ser sumamente breves y directas al grano, con un límite estricto de un máximo de 90 a 100 palabras en total. Presenta las cifras clave resumidas en un máximo de 2 o 3 viñetas muy cortas y concisas. Está estrictamente prohibido escribir párrafos largos o explicaciones redundantes. Termina siempre tus oraciones completamente y de forma fluida. Esto garantizará respuestas inmediatas y completas.
4. RESPUESTAS A CAPÍTULOS Y FECHAS:
   - Si preguntan por capítulos, busca en los ítems mapeados, consolida el costo directo y menciona las tareas del cronograma clave con sus fechas de inicio.
   - Si preguntan por concentraciones de desembolso o fechas, analiza en qué mes se concentran los mayores recursos (como la fundición de estructuras en los primeros meses o acabados al final) y describe las actividades conductoras del flujo de caja.
5. Emplea formato Markdown limpio (negritas para montos en COP, listas ordenadas, tablas pequeñas de 2 o 3 columnas si es útil) para facilitar la lectura en pantalla.`;

    const userPrompt = messages[messages.length - 1].content;

    const selectedModel = model === "gemini-2.5-flash" ? "gemini-2.5-flash" : "gemini-2.5-pro";

    // Llamar a Gemini mediante Vertex AI
    const response = await client.models.generateContent({
      model: selectedModel,
      contents: userPrompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.25,
        maxOutputTokens: 2048
      }
    });

    const botReply = response.text || "No pude generar una respuesta en este momento.";

    return NextResponse.json({ success: true, reply: botReply });

  } catch (error) {
    console.error("Error en el chatbot de análisis:", error);
    return NextResponse.json(
      { error: "Error en el servidor de chat: " + (error instanceof Error ? error.message : "desconocido") },
      { status: 500 }
    );
  }
}
