/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
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

    const apiKey = process.env.GEMINI_API_KEY;
    const projectId = process.env.GCP_PROJECT_ID;
    const location = process.env.GCP_LOCATION;

    let client: GoogleGenAI | null = null;

    if (apiKey && apiKey.trim() !== "") {
      try {
        client = new GoogleGenAI({ apiKey: apiKey.trim() });
      } catch (e) {
        console.warn("⚠️ Error inicializando AI Studio con GEMINI_API_KEY en chat:", e);
      }
    }

    if (!client && projectId && location) {
      const tempKey = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;
      try {
        client = new GoogleGenAI({
          vertexai: true,
          project: projectId,
          location: location,
        });
      } catch (e) {
        console.warn("⚠️ Error inicializando Vertex AI en chat:", e);
      } finally {
        if (tempKey) {
          process.env.GEMINI_API_KEY = tempKey;
        }
      }
    }

    // Formatear los últimos 10 mensajes del chat
    const chatHistory = messages.slice(-10).map((msg: { role: string; content: string }) => {
      return {
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }]
      };
    });

    // Compilar Resumen Mensual de Flujo de Caja, Métricas Diarias y Top 25 Partidas
    const monthlyTotals: { [key: string]: number } = {};
    let maxDailyCost = 0;
    let maxDailyDate = "";
    let maxDailyTask = "";
    const dailyTotals: { [key: string]: number } = {};
    const dailyTasks: { [key: string]: { name: string, cost: number }[] } = {};

    if (dataPoints && Array.isArray(dataPoints)) {
      dataPoints.forEach((dp: any) => {
        if (!dp.date) return;
        const month = dp.date.slice(0, 7); // YYYY-MM
        monthlyTotals[month] = (monthlyTotals[month] || 0) + (dp.budget_required || 0);

        // Registro diario
        dailyTotals[dp.date] = (dailyTotals[dp.date] || 0) + (dp.budget_required || 0);
        if (!dailyTasks[dp.date]) {
          dailyTasks[dp.date] = [];
        }
        dailyTasks[dp.date].push({ name: dp.task_name, cost: dp.budget_required });
      });
    }

    const sortedMonths = Object.keys(monthlyTotals).sort();
    const monthlySummaryText = sortedMonths.map(m => {
      return `- ${m}: $${new Intl.NumberFormat("es-CO").format(Math.round(monthlyTotals[m]))} COP`;
    }).join("\n");

    const sortedDates = Object.keys(dailyTotals).sort();
    const totalDurationDays = sortedDates.length || 365;

    sortedDates.forEach(date => {
      const cost = dailyTotals[date];
      if (cost > maxDailyCost) {
        maxDailyCost = cost;
        maxDailyDate = date;
        const tasks = dailyTasks[date] || [];
        const topTask = tasks.sort((a, b) => b.cost - a.cost)[0];
        maxDailyTask = topTask ? topTask.name : "Varios subprocesos";
      }
    });

    const avgDailyCost = directBudget / totalDurationDays;

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
- Duración total activa del cronograma: ${totalDurationDays} días calendario
- Costo directo diario promedio general: $${new Intl.NumberFormat("es-CO").format(Math.round(avgDailyCost))} COP/día
- Pico máximo de desembolso en un solo día: $${new Intl.NumberFormat("es-CO").format(Math.round(maxDailyCost))} COP el día ${maxDailyDate} (Actividad conductora: "${maxDailyTask}")

DISTRIBUCIÓN MENSUAL DEL FLUJO DE CAJA MAPEADO:
${monthlySummaryText}

PRINCIPALES PARTIDAS Y ÍTEMS MÁS COSTOSOS DEL PROYECTO (TOP 25):
${topExpensiveItems}

INFORME EJECUTIVO GLOBAL DE COSTOS:
${analysis}

REGLAS CRÍTICAS DE RESPUESTA:
1. ROL FINANCIERO DE ELITE: Habla con un tono analítico, gerencial, riguroso e institucional en español, como un CFO (Chief Financial Officer) experimentado en construcción pesada e infraestructura.
2. NO ESCRIBAS MEMORANDOS DE CORREO: Está ABSOLUTAMENTE PROHIBIDO iniciar las respuestas con formatos de correo corporativo (ej. "Para: Gerencia", "De: Director...", "Asunto: ..."). Responde DIRECTAMENTE al usuario de forma conversacional y estructurada.
3. CONCISIÓN EXTREMA Y LÍMITE DE PALABRAS: Tus respuestas deben ser sumamente breves y directas al grano, con un límite estricto de un máximo de 100 a 110 palabras en total. Presenta las cifras clave resumidas en un máximo de 2 o 3 viñetas muy cortas y concisas. Está estrictamente prohibido escribir párrafos largos o explicaciones redundantes. Termina siempre tus oraciones completamente y de forma fluida.
4. RESPUESTAS A CAPÍTULOS, FECHAS Y FLUJO DIARIO:
   - El sistema opera a una resolución estrictamente DIARIA. Tienes acceso completo al flujo diario detallado del proyecto Bosque de Agua.
   - Si el usuario te pregunta por el flujo de caja diario o montos por día, proporciónale el costo directo diario promedio general ($${new Intl.NumberFormat("es-CO").format(Math.round(avgDailyCost))} COP/día) o el pico de desembolso máximo ($${new Intl.NumberFormat("es-CO").format(Math.round(maxDailyCost))} COP el día ${maxDailyDate}).
   - Explícale que cada proceso del cronograma (las 329 actividades de MS Project) tiene asignado su presupuesto distribuido de manera uniforme (Costo Split) a nivel diario sobre su correspondiente duración en días calendario.
   - Si preguntan por capítulos, busca en los ítems mapeados, consolida el costo directo y menciona las tareas del cronograma clave con sus fechas de inicio.
   - Si preguntan por concentraciones de desembolso o fechas, analiza en qué mes se concentran los mayores recursos (como la fundición de estructuras en los primeros meses o acabados al final) y describe las actividades conductoras del flujo de caja.
