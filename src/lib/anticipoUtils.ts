export interface AnticipoRule {
  chapterOrProcess: string;
  hasAnticipo: boolean;
  percentage: number; // e.g. 30%
  daysInAdvance: number; // e.g. 60 days
}

export function subtractDaysFromDate(dateStr: string, days: number): string {
  if (!dateStr) return dateStr;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  d.setDate(d.getDate() - days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function getCalendarDaysInRange(startDateStr: string, endDateStr: string): string[] {
  if (!startDateStr) return [];
  const startParts = startDateStr.split("-");
  if (startParts.length !== 3) return [startDateStr];

  const endParts = (endDateStr || startDateStr).split("-");
  const sYear = parseInt(startParts[0], 10);
  const sMonth = parseInt(startParts[1], 10) - 1;
  const sDay = parseInt(startParts[2], 10);

  const eYear = endParts.length === 3 ? parseInt(endParts[0], 10) : sYear;
  const eMonth = endParts.length === 3 ? parseInt(endParts[1], 10) - 1 : sMonth;
  const eDay = endParts.length === 3 ? parseInt(endParts[2], 10) : sDay;

  const current = new Date(sYear, sMonth, sDay);
  const end = new Date(eYear, eMonth, eDay);

  if (current > end) {
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, "0");
    const dd = String(current.getDate()).padStart(2, "0");
    return [`${yyyy}-${mm}-${dd}`];
  }

  const days: string[] = [];
  while (current <= end) {
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, "0");
    const dd = String(current.getDate()).padStart(2, "0");
    days.push(`${yyyy}-${mm}-${dd}`);
    current.setDate(current.getDate() + 1);
  }

  return days;
}

export function recalculateDistributedPoints(
  dataPoints: any[],
  rules: { [key: string]: AnticipoRule },
  defaultGlobalAnticipo = true,
  defaultPercentage = 30,
  defaultDays = 60
): any[] {
  const distributedDataPoints: any[] = [];

  dataPoints.forEach((dp) => {
    const isOrphan = dp.chapter === "Presupuesto Sin Asignar / Huérfano";
    const sDate = isOrphan ? "" : (dp.start_date || dp.date);
    const eDate = isOrphan ? "" : (dp.end_date || sDate);

    const calendarDays = isOrphan ? [] : getCalendarDaysInRange(sDate, eDate);
    const duration = calendarDays.length;
    const totalVal = dp.budget_required || 0;

    const chapterKey = dp.chapter || "Otros";
    const taskKey = dp.task_name || "";
    
    // Buscar regla específica para la tarea o capítulo
    const customRule = rules[taskKey] || rules[chapterKey];

    const hasAnticipo = customRule !== undefined ? customRule.hasAnticipo : defaultGlobalAnticipo;
    const pct = customRule !== undefined ? customRule.percentage : defaultPercentage;
    const days = customRule !== undefined ? customRule.daysInAdvance : defaultDays;

    if (hasAnticipo && !isOrphan && totalVal > 0 && sDate) {
      const anticipoRatio = Math.min(100, Math.max(0, pct)) / 100;
      const execRatio = 1 - anticipoRatio;

      const anticipoVal = totalVal * anticipoRatio;
      const execTotalVal = totalVal * execRatio;
      const dailyExecVal = duration > 0 ? execTotalVal / duration : 0;

      const anticipoDate = subtractDaysFromDate(sDate, days);

      // Punto de datos para el anticipo
      distributedDataPoints.push({
        date: anticipoDate,
        budget_required: anticipoVal,
        task_name: `[ANTICIPO ${pct}% - ${days}D] ${dp.task_name}`,
        chapter: chapterKey,
        budget_item_code: dp.budget_item_code || "",
        isAnticipo: true
      });

      // Puntos de datos para la ejecución física
      calendarDays.forEach((dayStr) => {
        distributedDataPoints.push({
          date: dayStr,
          budget_required: dailyExecVal,
          task_name: dp.task_name,
          chapter: chapterKey,
          budget_item_code: dp.budget_item_code || "",
        });
      });
    } else {
      // Sin anticipo: flujo 100% normal
      const dailyVal = duration > 0 ? totalVal / duration : 0;
      calendarDays.forEach((dayStr) => {
        distributedDataPoints.push({
          date: dayStr,
          budget_required: dailyVal,
          task_name: dp.task_name,
          chapter: chapterKey,
          budget_item_code: dp.budget_item_code || "",
        });
      });
    }
  });

  return distributedDataPoints;
}
