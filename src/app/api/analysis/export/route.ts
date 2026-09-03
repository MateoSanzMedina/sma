/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";

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
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy}`;
  };

  const formatISO = (dt: Date) => {
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const startIso = formatISO(monday);
  const label = `Semana del ${formatShort(monday)} al ${formatShort(sunday)}`;

  return { weekKey: startIso, weekLabel: label };
}

// Estilos y Paleta Corporativa Serving S.A.S.
const COLORS = {
  PRIMARY: "FF015C32",       // Verde Oscuro Serving
  PRIMARY_HOVER: "FF014224",
  PRIMARY_LIGHT: "FFE5F5E8", // Verde muy claro
  ACCENT: "FF11A542",        // Verde Brillante
  WARNING: "FFFF6600",       // Naranja
  DARK_GRAY: "FF1E293B",
  TEXT_MUTED: "FF64748B",
  LIGHT_GRAY: "FFF8FAFC",
  BORDER: "FFE2E8F0",
  BORDER_STRONG: "FFCBD5E1",
  WHITE: "FFFFFFFF",
};

const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: COLORS.BORDER } },
  left: { style: "thin", color: { argb: COLORS.BORDER } },
  bottom: { style: "thin", color: { argb: COLORS.BORDER } },
  right: { style: "thin", color: { argb: COLORS.BORDER } },
};

const BORDER_TOTAL: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: COLORS.PRIMARY } },
  bottom: { style: "double", color: { argb: COLORS.PRIMARY } },
  left: { style: "thin", color: { argb: COLORS.PRIMARY } },
  right: { style: "thin", color: { argb: COLORS.PRIMARY } },
};

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

    const calcDirect = directBudget || dataPoints.reduce((acc: number, dp: any) => acc + (dp.budget_required || 0), 0);
    const calcTotal = totalBudget || calcDirect * 1.1007;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Constructora Serving S.A.S. - SMA";
    workbook.created = new Date();

    // =========================================================================
    // 1. PESTAÑA: RESUMEN GERENCIAL Y ANÁLISIS IA
    // =========================================================================
    const ws1 = workbook.addWorksheet("Resumen Gerencial", {
      properties: { tabColor: { argb: COLORS.PRIMARY } },
      views: [{ showGridLines: true }],
    });

    ws1.columns = [
      { width: 42 }, // A: Concepto / Capítulo
      { width: 28 }, // B: Monto Directo
      { width: 28 }, // C: Monto Indirectos / Total
      { width: 18 }, // D: % Participación
      { width: 45 }, // E: Detalle / Descripción
    ];

    // Encabezado Corporativo
    ws1.mergeCells("A1:E1");
    const titleRow = ws1.getCell("A1");
    titleRow.value = "CONSTRUCTORA SERVING S.A.S. — CONTROL Y DIRECCIÓN DE OBRAS";
    titleRow.font = { name: "Arial", size: 13, bold: true, color: { argb: COLORS.WHITE } };
    titleRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.PRIMARY } };
    titleRow.alignment = { horizontal: "center", vertical: "middle" };
    ws1.getRow(1).height = 30;

    ws1.mergeCells("A2:E2");
    const subTitleRow = ws1.getCell("A2");
    subTitleRow.value = "INFORME GERENCIAL CONSOLIDADO DE FLUJO DE CAJA Y PROGRAMACIÓN DE OBRA";
    subTitleRow.font = { name: "Arial", size: 10, bold: true, color: { argb: COLORS.PRIMARY } };
    subTitleRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.PRIMARY_LIGHT } };
    subTitleRow.alignment = { horizontal: "center", vertical: "middle" };
    ws1.getRow(2).height = 22;

    ws1.mergeCells("A3:E3");
    const metaRow = ws1.getCell("A3");
    metaRow.value = `Proyecto: Bosque de Agua   |   Fecha de Emisión: ${new Date().toLocaleDateString("es-CO")}   |   Software: SMA Serving`;
    metaRow.font = { name: "Arial", size: 9, italic: true, color: { argb: COLORS.TEXT_MUTED } };
    metaRow.alignment = { horizontal: "center", vertical: "middle" };
    ws1.getRow(3).height = 18;

    // Sección 1: Métricas Financieras
    let currentRow = 5;
    ws1.mergeCells(`A${currentRow}:E${currentRow}`);
    const sec1 = ws1.getCell(`A${currentRow}`);
    sec1.value = "1. RESUMEN EJECUTIVO Y MÉTRICAS FINANCIERAS";
    sec1.font = { name: "Arial", size: 10, bold: true, color: { argb: COLORS.PRIMARY } };
    sec1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.PRIMARY_LIGHT } };
    ws1.getRow(currentRow).height = 22;

    currentRow++;
    const rMetricsHead = ws1.getRow(currentRow);
    rMetricsHead.values = ["Métrica Financiera", "Monto Consolidado (COP)", "% Participación", "Detalle de Distribución"];
    rMetricsHead.font = { name: "Arial", size: 9, bold: true, color: { argb: COLORS.WHITE } };
    rMetricsHead.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.PRIMARY } };
      c.alignment = { horizontal: "center", vertical: "middle" };
      c.border = BORDER_THIN;
    });
    rMetricsHead.height = 24;

    const metricsData = [
      ["Costo Directo Consolidado", Math.round(calcDirect), 0.8993, "Suma de todas las partidas y APUs de obra"],
      ["Costos Indirectos (9.5% AI + 3% IVA/U)", Math.round(calcTotal - calcDirect), 0.1007, "Administración, imprevistos y utilidad proyectada"],
      ["Presupuesto Total Proyectado", Math.round(calcTotal), 1.0, "Costo Directo + Indirectos Totales"],
    ];

    metricsData.forEach((item, idx) => {
      currentRow++;
      const row = ws1.getRow(currentRow);
      row.values = [item[0], item[1], item[2], item[3]];
      row.font = { name: "Arial", size: 9, bold: idx === 2 };
      row.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
      row.getCell(2).numFmt = '"$"#,##0';
      row.getCell(2).alignment = { horizontal: "right", vertical: "middle" };
      row.getCell(3).numFmt = "0.00%";
      row.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(4).alignment = { horizontal: "left", vertical: "middle" };

      if (idx === 2) {
        row.eachCell((c) => {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.PRIMARY_LIGHT } };
          c.border = BORDER_TOTAL;
        });
      } else {
        row.eachCell((c) => {
          c.border = BORDER_THIN;
          if (idx % 2 === 1) {
            c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.LIGHT_GRAY } };
          }
        });
      }
      row.height = 20;
    });

    // Sección 2: Capítulos de Obra
    currentRow += 2;
    ws1.mergeCells(`A${currentRow}:E${currentRow}`);
    const sec2 = ws1.getCell(`A${currentRow}`);
    sec2.value = "2. DISTRIBUCIÓN DE COSTOS POR CAPÍTULO DE OBRA";
    sec2.font = { name: "Arial", size: 10, bold: true, color: { argb: COLORS.PRIMARY } };
    sec2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.PRIMARY_LIGHT } };
    ws1.getRow(currentRow).height = 22;

    currentRow++;
    const rChapHead = ws1.getRow(currentRow);
    rChapHead.values = ["Capítulo de Presupuesto", "Costo Directo (COP)", "Costo con Indirectos (COP)", "% del Total", "Estado de Mapeo"];
    rChapHead.font = { name: "Arial", size: 9, bold: true, color: { argb: COLORS.WHITE } };
    rChapHead.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.PRIMARY } };
      c.alignment = { horizontal: "center", vertical: "middle" };
      c.border = BORDER_THIN;
    });
    rChapHead.height = 24;

    const chapterTotalsMap: { [key: string]: number } = {};
    dataPoints.forEach((dp: any) => {
      const ch = dp.chapter || "Otros";
      chapterTotalsMap[ch] = (chapterTotalsMap[ch] || 0) + (dp.budget_required || 0);
    });

    const sortedChapters = Object.keys(chapterTotalsMap).sort((a, b) => chapterTotalsMap[b] - chapterTotalsMap[a]);
    let sumChapDirect = 0;
    let sumChapTotal = 0;

    sortedChapters.forEach((ch, idx) => {
      currentRow++;
      const valDirect = chapterTotalsMap[ch];
      const valTotal = valDirect * 1.1007;
      const pct = calcDirect > 0 ? valDirect / calcDirect : 0;
      sumChapDirect += valDirect;
      sumChapTotal += valTotal;

      const row = ws1.getRow(currentRow);
      row.values = [ch, Math.round(valDirect), Math.round(valTotal), pct, "Correlacionado 100%"];
      row.font = { name: "Arial", size: 9 };
      row.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
      row.getCell(2).numFmt = '"$"#,##0';
      row.getCell(2).alignment = { horizontal: "right", vertical: "middle" };
      row.getCell(3).numFmt = '"$"#,##0';
      row.getCell(3).alignment = { horizontal: "right", vertical: "middle" };
      row.getCell(4).numFmt = "0.00%";
      row.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(5).alignment = { horizontal: "center", vertical: "middle" };

      row.eachCell((c) => {
        c.border = BORDER_THIN;
        if (idx % 2 === 1) {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.LIGHT_GRAY } };
        }
      });
      row.height = 19;
    });

    // Fila Total de Capítulos
    currentRow++;
    const rChapTot = ws1.getRow(currentRow);
    rChapTot.values = ["TOTAL PRESUPUESTO CAPÍTULOS", Math.round(sumChapDirect), Math.round(sumChapTotal), 1.0, "Consolidado"];
    rChapTot.font = { name: "Arial", size: 9, bold: true, color: { argb: COLORS.PRIMARY } };
    rChapTot.getCell(2).numFmt = '"$"#,##0';
    rChapTot.getCell(3).numFmt = '"$"#,##0';
    rChapTot.getCell(4).numFmt = "0.00%";
    rChapTot.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
    rChapTot.getCell(2).alignment = { horizontal: "right", vertical: "middle" };
    rChapTot.getCell(3).alignment = { horizontal: "right", vertical: "middle" };
    rChapTot.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
    rChapTot.getCell(5).alignment = { horizontal: "center", vertical: "middle" };
    rChapTot.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.PRIMARY_LIGHT } };
      c.border = BORDER_TOTAL;
    });
    rChapTot.height = 22;

    // Sección 3: Diagnóstico IA
    currentRow += 2;
    ws1.mergeCells(`A${currentRow}:E${currentRow}`);
    const sec3 = ws1.getCell(`A${currentRow}`);
    sec3.value = "3. DIAGNÓSTICO ESTRUCTURAL Y CONCLUSIONES DE INTELIGENCIA ARTIFICIAL";
    sec3.font = { name: "Arial", size: 10, bold: true, color: { argb: COLORS.PRIMARY } };
    sec3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.PRIMARY_LIGHT } };
    ws1.getRow(currentRow).height = 22;

    const reportLines = String(analysis || "").split("\n");
    reportLines.forEach((line) => {
      const cleanLine = line.replace(/[\*\#\`\_]/g, "").trim();
      if (!cleanLine) return;

      currentRow++;
      ws1.mergeCells(`A${currentRow}:E${currentRow}`);
      const textCell = ws1.getCell(`A${currentRow}`);

      if (cleanLine.startsWith("- ") || cleanLine.startsWith("• ")) {
        textCell.value = "   • " + cleanLine.replace(/^[-•]\s*/, "");
        textCell.font = { name: "Arial", size: 9, color: { argb: COLORS.DARK_GRAY } };
      } else if (cleanLine.includes(":") && cleanLine.length < 80) {
        textCell.value = cleanLine;
        textCell.font = { name: "Arial", size: 9, bold: true, color: { argb: COLORS.PRIMARY } };
      } else {
        textCell.value = cleanLine;
        textCell.font = { name: "Arial", size: 9, color: { argb: COLORS.DARK_GRAY } };
      }
      textCell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
      ws1.getRow(currentRow).height = 20;
    });

    // =========================================================================
    // 2. PESTAÑA: FLUJO DE CAJA SEMANAL
    // =========================================================================
    const ws2 = workbook.addWorksheet("Flujo Semanal", {
      properties: { tabColor: { argb: COLORS.ACCENT } },
      views: [{ state: "frozen", xSplit: 0, ySplit: 2, showGridLines: true }],
    });

    ws2.columns = [
      { width: 10 }, // A: N° Sem
      { width: 38 }, // B: Periodo Semanal
      { width: 26 }, // C: Costo Directo Semanal
      { width: 28 }, // D: Costo con Indirectos Semanal
      { width: 26 }, // E: Acumulado Directo
      { width: 28 }, // F: Acumulado Total Proyectado
      { width: 20 }, // G: % Avance Financiero
    ];

    ws2.mergeCells("A1:G1");
    const ws2Title = ws2.getCell("A1");
    ws2Title.value = "PROYECCIÓN DE DESEMBOLSOS Y FLUJO DE CAJA SEMANAL (LUNES A DOMINGO)";
    ws2Title.font = { name: "Arial", size: 10, bold: true, color: { argb: COLORS.WHITE } };
    ws2Title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.PRIMARY } };
    ws2Title.alignment = { horizontal: "center", vertical: "middle" };
    ws2.getRow(1).height = 26;

    const rWeeklyHead = ws2.getRow(2);
    rWeeklyHead.values = [
      "N° Sem.",
      "Periodo Semanal",
      "Costo Directo Semanal (COP)",
      "Costo con Indirectos (COP)",
      "Acumulado Directo (COP)",
      "Acumulado Total Proyectado",
      "% Avance Financiero",
    ];
    rWeeklyHead.font = { name: "Arial", size: 9, bold: true, color: { argb: COLORS.WHITE } };
    rWeeklyHead.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.ACCENT } };
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      c.border = BORDER_THIN;
    });
    rWeeklyHead.height = 28;

    const pointsForWeekly = distributedDataPoints && distributedDataPoints.length > 0 ? distributedDataPoints : dataPoints;
    const weeklyTotalsMap: { [startIso: string]: { label: string; direct: number; total: number } } = {};

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
    let cumWDirect = 0;
    let cumWTotal = 0;

    sortedWeekKeys.forEach((wKey, idx) => {
      const item = weeklyTotalsMap[wKey];
      cumWDirect += item.direct;
      cumWTotal += item.total;
      const progressPct = calcTotal > 0 ? cumWTotal / calcTotal : 0;

      const r = ws2.getRow(idx + 3);
      r.values = [
        idx + 1,
        item.label,
        Math.round(item.direct),
        Math.round(item.total),
        Math.round(cumWDirect),
        Math.round(cumWTotal),
        progressPct,
      ];
      r.font = { name: "Arial", size: 9 };
      r.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
      r.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
      r.getCell(3).numFmt = '"$"#,##0';
      r.getCell(3).alignment = { horizontal: "right", vertical: "middle" };
      r.getCell(4).numFmt = '"$"#,##0';
      r.getCell(4).alignment = { horizontal: "right", vertical: "middle" };
      r.getCell(5).numFmt = '"$"#,##0';
      r.getCell(5).alignment = { horizontal: "right", vertical: "middle" };
      r.getCell(6).numFmt = '"$"#,##0';
      r.getCell(6).alignment = { horizontal: "right", vertical: "middle" };
      r.getCell(7).numFmt = "0.00%";
      r.getCell(7).alignment = { horizontal: "center", vertical: "middle" };

      r.eachCell((c) => {
        c.border = BORDER_THIN;
        if (idx % 2 === 1) {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.LIGHT_GRAY } };
        }
      });
      r.height = 20;
    });

    // Fila Total Semanal
    const rTotWeek = ws2.getRow(sortedWeekKeys.length + 3);
    rTotWeek.values = [
      "TOTAL",
      "CONSOLIDADO TOTAL DEL PROYECTO",
      Math.round(cumWDirect),
      Math.round(cumWTotal),
      Math.round(cumWDirect),
      Math.round(cumWTotal),
      1.0,
    ];
    rTotWeek.font = { name: "Arial", size: 9, bold: true, color: { argb: COLORS.PRIMARY } };
    rTotWeek.getCell(3).numFmt = '"$"#,##0';
    rTotWeek.getCell(4).numFmt = '"$"#,##0';
    rTotWeek.getCell(5).numFmt = '"$"#,##0';
    rTotWeek.getCell(6).numFmt = '"$"#,##0';
    rTotWeek.getCell(7).numFmt = "0.00%";
    rTotWeek.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    rTotWeek.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
    rTotWeek.getCell(3).alignment = { horizontal: "right", vertical: "middle" };
    rTotWeek.getCell(4).alignment = { horizontal: "right", vertical: "middle" };
    rTotWeek.getCell(5).alignment = { horizontal: "right", vertical: "middle" };
    rTotWeek.getCell(6).alignment = { horizontal: "right", vertical: "middle" };
    rTotWeek.getCell(7).alignment = { horizontal: "center", vertical: "middle" };
    rTotWeek.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.PRIMARY_LIGHT } };
      c.border = BORDER_TOTAL;
    });
    rTotWeek.height = 24;

    // =========================================================================
    // 3. PESTAÑA: FLUJO DE CAJA MENSUAL
    // =========================================================================
    const ws3 = workbook.addWorksheet("Flujo Mensual", {
      properties: { tabColor: { argb: COLORS.WARNING } },
      views: [{ state: "frozen", xSplit: 0, ySplit: 2, showGridLines: true }],
    });

    ws3.columns = [
      { width: 10 }, // A: N° Mes
      { width: 28 }, // B: Periodo Mensual
      { width: 26 }, // C: Costo Directo Mensual
      { width: 28 }, // D: Costo con Indirectos
      { width: 28 }, // E: Acumulado Total Proyectado
      { width: 18 }, // F: % Participación Mensual
      { width: 22 }, // G: % Avance Financiero Curva S
    ];

    ws3.mergeCells("A1:G1");
    const ws3Title = ws3.getCell("A1");
    ws3Title.value = "PROYECCIÓN DE FLUJO DE CAJA MENSUAL CONSOLIDADO";
    ws3Title.font = { name: "Arial", size: 10, bold: true, color: { argb: COLORS.WHITE } };
    ws3Title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.PRIMARY } };
    ws3Title.alignment = { horizontal: "center", vertical: "middle" };
    ws3.getRow(1).height = 26;

    const rMonthHead = ws3.getRow(2);
    rMonthHead.values = [
      "N° Mes",
      "Periodo Mensual",
      "Costo Directo Mensual (COP)",
      "Costo con Indirectos (COP)",
      "Acumulado Total Proyectado",
      "% Participación",
      "% Avance Financiero",
    ];
    rMonthHead.font = { name: "Arial", size: 9, bold: true, color: { argb: COLORS.WHITE } };
    rMonthHead.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.PRIMARY } };
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      c.border = BORDER_THIN;
    });
    rMonthHead.height = 28;

    const monthlyTotalsMap: { [key: string]: { direct: number; total: number } } = {};
    pointsForWeekly.forEach((dp: any) => {
      const dStr = dp.date || dp.start_date;
      if (!dStr) return;
      const monthKey = dStr.slice(0, 7);
      if (!monthlyTotalsMap[monthKey]) {
        monthlyTotalsMap[monthKey] = { direct: 0, total: 0 };
      }
      const val = dp.budget_required || 0;
      monthlyTotalsMap[monthKey].direct += val;
      monthlyTotalsMap[monthKey].total += val * 1.1007;
    });

    const monthNames: { [k: string]: string } = {
      "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
      "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
      "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre"
    };

    const sortedMonthKeys = Object.keys(monthlyTotalsMap).sort();
    let cumMDirect = 0;
    let cumMTotal = 0;

    sortedMonthKeys.forEach((mKey, idx) => {
      const item = monthlyTotalsMap[mKey];
      cumMDirect += item.direct;
      cumMTotal += item.total;
      const [yyyy, mm] = mKey.split("-");
      const labelName = `${monthNames[mm] || mm} ${yyyy}`;
      const partPct = calcTotal > 0 ? item.total / calcTotal : 0;
      const progressPct = calcTotal > 0 ? cumMTotal / calcTotal : 0;

      const r = ws3.getRow(idx + 3);
      r.values = [
        idx + 1,
        labelName,
        Math.round(item.direct),
        Math.round(item.total),
        Math.round(cumMTotal),
        partPct,
        progressPct,
      ];
      r.font = { name: "Arial", size: 9 };
      r.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
      r.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
      r.getCell(3).numFmt = '"$"#,##0';
      r.getCell(3).alignment = { horizontal: "right", vertical: "middle" };
      r.getCell(4).numFmt = '"$"#,##0';
      r.getCell(4).alignment = { horizontal: "right", vertical: "middle" };
      r.getCell(5).numFmt = '"$"#,##0';
      r.getCell(5).alignment = { horizontal: "right", vertical: "middle" };
      r.getCell(6).numFmt = "0.00%";
      r.getCell(6).alignment = { horizontal: "center", vertical: "middle" };
      r.getCell(7).numFmt = "0.00%";
      r.getCell(7).alignment = { horizontal: "center", vertical: "middle" };

      r.eachCell((c) => {
        c.border = BORDER_THIN;
        if (idx % 2 === 1) {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.LIGHT_GRAY } };
        }
      });
      r.height = 20;
    });

    // Fila Total Mensual
    const rTotMonth = ws3.getRow(sortedMonthKeys.length + 3);
    rTotMonth.values = [
      "TOTAL",
      "CONSOLIDADO TOTAL DEL PROYECTO",
      Math.round(cumMDirect),
      Math.round(cumMTotal),
      Math.round(cumMTotal),
      1.0,
      1.0,
    ];
    rTotMonth.font = { name: "Arial", size: 9, bold: true, color: { argb: COLORS.PRIMARY } };
    rTotMonth.getCell(3).numFmt = '"$"#,##0';
    rTotMonth.getCell(4).numFmt = '"$"#,##0';
    rTotMonth.getCell(5).numFmt = '"$"#,##0';
    rTotMonth.getCell(6).numFmt = "0.00%";
    rTotMonth.getCell(7).numFmt = "0.00%";
    rTotMonth.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    rTotMonth.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
    rTotMonth.getCell(3).alignment = { horizontal: "right", vertical: "middle" };
    rTotMonth.getCell(4).alignment = { horizontal: "right", vertical: "middle" };
    rTotMonth.getCell(5).alignment = { horizontal: "right", vertical: "middle" };
    rTotMonth.getCell(6).alignment = { horizontal: "center", vertical: "middle" };
    rTotMonth.getCell(7).alignment = { horizontal: "center", vertical: "middle" };
    rTotMonth.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.PRIMARY_LIGHT } };
      c.border = BORDER_TOTAL;
    });
    rTotMonth.height = 24;

    // =========================================================================
    // 4. PESTAÑA: DETALLE DE FLUJO DE CAJA MAPEADO (ACTIVIDADES)
    // =========================================================================
    const ws4 = workbook.addWorksheet("Flujo Mapeado Detalle", {
      properties: { tabColor: { argb: COLORS.PRIMARY } },
      views: [{ state: "frozen", xSplit: 0, ySplit: 2, showGridLines: true }],
    });

    ws4.columns = [
      { width: 8 },  // A: N°
      { width: 20 }, // B: Código Ítem Presupuesto
      { width: 30 }, // C: Capítulo
      { width: 45 }, // D: Descripción Ítem Presupuesto (APU)
      { width: 45 }, // E: Actividad / Tarea Cronograma (MS Project)
      { width: 14 }, // F: Fecha Inicio
      { width: 14 }, // G: Fecha Fin
      { width: 16 }, // H: Duración (Días)
      { width: 26 }, // I: Costo Directo Total
      { width: 26 }, // J: Costo con Indirectos
      { width: 24 }, // K: Costo Diario Directo
    ];

    ws4.mergeCells("A1:K1");
    const ws4Title = ws4.getCell("A1");
    ws4Title.value = "CORRELACIÓN DETALLADA DE ACTIVIDADES (MS PROJECT) CON ÍTEMS DE PRESUPUESTO";
    ws4Title.font = { name: "Arial", size: 10, bold: true, color: { argb: COLORS.WHITE } };
    ws4Title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.PRIMARY } };
    ws4Title.alignment = { horizontal: "center", vertical: "middle" };
    ws4.getRow(1).height = 26;

    const rDetHead = ws4.getRow(2);
    rDetHead.values = [
      "N°",
      "Código Ítem",
      "Capítulo de Obra",
      "Descripción Ítem Presupuesto (APU)",
      "Actividad / Ítem Cronograma (MS Project)",
      "Fecha Inicio",
      "Fecha Fin",
      "Duración (Días)",
      "Costo Directo Total (COP)",
      "Costo con Indirectos (COP)",
      "Costo Diario Directo (COP)",
    ];
    rDetHead.font = { name: "Arial", size: 9, bold: true, color: { argb: COLORS.WHITE } };
    rDetHead.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.PRIMARY } };
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      c.border = BORDER_THIN;
    });
    rDetHead.height = 28;

    let totDays = 0;
    let totDir = 0;
    let totInd = 0;

    dataPoints.forEach((dp: any, idx: number) => {
      const directVal = dp.budget_required || 0;
      const totalWithInd = directVal * 1.1007;
      const days = dp.working_days || 1;
      const dailyVal = dp.daily_budget || (directVal / days);

      totDays += days;
      totDir += directVal;
      totInd += totalWithInd;

      const r = ws4.getRow(idx + 3);
      r.values = [
        idx + 1,
        dp.budget_item_code || "SIN_CÓDIGO",
        dp.chapter || "Otros",
        dp.budget_item_desc || dp.task_name || "",
        dp.task_name || "",
        dp.start_date || dp.date || "",
        dp.end_date || dp.date || "",
        days,
        Math.round(directVal),
        Math.round(totalWithInd),
        Math.round(dailyVal),
      ];
      r.font = { name: "Arial", size: 9 };
      r.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
      r.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
      r.getCell(3).alignment = { horizontal: "left", vertical: "middle" };
      r.getCell(4).alignment = { horizontal: "left", vertical: "middle" };
      r.getCell(5).alignment = { horizontal: "left", vertical: "middle" };
      r.getCell(6).alignment = { horizontal: "center", vertical: "middle" };
      r.getCell(7).alignment = { horizontal: "center", vertical: "middle" };
      r.getCell(8).alignment = { horizontal: "center", vertical: "middle" };
      r.getCell(9).numFmt = '"$"#,##0';
      r.getCell(9).alignment = { horizontal: "right", vertical: "middle" };
      r.getCell(10).numFmt = '"$"#,##0';
      r.getCell(10).alignment = { horizontal: "right", vertical: "middle" };
      r.getCell(11).numFmt = '"$"#,##0';
      r.getCell(11).alignment = { horizontal: "right", vertical: "middle" };

      r.eachCell((c) => {
        c.border = BORDER_THIN;
        if (idx % 2 === 1) {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.LIGHT_GRAY } };
        }
      });
      r.height = 19;
    });

    // Fila Total de Actividades
    const rTotDet = ws4.getRow(dataPoints.length + 3);
    rTotDet.values = [
      "TOTAL",
      "",
      "",
      "",
      "SUMATORIA CONSOLIDADA DE ACTIVIDADES",
      "",
      "",
      totDays,
      Math.round(totDir),
      Math.round(totInd),
      "",
    ];
    rTotDet.font = { name: "Arial", size: 9, bold: true, color: { argb: COLORS.PRIMARY } };
    rTotDet.getCell(9).numFmt = '"$"#,##0';
    rTotDet.getCell(10).numFmt = '"$"#,##0';
    rTotDet.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    rTotDet.getCell(5).alignment = { horizontal: "left", vertical: "middle" };
    rTotDet.getCell(8).alignment = { horizontal: "center", vertical: "middle" };
    rTotDet.getCell(9).alignment = { horizontal: "right", vertical: "middle" };
    rTotDet.getCell(10).alignment = { horizontal: "right", vertical: "middle" };
    rTotDet.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.PRIMARY_LIGHT } };
      c.border = BORDER_TOTAL;
    });
    rTotDet.height = 24;

    // =========================================================================
    // 5. PESTAÑA: MATRIZ DE CORRELACIÓN ÍTEM A ÍTEM (JERARQUÍA POR PRESUPUESTO)
    // =========================================================================
    const ws5 = workbook.addWorksheet("Matriz Correlación Ítems", {
      properties: { tabColor: { argb: COLORS.ACCENT } },
      views: [{ state: "frozen", xSplit: 0, ySplit: 2, showGridLines: true }],
    });

    ws5.columns = [
      { width: 18 }, // A: Código Ítem / Jerarquía
      { width: 28 }, // B: Capítulo de Obra
      { width: 50 }, // C: Partida de Presupuesto (APU) / Actividad Cronograma
      { width: 22 }, // D: Nivel / Tipo de Registro
      { width: 26 }, // E: Periodo (Inicio - Fin)
      { width: 14 }, // F: Días
      { width: 24 }, // G: Presupuesto Directo (COP)
      { width: 16 }, // H: % Participación
      { width: 22 }, // I: Costo Diario (COP)
    ];

    ws5.mergeCells("A1:I1");
    const ws5Title = ws5.getCell("A1");
    ws5Title.value = "MATRIZ DE CORRELACIÓN JERÁRQUICA: CAPÍTULOS ↔ PARTIDAS DE PRESUPUESTO ↔ ACTIVIDADES MS PROJECT";
    ws5Title.font = { name: "Arial", size: 10, bold: true, color: { argb: COLORS.WHITE } };
    ws5Title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.PRIMARY } };
    ws5Title.alignment = { horizontal: "center", vertical: "middle" };
    ws5.getRow(1).height = 26;

    const rCorrHead = ws5.getRow(2);
    rCorrHead.values = [
      "Código",
      "Capítulo de Obra",
      "Partida Presupuestal (APU) / Tarea Cronograma",
      "Nivel / Tipo",
      "Periodo de Ejecución",
      "Días",
      "Costo Directo (COP)",
      "% Participación",
      "Costo Diario (COP)",
    ];
    rCorrHead.font = { name: "Arial", size: 9, bold: true, color: { argb: COLORS.WHITE } };
    rCorrHead.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.ACCENT } };
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      c.border = BORDER_THIN;
    });
    rCorrHead.height = 28;

    // Agrupar por Capítulo -> Luego por Código/Partida de Presupuesto
    interface ChapterGroup {
      chapterName: string;
      totalBudget: number;
      budgetItems: Map<string, {
        code: string;
        desc: string;
        total: number;
        tasks: any[];
        minStart: string;
        maxEnd: string;
        totalDays: number;
      }>;
    }

    const chapterHierMap = new Map<string, ChapterGroup>();

    dataPoints.forEach((dp: any, dpIdx: number) => {
      const ch = dp.chapter || "Otros";
      // Si el código no existe o es genérico, diferenciar por nombre de tarea para que nunca se amontonen
      const rawCode = String(dp.budget_item_code || "").trim();
      const code = rawCode && rawCode !== "sin_codigo" && rawCode !== "SIN_CÓDIGO"
        ? rawCode
        : `ITEM-${String(dpIdx + 1).padStart(3, "0")}`;

      const desc = dp.budget_item_desc || dp.task_name || `Partida ${code}`;
      const sDate = dp.start_date || dp.date || "";
      const eDate = dp.end_date || sDate;
      const days = dp.working_days || 1;
      const val = dp.budget_required || 0;

      if (!chapterHierMap.has(ch)) {
        chapterHierMap.set(ch, {
          chapterName: ch,
          totalBudget: 0,
          budgetItems: new Map(),
        });
      }

      const chapObj = chapterHierMap.get(ch)!;
      chapObj.totalBudget += val;

      if (!chapObj.budgetItems.has(code)) {
        chapObj.budgetItems.set(code, {
          code,
          desc,
          total: 0,
          tasks: [],
          minStart: sDate,
          maxEnd: eDate,
          totalDays: 0,
        });
      }

      const itemObj = chapObj.budgetItems.get(code)!;
      itemObj.total += val;
      itemObj.totalDays += days;
      itemObj.tasks.push(dp);
      if (sDate && (!itemObj.minStart || sDate < itemObj.minStart)) itemObj.minStart = sDate;
      if (eDate && (!itemObj.maxEnd || eDate > itemObj.maxEnd)) itemObj.maxEnd = eDate;
    });

    let ws5CurrentRow = 3;
    let totalDirectProcessed = 0;

    // Iterar capítulos ordenados por mayor presupuesto
    const sortedChaptersList = Array.from(chapterHierMap.values()).sort((a, b) => b.totalBudget - a.totalBudget);

    sortedChaptersList.forEach((chap) => {
      // 1. FILA DE CAPÍTULO
      const rChap = ws5.getRow(ws5CurrentRow);
      const chapPct = calcDirect > 0 ? chap.totalBudget / calcDirect : 0;
      rChap.values = [
        "CAPÍTULO",
        chap.chapterName,
        `CONSOLIDADO: ${chap.chapterName.toUpperCase()}`,
        "CAPÍTULO",
        "",
        "",
        Math.round(chap.totalBudget),
        chapPct,
        "",
      ];
      rChap.font = { name: "Arial", size: 9, bold: true, color: { argb: COLORS.WHITE } };
      rChap.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
      rChap.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
      rChap.getCell(3).alignment = { horizontal: "left", vertical: "middle" };
      rChap.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
      rChap.getCell(7).numFmt = '"$"#,##0';
      rChap.getCell(7).alignment = { horizontal: "right", vertical: "middle" };
      rChap.getCell(8).numFmt = "0.00%";
      rChap.getCell(8).alignment = { horizontal: "center", vertical: "middle" };
      rChap.eachCell((c) => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.PRIMARY } };
        c.border = BORDER_THIN;
      });
      rChap.height = 24;
      ws5CurrentRow++;

      // 2. ITERAR PARTIDAS / APUS DEL CAPÍTULO
      const sortedAPUs = Array.from(chap.budgetItems.values()).sort((a, b) => b.total - a.total);

      sortedAPUs.forEach((apu) => {
        const apuPct = calcDirect > 0 ? apu.total / calcDirect : 0;
        const apuDaily = apu.totalDays > 0 ? apu.total / apu.totalDays : apu.total;
        const periodStr = apu.minStart && apu.maxEnd ? `${apu.minStart} → ${apu.maxEnd}` : "N/A";

        // Fila de Partida / APU
        const rAPU = ws5.getRow(ws5CurrentRow);
        rAPU.values = [
          apu.code,
          chap.chapterName,
          apu.desc,
          `PARTIDA APU (${apu.tasks.length} ${apu.tasks.length === 1 ? "tarea" : "tareas"})`,
          periodStr,
          apu.totalDays,
          Math.round(apu.total),
          apuPct,
          Math.round(apuDaily),
        ];
        rAPU.font = { name: "Arial", size: 9, bold: true, color: { argb: COLORS.PRIMARY } };
        rAPU.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
        rAPU.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
        rAPU.getCell(3).alignment = { horizontal: "left", vertical: "middle" };
        rAPU.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
        rAPU.getCell(5).alignment = { horizontal: "center", vertical: "middle" };
        rAPU.getCell(6).alignment = { horizontal: "center", vertical: "middle" };
        rAPU.getCell(7).numFmt = '"$"#,##0';
        rAPU.getCell(7).alignment = { horizontal: "right", vertical: "middle" };
        rAPU.getCell(8).numFmt = "0.00%";
        rAPU.getCell(8).alignment = { horizontal: "center", vertical: "middle" };
        rAPU.getCell(9).numFmt = '"$"#,##0';
        rAPU.getCell(9).alignment = { horizontal: "right", vertical: "middle" };
        rAPU.eachCell((c) => {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.PRIMARY_LIGHT } };
          c.border = BORDER_THIN;
        });
        rAPU.height = 22;
        ws5CurrentRow++;

        // 3. FILAS HIJAS: TAREAS ESPECÍFICAS DE CRONOGRAMA VINCULADAS
        apu.tasks.forEach((task: any, tIdx: number) => {
          totalDirectProcessed += (task.budget_required || 0);
          const tDays = task.working_days || 1;
          const tVal = task.budget_required || 0;
          const tDaily = task.daily_budget || (tDays > 0 ? tVal / tDays : tVal);
          const tPct = calcDirect > 0 ? tVal / calcDirect : 0;
          const isPrereq = String(task.task_name || "").startsWith("[PRERREQUISITO");

          const rTask = ws5.getRow(ws5CurrentRow);
          rTask.values = [
            `   ↳ ${apu.code}.${tIdx + 1}`,
            chap.chapterName,
            task.task_name,
            isPrereq ? "PRERREQUISITO" : "TAREA CRONOGRAMA",
            `${task.start_date || task.date || ""} → ${task.end_date || task.date || ""}`,
            tDays,
            Math.round(tVal),
            tPct,
            Math.round(tDaily),
          ];
          rTask.font = { name: "Arial", size: 8.5 };
          rTask.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
          rTask.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
          rTask.getCell(3).alignment = { horizontal: "left", vertical: "middle" };
          rTask.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
          rTask.getCell(5).alignment = { horizontal: "center", vertical: "middle" };
          rTask.getCell(6).alignment = { horizontal: "center", vertical: "middle" };
          rTask.getCell(7).numFmt = '"$"#,##0';
          rTask.getCell(7).alignment = { horizontal: "right", vertical: "middle" };
          rTask.getCell(8).numFmt = "0.00%";
          rTask.getCell(8).alignment = { horizontal: "center", vertical: "middle" };
          rTask.getCell(9).numFmt = '"$"#,##0';
          rTask.getCell(9).alignment = { horizontal: "right", vertical: "middle" };

          rTask.eachCell((c) => {
            c.border = BORDER_THIN;
            if (tIdx % 2 === 1) {
              c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.LIGHT_GRAY } };
            }
          });
          rTask.height = 19;
          ws5CurrentRow++;
        });
      });
    });

    // Fila Total Matriz Correlación
    const rTotCorr = ws5.getRow(ws5CurrentRow);
    rTotCorr.values = [
      "TOTAL",
      "",
      "TOTAL CONSOLIDADO PARTIDAS Y ACTIVIDADES",
      "CONSOLIDADO",
      "",
      "",
      Math.round(totalDirectProcessed || calcDirect),
      1.0,
      "",
    ];
    rTotCorr.font = { name: "Arial", size: 9, bold: true, color: { argb: COLORS.PRIMARY } };
    rTotCorr.getCell(7).numFmt = '"$"#,##0';
    rTotCorr.getCell(8).numFmt = "0.00%";
    rTotCorr.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    rTotCorr.getCell(3).alignment = { horizontal: "left", vertical: "middle" };
    rTotCorr.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
    rTotCorr.getCell(7).alignment = { horizontal: "right", vertical: "middle" };
    rTotCorr.getCell(8).alignment = { horizontal: "center", vertical: "middle" };
    rTotCorr.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.PRIMARY_LIGHT } };
      c.border = BORDER_TOTAL;
    });
    rTotCorr.height = 24;

    // Generar buffer XLSX con ExcelJS
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="informe_flujo_caja_serving_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Error exportando informe a Excel:", error);
    return NextResponse.json(
      { error: "Error generando archivo de descarga: " + (error instanceof Error ? error.message : "desconocido") },
      { status: 500 }
    );
  }
}

