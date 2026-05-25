import { NextRequest, NextResponse } from "next/server";
import * as xlsx from "xlsx";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { dataPoints, analysis, directBudget, totalBudget } = body;

    if (!dataPoints || !Array.isArray(dataPoints)) {
      return NextResponse.json(
        { error: "Datos de flujo de caja no proporcionados para la descarga." },
        { status: 400 }
      );
    }

    // Crear un nuevo libro de trabajo (Workbook)
    const wb = xlsx.utils.book_new();

    // ===================================================
    // 1. PESTAÑA: RESUMEN GERENCIAL Y ANÁLISIS IA
    // ===================================================
    const summaryRows = [
      ["CONSTRUCTORA SERVING S.A.S. — DEPARTAMENTO DE CONTROL DE COSTOS"],
      ["INFORME GERENCIAL CONSOLIDADO Y FLUJO DE CAJA"],
      [`Fecha de Consolidación: ${new Date().toLocaleDateString("es-CO")}`],
      [],
      ["1. RESUMEN FINANCIERO DEL PROYECTO (BOSQUE DE AGUA)"],
      ["Métrica Financiera", "Monto (COP)", "Detalle de Distribución"],
      ["Costo Directo Consolidado", directBudget, "Suma exacta de los 222 ítems de obra física"],
      ["Costos Indirectos (9.5% AI + 3% IVA/U)", totalBudget - directBudget, "Costos administrativos de operación de Constructora Serving S.A.S. (10.07%)"],
      ["Presupuesto Total Proyectado", totalBudget, "Costo Directo de Obra + Indirectos Totales"],
      [],
      ["2. ESTADÍSTICAS DEL MAPEO CON EL CRONOGRAMA"],
      ["Ítems de Obra Correlacionados", dataPoints.length, "Total de partidas físicas alineadas temporalmente"],
      ["Fecha de Inicio de Ejecución de Obra", dataPoints.length > 0 ? dataPoints[0].date : "2026-02-02", "Fecha de arranque de actividades según MS Project"],
      [],
      ["3. ANÁLISIS EJECUTIVO COMPLETO DE COSTOS (GENERADO POR IA)"],
      ["El siguiente informe gerencial analiza la coherencia temporal del presupuesto frente al cronograma de obra:"],
      []
    ];

    // Dividir las líneas del informe ejecutivo para agregarlas limpiamente a las filas de Excel
    const reportLines = String(analysis || "").split("\n");
    reportLines.forEach(line => {
      summaryRows.push([line.replace(/[\*\#\`\-\_]/g, "")]); // Limpiar formato Markdown básico para mejor legibilidad en celdas
    });

    const wsSummary = xlsx.utils.aoa_to_sheet(summaryRows);

    // Definir anchos de columna de la pestaña de resumen
    wsSummary["!cols"] = [
      { wch: 55 },
      { wch: 22 },
      { wch: 65 }
    ];

    xlsx.utils.book_append_sheet(wb, wsSummary, "Resumen Gerencial");

    // ===================================================
    // 2. PESTAÑA: DETALLE DE FLUJO DE CAJA MAPEADO (GRANULAR)
    // ===================================================
    const detailedData = dataPoints.map(dp => {
      const direct = dp.budget_required || 0;
      const total = direct * 1.1007; // Aplicar indirectos por ítem
      return {
        "Fecha de Inicio": dp.date,
        "Capítulo del Presupuesto": dp.chapter || "Otros",
        "Ítem de Obra / Actividad del Cronograma": dp.task_name,
        "Costo Directo (COP)": direct,
        "Costo con Indirectos (COP)": total
      };
    });

    const wsDetailed = xlsx.utils.json_to_sheet(detailedData);

    wsDetailed["!cols"] = [
      { wch: 15 },
      { wch: 35 },
      { wch: 60 },
      { wch: 22 },
      { wch: 22 }
    ];

    xlsx.utils.book_append_sheet(wb, wsDetailed, "Flujo de Caja Mapeado");

    // ===================================================
    // 3. PESTAÑA: FLUJO MENSUAL (PIVOT PLANO PARA GRÁFICOS)
    // ===================================================
    const monthlyTotals: { [key: string]: { direct: number; total: number } } = {};
    dataPoints.forEach(dp => {
      if (!dp.date) return;
      const monthKey = dp.date.slice(0, 7); // YYYY-MM
      if (!monthlyTotals[monthKey]) {
        monthlyTotals[monthKey] = { direct: 0, total: 0 };
      }
      const val = dp.budget_required || 0;
      monthlyTotals[monthKey].direct += val;
      monthlyTotals[monthKey].total += val * 1.1007;
    });

    const sortedMonths = Object.keys(monthlyTotals).sort();
    const monthlyData = sortedMonths.map(m => ({
      "Mes (Año-Mes)": m,
      "Costo Directo Mensual (COP)": monthlyTotals[m].direct,
      "Costo con Indirectos Mensual (COP)": monthlyTotals[m].total
    }));

    const wsMonthly = xlsx.utils.json_to_sheet(monthlyData);

    wsMonthly["!cols"] = [
      { wch: 20 },
      { wch: 30 },
      { wch: 30 }
    ];

    xlsx.utils.book_append_sheet(wb, wsMonthly, "Flujo de Caja Mensual");

    // Generar buffer binario de Excel
    const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

    // Retornar respuesta HTTP binaria
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="informe_flujo_caja_serving_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      }
    });

  } catch (error) {
    console.error("Error exportando informe a Excel:", error);
    return NextResponse.json(
      { error: "Error generando archivo de descarga: " + (error instanceof Error ? error.message : "desconocido") },
      { status: 500 }
    );
  }
}
