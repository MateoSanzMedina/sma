/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import * as xlsx from "xlsx";

function getWeekInfo(dateStr: string): { weekKey: string; weekLabel: string } {
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) {
    return { weekKey: dateStr, weekLabel: dateStr };
  }
  // Encontrar el lunes de la semana
  const day = d.getDay();
  const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const formatShort = (dt: Date) => {
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy}`;
  };

  const formatISO = (dt: Date) => {
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const startIso = formatISO(monday);
  const label = `Semana del ${formatShort(monday)} al ${formatShort(sunday)}`;

  return { weekKey: startIso, weekLabel: label };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { dataPoints, distributedDataPoints, analysis, directBudget, totalBudget } = body;

    if (!dataPoints || !Array.isArray(dataPoints)) {
      return NextResponse.json(
        { error: "Datos de flujo de caja no proporcionados para la descarga." },
        { status: 400 }
      );
    }

    const calcDirect = directBudget || dataPoints.reduce((acc, dp) => acc + (dp.budget_required || 0), 0);
    const calcTotal = totalBudget || calcDirect * 1.1007;

    // Crear un nuevo libro de trabajo (Workbook)
    const wb = xlsx.utils.book_new();

    // ===================================================
    // 1. PESTAÑA: RESUMEN GERENCIAL Y ANÁLISIS IA
    // ===================================================
    const summaryRows: any[][] = [
      ["CONSTRUCTORA SERVING S.A.S. — CONTROL Y DIRECCIÓN DE OBRAS"],
      ["INFORME GERENCIAL CONSOLIDADO DE FLUJO DE CAJA Y PROGRAMACIÓN"],
      [`Proyecto: Bosque de Agua  |  Fecha de Emisión: ${new Date().toLocaleDateString("es-CO")}`],
      [],
      ["1. RESUMEN EJECUTIVO Y MÉTRICAS FINANCIERAS"],
      ["Métrica Financiera", "Monto Consolidado (COP)", "% Participación", "Detalle de Distribución"],
      ["Costo Directo Consolidado", Math.round(calcDirect), "89.93%", "Suma de partidas físicas de obra"],
      ["Costos Indirectos (9.5% AI + 3% IVA/U)", Math.round(calcTotal - calcDirect), "10.07%", "Costos de administración, imprevistos y utilidad"],
      ["Presupuesto Total Proyectado", Math.round(calcTotal), "100.00%", "Costo Directo de Obra + Indirectos Totales"],
      [],
      ["2. RESUMEN DE COSTO DIRECTO POR CAPÍTULO DE OBRA"],
      ["Capítulo del Presupuesto", "Costo Directo (COP)", "Costo con Indirectos (COP)", "% del Total"]
    ];

    // Agrupar totales por Capítulo de Obra
    const chapterTotalsMap: { [key: string]: number } = {};
    dataPoints.forEach(dp => {
      const ch = dp.chapter || "Otros";
      chapterTotalsMap[ch] = (chapterTotalsMap[ch] || 0) + (dp.budget_required || 0);
    });

    const sortedChapters = Object.keys(chapterTotalsMap).sort((a, b) => chapterTotalsMap[b] - chapterTotalsMap[a]);
    sortedChapters.forEach(ch => {
      const valDirect = chapterTotalsMap[ch];
      const valTotal = valDirect * 1.1007;
      const pct = calcDirect > 0 ? (valDirect / calcDirect) * 100 : 0;
      summaryRows.push([
        ch,
        Math.round(valDirect),
        Math.round(valTotal),
        `${pct.toFixed(2)}%`
      ]);
    });

    summaryRows.push([]);
    summaryRows.push(["3. DIAGNÓSTICO Y CONCLUSIONES DE INTELIGENCIA ARTIFICIAL"]);
    summaryRows.push(["El siguiente informe analiza la coherencia temporal del presupuesto frente al cronograma de obra:"]);
    summaryRows.push([]);

    // Limpiar formato Markdown del informe de la IA
    const reportLines = String(analysis || "").split("\n");
    reportLines.forEach(line => {
      const cleanLine = line.replace(/[\*\#\`\_]/g, "").trim();
      if (cleanLine.startsWith("- ")) {
        summaryRows.push(["  • " + cleanLine.substring(2)]);
      } else if (cleanLine) {
        summaryRows.push([cleanLine]);
      } else {
        summaryRows.push([]);
      }
    });

    const wsSummary = xlsx.utils.aoa_to_sheet(summaryRows);
    wsSummary["!cols"] = [
      { wch: 55 },
      { wch: 28 },
      { wch: 28 },
      { wch: 55 }
    ];

    xlsx.utils.book_append_sheet(wb, wsSummary, "Resumen Gerencial");

    // ===================================================
    // 2. PESTAÑA: DETALLE DE FLUJO DE CAJA MAPEADO (ACTIVIDADES)
    // ===================================================
    const detailedRows: any[][] = [
      ["N°", "Código", "Capítulo", "Actividad / Ítem de Obra (MS Project)", "Fecha Inicio", "Fecha Fin", "Duración (Días)", "Costo Directo Total (COP)", "Costo con Indirectos (COP)", "Costo Diario Directo (COP)"]
    ];

    let totalDaysSum = 0;
    let totalDirectSum = 0;
    let totalIndirectSum = 0;

    dataPoints.forEach((dp, idx) => {
      const totalDirect = dp.budget_required || 0;
      const totalWithIndirect = totalDirect * 1.1007;
      const days = dp.working_days || 1;
      const dailyDirect = dp.daily_budget || (totalDirect / days);

      totalDaysSum += days;
      totalDirectSum += totalDirect;
      totalIndirectSum += totalWithIndirect;

      detailedRows.push([
        idx + 1,
        dp.budget_item_code || "sin_presupuesto",
        dp.chapter || "Otros",
        dp.task_name,
        dp.start_date || dp.date || "",
        dp.end_date || dp.date || "",
        days,
        Math.round(totalDirect),
        Math.round(totalWithIndirect),
        Math.round(dailyDirect)
      ]);
    });

    // Fila de Totales Consolidados
    detailedRows.push([
      "TOTALES",
      "",
      "",
      "SUMATORIA CONSOLIDADA DEL PROYECTO",
      "",
      "",
      totalDaysSum,
      Math.round(totalDirectSum),
      Math.round(totalIndirectSum),
      ""
    ]);

    const wsDetailed = xlsx.utils.aoa_to_sheet(detailedRows);
    wsDetailed["!cols"] = [
      { wch: 6 },  // N°
      { wch: 18 }, // Código
      { wch: 32 }, // Capítulo
      { wch: 60 }, // Actividad
      { wch: 14 }, // Fecha Inicio
      { wch: 14 }, // Fecha Fin
      { wch: 16 }, // Duración
      { wch: 26 }, // Costo Directo Total
      { wch: 26 }, // Costo con Indirectos
      { wch: 24 }  // Costo Diario
    ];

    xlsx.utils.book_append_sheet(wb, wsDetailed, "Flujo de Caja Mapeado");

    // ===================================================
    // 3. PESTAÑA: FLUJO DE CAJA SEMANAL (NUEVA PESTAÑA NATIVA)
    // ===================================================
    const weeklyTotalsMap: { [startIso: string]: { label: string; direct: number; total: number } } = {};
    const pointsForWeekly = (distributedDataPoints && distributedDataPoints.length > 0) ? distributedDataPoints : dataPoints;

    pointsForWeekly.forEach((dp: any) => {
      const dStr = dp.date || dp.start_date;
      if (!dStr) return;
      const { weekKey, weekLabel } = getWeekInfo(dStr);
      if (!weeklyTotalsMap[weekKey]) {
        weeklyTotalsMap[weekKey] = { label: weekLabel, direct: 0, total: 0 };
      }
      const val = dp.budget_required || 0;
      weeklyTotalsMap[weekKey].direct += val;
      weeklyTotalsMap[weekKey].total += val * 1.1007;
    });

    const sortedWeekKeys = Object.keys(weeklyTotalsMap).sort();
    let cumulativeWeeklyDirect = 0;
    let cumulativeWeeklyTotal = 0;

    const weeklyRows: any[][] = [
      ["N° Sem.", "Periodo Semanal (Lunes a Domingo)", "Costo Directo Semanal (COP)", "Costo con Indirectos Semanal (COP)", "Acumulado Directo (COP)", "Acumulado Total Proyectado (COP)", "% Avance Financiero"]
    ];

    sortedWeekKeys.forEach((wKey, idx) => {
      const item = weeklyTotalsMap[wKey];
      cumulativeWeeklyDirect += item.direct;
      cumulativeWeeklyTotal += item.total;
      const progressPct = calcTotal > 0 ? (cumulativeWeeklyTotal / calcTotal) * 100 : 0;

      weeklyRows.push([
        idx + 1,
        item.label,
        Math.round(item.direct),
        Math.round(item.total),
        Math.round(cumulativeWeeklyDirect),
        Math.round(cumulativeWeeklyTotal),
        `${progressPct.toFixed(2)}%`
      ]);
    });

    // Fila de Cierre Semanal
    weeklyRows.push([
      "TOTAL",
      "CONSOLIDADO TOTAL DEL PROYECTO",
      Math.round(cumulativeWeeklyDirect),
      Math.round(cumulativeWeeklyTotal),
      Math.round(cumulativeWeeklyDirect),
      Math.round(cumulativeWeeklyTotal),
      "100.00%"
    ]);

    const wsWeekly = xlsx.utils.aoa_to_sheet(weeklyRows);
    wsWeekly["!cols"] = [
      { wch: 8 },  // N° Sem
      { wch: 45 }, // Periodo Semanal
      { wch: 28 }, // Directo Semanal
      { wch: 32 }, // Indirectos Semanal
      { wch: 28 }, // Acumulado Directo
      { wch: 32 }, // Acumulado Total
      { wch: 22 }  // % Avance
    ];

    xlsx.utils.book_append_sheet(wb, wsWeekly, "Flujo de Caja Semanal");

    // ===================================================
    // 4. PESTAÑA: FLUJO DE CAJA MENSUAL
    // ===================================================
    const monthlyTotalsMap: { [key: string]: { direct: number; total: number } } = {};
    pointsForWeekly.forEach((dp: any) => {
      const dStr = dp.date || dp.start_date;
      if (!dStr) return;
      const monthKey = dStr.slice(0, 7); // YYYY-MM
      if (!monthlyTotalsMap[monthKey]) {
        monthlyTotalsMap[monthKey] = { direct: 0, total: 0 };
      }
      const val = dp.budget_required || 0;
      monthlyTotalsMap[monthKey].direct += val;
      monthlyTotalsMap[monthKey].total += val * 1.1007;
    });

    const sortedMonthKeys = Object.keys(monthlyTotalsMap).sort();
    let cumulativeMonthlyDirect = 0;
    let cumulativeMonthlyTotal = 0;

    const monthNames: { [k: string]: string } = {
      "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
      "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
      "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre"
    };

    const monthlyRows: any[][] = [
      ["N° Mes", "Periodo Mensual", "Costo Directo Mensual (COP)", "Costo con Indirectos Mensual (COP)", "Acumulado Total (COP)", "% Participación", "% Avance Financiero"]
    ];

    sortedMonthKeys.forEach((mKey, idx) => {
      const item = monthlyTotalsMap[mKey];
      cumulativeMonthlyDirect += item.direct;
      cumulativeMonthlyTotal += item.total;

      const [yyyy, mm] = mKey.split("-");
      const labelName = `${monthNames[mm] || mm} ${yyyy}`;
      const partPct = calcTotal > 0 ? (item.total / calcTotal) * 100 : 0;
      const progressPct = calcTotal > 0 ? (cumulativeMonthlyTotal / calcTotal) * 100 : 0;

      monthlyRows.push([
        idx + 1,
        labelName,
        Math.round(item.direct),
        Math.round(item.total),
        Math.round(cumulativeMonthlyTotal),
        `${partPct.toFixed(2)}%`,
        `${progressPct.toFixed(2)}%`
      ]);
    });

    // Fila de Cierre Mensual
    monthlyRows.push([
      "TOTAL",
      "CONSOLIDADO TOTAL PROYECTO",
      Math.round(cumulativeMonthlyDirect),
      Math.round(cumulativeMonthlyTotal),
      Math.round(cumulativeMonthlyTotal),
      "100.00%",
      "100.00%"
    ]);

    const wsMonthly = xlsx.utils.aoa_to_sheet(monthlyRows);
    wsMonthly["!cols"] = [
      { wch: 8 },  // N° Mes
      { wch: 25 }, // Periodo Mensual
      { wch: 28 }, // Directo Mensual
      { wch: 32 }, // Indirectos Mensual
      { wch: 28 }, // Acumulado Total
      { wch: 20 }, // % Participación
      { wch: 22 }  // % Avance
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