5. Emplea formato Markdown limpio (negritas para montos en COP, listas ordenadas, tablas pequeñas de 2 o 3 columnas si es útil) para facilitar la lectura en pantalla.`;

    const userPrompt = messages[messages.length - 1].content;
    const selectedModel = model === "gemini-2.5-flash" ? "gemini-2.5-flash" : "gemini-2.5-pro";

    let botReply = "";

    try {
      if (!client) {
        throw new Error("Cliente de IA no configurado");
      }
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
      botReply = response.text || "";
    } catch (apiErr) {
      console.warn("⚠️ Vertex AI en estado de suspensión o cuota excedida. Usando motor local de respaldo CFO:", apiErr);
      botReply = generateLocalCfoReply(
        userPrompt,
        directBudget,
        totalBudget,
        monthlyTotals,
        maxDailyCost,
        maxDailyDate,
        maxDailyTask,
        topExpensiveItems
      );
    }

    if (!botReply) {
      botReply = generateLocalCfoReply(
        userPrompt,
        directBudget,
        totalBudget,
        monthlyTotals,
        maxDailyCost,
        maxDailyDate,
        maxDailyTask,
        topExpensiveItems
      );
    }

    return NextResponse.json({ success: true, reply: botReply });

  } catch (error) {
    console.error("Error en el chatbot de análisis:", error);
    return NextResponse.json(
      { error: "Error en el servidor de chat: " + (error instanceof Error ? error.message : "desconocido") },
      { status: 500 }
    );
  }
}

function generateLocalCfoReply(
  userPrompt: string,
  directBudget: number,
  totalBudget: number,
  monthlyTotals: { [key: string]: number },
  maxDailyCost: number,
  maxDailyDate: string,
  maxDailyTask: string,
  topExpensiveItems: string
): string {
  const cleanPrompt = userPrompt.toLowerCase();

  if (cleanPrompt.includes("presupuesto") || cleanPrompt.includes("costo") || cleanPrompt.includes("total") || cleanPrompt.includes("directo") || cleanPrompt.includes("aiu")) {
    return `### 📊 Resumen Financiero Ejecutivo (Modo Local Resiliente)
- **Costo Directo Mapeado**: **$${new Intl.NumberFormat("es-CO").format(Math.round(directBudget))} COP**
- **Costo Total con Indirectos**: **$${new Intl.NumberFormat("es-CO").format(Math.round(totalBudget))} COP** (incluye 9.5% AI + 3% IVA sobre utilidad).
- **Factor AIU/Indirectos**: **$${new Intl.NumberFormat("es-CO").format(Math.round(totalBudget - directBudget))} COP**.`;
  }

  if (cleanPrompt.includes("mes") || cleanPrompt.includes("flujo") || cleanPrompt.includes("mensual") || cleanPrompt.includes("concentrac")) {
    const sortedMonths = Object.keys(monthlyTotals).sort();
    const list = sortedMonths.map(m => `- **${m}**: $${new Intl.NumberFormat("es-CO").format(Math.round(monthlyTotals[m]))} COP`).join("\n");
    return `### 🗓️ Distribución Mensual del Flujo de Caja
${list}

- **Pico Máximo Diario**: **$${new Intl.NumberFormat("es-CO").format(Math.round(maxDailyCost))} COP** el día **${maxDailyDate}** (*${maxDailyTask}*).`;
  }

  if (cleanPrompt.includes("costoso") || cleanPrompt.includes("mayor") || cleanPrompt.includes("partida") || cleanPrompt.includes("top")) {
    return `### 💎 Top Partidas con Mayor Impacto Presupuestal
${topExpensiveItems.split("\n").slice(0, 7).join("\n")}`;
  }

  return `### 🏛️ Informe Financiero General (Modo Local Resiliente)
- **Presupuesto Directo Total**: **$${new Intl.NumberFormat("es-CO").format(Math.round(directBudget))} COP**
- **Presupuesto Total con Indirectos**: **$${new Intl.NumberFormat("es-CO").format(Math.round(totalBudget))} COP**
- **Día de Mayor Desembolso**: **$${new Intl.NumberFormat("es-CO").format(Math.round(maxDailyCost))} COP** el **${maxDailyDate}** (*${maxDailyTask}*).`;
}
