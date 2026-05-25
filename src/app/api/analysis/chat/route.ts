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

    // Inyectar el prompt de sistema y los datos del proyecto
    const systemInstruction = `Eres un Ingeniero Senior de Control de Proyectos y Costos de Constructora Serving S.A.S.
Tu objetivo es ayudar a la gerencia a analizar, interrogar y comprender los resultados del mapeo semántico entre el presupuesto y el cronograma del proyecto Bosque de Agua.

DATOS CONSOLIDADOS DEL PROYECTO:
- Costo Directo Mapeado (Obra Física): $${new Intl.NumberFormat("es-CO").format(Math.round(directBudget))} COP
- Costo Total con Indirectos (9.5% AI + 3% IVA sobre Utilidad): $${new Intl.NumberFormat("es-CO").format(Math.round(totalBudget))} COP
- Diferencia de Costos Indirectos (AIU): $${new Intl.NumberFormat("es-CO").format(Math.round(totalBudget - directBudget))} COP
- Total de ítems de obra granular mapeados: ${dataPoints?.length || 222} ítems
- Fecha de inicio aproximada del proyecto: ${dataPoints?.[0]?.date || "2026-02-02"}

INFORME EJECUTIVO DEL PROYECTO:
${analysis}

LISTA COMPLETA DE ÍTEMS MAPEADOS (JSON):
${JSON.stringify(dataPoints)}

REGLAS DE COMPORTAMIENTO:
1. Responde de forma muy profesional, analítica, concisa y gerencial en español. Evita respuestas excesivamente largas o de relleno.
2. Si el usuario te pregunta por un capítulo específico (por ejemplo, "Estructura", "Portería", "Redes"), busca en la lista de ítems mapeados para dar el costo directo exacto y enumera de 2 a 4 actividades clave del cronograma asociadas con su fecha de inicio.
3. Si el usuario pregunta por fechas de flujo de caja o concentraciones de costo en el tiempo, analiza la lista de ítems e indícale en qué mes o meses se concentran las mayores partidas de gasto (ej. los meses con mayor flujo de concreto de estructura o instalación de redes).
4. Mantén siempre un tono consultivo de alto nivel, actuando como un asesor de control de proyectos de confianza para la alta gerencia de Constructora Serving S.A.S.
5. Emplea formato Markdown para tus respuestas (negritas, listas, tablas pequeñas si es oportuno) para facilitar la lectura en pantalla.`;

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
