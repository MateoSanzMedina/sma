/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from "next/server";
import * as xlsx from "xlsx";

function cleanNumeric(val: unknown): number {
  if (val === null || val === undefined) return 0.0;
  if (typeof val === "number") return val;
  const valStr = String(val).replace(/[^0-9.-]/g, "").trim();
  const parsed = parseFloat(valStr);
  return isNaN(parsed) ? 0.0 : parsed;
}

function findColumn(columns: string[], keywords: string[]): string | null {
  for (const col of columns) {
    const colStr = String(col).toLowerCase().trim();
    if (keywords.some(kw => colStr.includes(kw))) {
      return col;
    }
  }
  return null;
}

interface RecordData {
  name: string;
  ibc_salud: number;
  ibc_pension: number;
  ibc_arl: number;
  ibc_ccf: number;
  val_salud: number;
  val_pension: number;
  val_arl: number;
  val_ccf: number;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const siimedFile = formData.get("siimed") as File | null;
    const arusFile = formData.get("arus") as File | null;

    if (!siimedFile || !arusFile) {
      return NextResponse.json(
        { error: "Ambos archivos (SIIMED y ARUS) son requeridos." },
        { status: 400 }
      );
    }

    // Intentar procesar en el Backend Python primero (para conservar arquitectura distribuida)
    try {
      const pyFormData = new FormData();
      pyFormData.append("siimed", siimedFile);
      pyFormData.append("arus", arusFile);

      console.log("Intentando procesar en el backend de Python (puerto 8000)...");
      const pyResponse = await fetch("http://localhost:8000/api/v1/payroll/compare", {
        method: "POST",
        body: pyFormData,
        // Configurar un timeout corto para fallar rápido
        signal: AbortSignal.timeout(3000),
      });

      if (pyResponse.ok) {
        const pyResult = await pyResponse.json();
        console.log("✅ Procesado con éxito en el backend de Python.");
        return NextResponse.json(pyResult);
      }
    } catch (e) {
      console.warn("⚠️ El backend de Python en el puerto 8000 no respondió o arrojó un error. Procesando localmente en Next.js...");
    }

    // --- PROCESAMIENTO HÍBRIDO LOCAL (Next.js + XLSX) ---

    // 1. Leer SIIMED
    let dfSiimed: any[] = [];
    try {
      const siimedBuffer = await siimedFile.arrayBuffer();
      const workbook = xlsx.read(siimedBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      dfSiimed = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
    } catch (e) {
      console.error("Error al parsear el archivo SIIMED:", e);
    }

    // 2. Leer ARUS
    let dfArus: any[] = [];
    try {
      const arusBuffer = await arusFile.arrayBuffer();
      const workbook = xlsx.read(arusBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      dfArus = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
    } catch (e) {
      console.error("Error al parsear el archivo ARUS:", e);
    }

    const siimedColumns = dfSiimed.length > 0 ? Object.keys(dfSiimed[0]) : [];
    const arusColumns = dfArus.length > 0 ? Object.keys(dfArus[0]) : [];

    // Buscar identificadores y nombres
    const siimedIdCol = findColumn(siimedColumns, ["cedula", "documento", "identificacion", "nit", "cc", "nro_ident"]);
    const siimedNameCol = findColumn(siimedColumns, ["nombre", "empleado", "trabajador", "tercero"]);

    const arusIdCol = findColumn(arusColumns, ["cedula", "documento", "identificacion", "nit", "cc", "nro_ident"]);
    const arusNameCol = findColumn(arusColumns, ["nombre", "empleado", "trabajador", "cotizante"]);

    // Detección de columnas de IBC
    const siimedIbcSalud = findColumn(siimedColumns, ["ibc salud", "ibc_salud", "ibc de salud"]) || findColumn(siimedColumns, ["ibc"]);
    const siimedIbcPension = findColumn(siimedColumns, ["ibc pension", "ibc_pension", "ibc de pension"]) || siimedIbcSalud;
    const siimedIbcArl = findColumn(siimedColumns, ["ibc arl", "ibc_arl", "ibc de arl"]) || siimedIbcSalud;
    const siimedIbcCcf = findColumn(siimedColumns, ["ibc ccf", "ibc_ccf", "ibc caja", "ibc de caja"]) || siimedIbcSalud;

    const arusIbcSalud = findColumn(arusColumns, ["ibc salud", "ibc_salud", "ibc de salud"]) || findColumn(arusColumns, ["ibc"]);
    const arusIbcPension = findColumn(arusColumns, ["ibc pension", "ibc_pension", "ibc de pension"]) || arusIbcSalud;
    const arusIbcArl = findColumn(arusColumns, ["ibc arl", "ibc_arl", "ibc de arl"]) || arusIbcSalud;
    const arusIbcCcf = findColumn(arusColumns, ["ibc ccf", "ibc_ccf", "ibc caja", "ibc de caja"]) || arusIbcSalud;

    // Detección de columnas de aportes
    const siimedValSalud = findColumn(siimedColumns, ["salud", "aporte salud"]);
    const siimedValPension = findColumn(siimedColumns, ["pension", "aporte pension"]);
    const siimedValArl = findColumn(siimedColumns, ["arl", "aporte arl"]);
    const siimedValCcf = findColumn(siimedColumns, ["caja", "ccf", "compensacion"]);

    const arusValSalud = findColumn(arusColumns, ["salud", "aporte salud"]);
    const arusValPension = findColumn(arusColumns, ["pension", "aporte pension"]);
    const arusValArl = findColumn(arusColumns, ["arl", "aporte arl"]);
    const arusValCcf = findColumn(arusColumns, ["caja", "ccf", "compensacion"]);

    const isDemo = dfSiimed.length === 0 || dfArus.length === 0 || !siimedIdCol || !arusIdCol;

    if (isDemo) {
      // Retornar Mock Data de demostración limpia
      const employees = [
        { id: "1017234567", name: "SILVA ARIAS ANDREA", ibc_salud: 1300000, ibc_pension: 1300000, ibc_arl: 1300000, ibc_ccf: 1300000, salud: 52000, pension: 208000, arl: 6786, ccf: 52000 },
        { id: "1020444555", name: "RESTREPO VALENCIA LUIS", ibc_salud: 2500000, ibc_pension: 2500000, ibc_arl: 2500000, ibc_ccf: 2500000, salud: 100000, pension: 400000, arl: 13050, ccf: 100000 },
        { id: "39444198", name: "SILVA ANA CONSTANZA", ibc_salud: 4200000, ibc_pension: 4200000, ibc_arl: 4200000, ibc_ccf: 4200000, salud: 168000, pension: 672000, arl: 21924, ccf: 168000 },
        { id: "70555666", name: "GOMEZ MEJIA DANIEL", ibc_salud: 1850000, ibc_pension: 1850000, ibc_arl: 1850000, ibc_ccf: 1850000, salud: 74000, pension: 296000, arl: 9657, ccf: 74000 },
        { id: "1033222111", name: "PATIÑO RUIZ MANUELA", ibc_salud: 3100000, ibc_pension: 3100000, ibc_arl: 3100000, ibc_ccf: 3100000, salud: 124000, pension: 496000, arl: 16182, ccf: 124000 }
      ];

      const arusEmployees: Record<string, any> = {
        "1017234567": { ibc_salud: 1300000, ibc_pension: 1300000, ibc_arl: 1300000, ibc_ccf: 1300000, salud: 52000, pension: 208000, arl: 6786, ccf: 52000 },
        "1020444555": { ibc_salud: 2500000, ibc_pension: 2500000, ibc_arl: 2500000, ibc_ccf: 2500000, salud: 100000, pension: 400000, arl: 13050, ccf: 100000 },
        "39444198": { ibc_salud: 4000000, ibc_pension: 4000000, ibc_arl: 4000000, ibc_ccf: 4200000, salud: 160000, pension: 640000, arl: 20880, ccf: 168000 },
        "70555666": { ibc_salud: 1850000, ibc_pension: 1850000, ibc_arl: 1850000, ibc_ccf: 1850000, salud: 74000, pension: 296000, arl: 12000, ccf: 74000 }
      };

      const details = employees.map(emp => {
        const eid = emp.id;
        const sTotal = emp.salud + emp.pension + emp.arl + emp.ccf;
        const presentInArus = eid in arusEmployees;
        const aEmp = arusEmployees[eid] || { ibc_salud: 0, ibc_pension: 0, ibc_arl: 0, ibc_ccf: 0, salud: 0, pension: 0, arl: 0, ccf: 0 };
        const aTotal = aEmp.salud + aEmp.pension + aEmp.arl + aEmp.ccf;

        const hasDiff = 
          emp.ibc_salud !== aEmp.ibc_salud ||
          emp.ibc_pension !== aEmp.ibc_pension ||
          emp.ibc_arl !== aEmp.ibc_arl ||
          emp.ibc_ccf !== aEmp.ibc_ccf ||
          sTotal !== aTotal;

        return {
          id: eid,
          name: emp.name,
          present_in_siimed: true,
          present_in_arus: presentInArus,
          siimed: {
            ibc_salud: emp.ibc_salud,
            ibc_pension: emp.ibc_pension,
            ibc_arl: emp.ibc_arl,
            ibc_ccf: emp.ibc_ccf,
            val_salud: emp.salud,
            val_pension: emp.pension,
            val_arl: emp.arl,
            val_ccf: emp.ccf,
            total: sTotal
          },
          arus: {
            ibc_salud: aEmp.ibc_salud,
            ibc_pension: aEmp.ibc_pension,
            ibc_arl: aEmp.ibc_arl,
            ibc_ccf: aEmp.ibc_ccf,
            val_salud: aEmp.salud,
            val_pension: aEmp.pension,
            val_arl: aEmp.arl,
            val_ccf: aEmp.ccf,
            total: aTotal
          },
          diff: {
            ibc_salud: emp.ibc_salud - aEmp.ibc_salud,
            ibc_pension: emp.ibc_pension - aEmp.ibc_pension,
            ibc_arl: emp.ibc_arl - aEmp.ibc_arl,
            ibc_ccf: emp.ibc_ccf - aEmp.ibc_ccf,
            total: sTotal - aTotal
          },
          has_discrepancy: hasDiff
        };
      });

      const summary = {
        total_siimed: details.reduce((acc, r) => acc + r.siimed.total, 0),
        total_arus: details.reduce((acc, r) => acc + r.arus.total, 0),
        total_discrepancies: details.filter(r => r.has_discrepancy).length,
        cotizantes_siimed: details.length,
        cotizantes_arus: details.filter(r => r.present_in_arus).length,
        is_demo: true,
        message: "Cargado en Modo Demostración Local. Adjunte sus planillas 'Mayo S.S Conser' reales para configurar el mapeador definitivo."
      };

      return NextResponse.json({ success: true, data: { summary, details } });
    }

    // Procesar datos reales
    const siimedRecords: Record<string, RecordData> = {};
    dfSiimed.forEach((row: any) => {
      let eid = siimedIdCol ? String(row[siimedIdCol]).trim() : "";
      if (!eid || eid === "nan" || eid === "") return;
      
      // Limpiar decimales del id (cédula)
      if (eid.includes(".")) {
        eid = eid.split(".")[0];
      }

      const ibcSalud = siimedIbcSalud ? cleanNumeric(row[siimedIbcSalud]) : 0;
      const ibcPension = siimedIbcPension ? cleanNumeric(row[siimedIbcPension]) : ibcSalud;
      const ibcArl = siimedIbcArl ? cleanNumeric(row[siimedIbcArl]) : ibcSalud;
      const ibcCcf = siimedIbcCcf ? cleanNumeric(row[siimedIbcCcf]) : ibcSalud;

      const valSalud = siimedValSalud ? cleanNumeric(row[siimedValSalud]) : 0;
      const valPension = siimedValPension ? cleanNumeric(row[siimedValPension]) : 0;
      const valArl = siimedValArl ? cleanNumeric(row[siimedValArl]) : 0;
      const valCcf = siimedValCcf ? cleanNumeric(row[siimedValCcf]) : 0;

      const name = siimedNameCol ? String(row[siimedNameCol]).trim() : "Empleado SIIMED";

      if (siimedRecords[eid]) {
        siimedRecords[eid].ibc_salud += ibcSalud;
        siimedRecords[eid].ibc_pension += ibcPension;
        siimedRecords[eid].ibc_arl += ibcArl;
        siimedRecords[eid].ibc_ccf += ibcCcf;
        siimedRecords[eid].val_salud += valSalud;
        siimedRecords[eid].val_pension += valPension;
        siimedRecords[eid].val_arl += valArl;
        siimedRecords[eid].val_ccf += valCcf;
      } else {
        siimedRecords[eid] = {
          name,
          ibc_salud: ibcSalud,
          ibc_pension: ibcPension,
          ibc_arl: ibcArl,
          ibc_ccf: ibcCcf,
          val_salud: valSalud,
          val_pension: valPension,
          val_arl: valArl,
          val_ccf: valCcf
        };
      }
    });

    const arusRecords: Record<string, RecordData> = {};
    dfArus.forEach((row: any) => {
      let eid = arusIdCol ? String(row[arusIdCol]).trim() : "";
      if (!eid || eid === "nan" || eid === "") return;

      if (eid.includes(".")) {
        eid = eid.split(".")[0];
      }

      const ibcSalud = arusIbcSalud ? cleanNumeric(row[arusIbcSalud]) : 0;
      const ibcPension = arusIbcPension ? cleanNumeric(row[arusIbcPension]) : ibcSalud;
      const ibcArl = arusIbcArl ? cleanNumeric(row[arusIbcArl]) : ibcSalud;
      const ibcCcf = arusIbcCcf ? cleanNumeric(row[arusIbcCcf]) : ibcSalud;

      const valSalud = arusValSalud ? cleanNumeric(row[arusValSalud]) : 0;
      const valPension = arusValPension ? cleanNumeric(row[arusValPension]) : 0;
      const valArl = arusValArl ? cleanNumeric(row[arusValArl]) : 0;
      const valCcf = arusValCcf ? cleanNumeric(row[arusValCcf]) : 0;

      const name = arusNameCol ? String(row[arusNameCol]).trim() : "Cotizante ARUS";

      if (arusRecords[eid]) {
        arusRecords[eid].ibc_salud += ibcSalud;
        arusRecords[eid].ibc_pension += ibcPension;
        arusRecords[eid].ibc_arl += ibcArl;
        arusRecords[eid].ibc_ccf += ibcCcf;
        arusRecords[eid].val_salud += valSalud;
        arusRecords[eid].val_pension += valPension;
        arusRecords[eid].val_arl += valArl;
        arusRecords[eid].val_ccf += valCcf;
      } else {
        arusRecords[eid] = {
          name,
          ibc_salud: ibcSalud,
          ibc_pension: ibcPension,
          ibc_arl: ibcArl,
          ibc_ccf: ibcCcf,
          val_salud: valSalud,
          val_pension: valPension,
          val_arl: valArl,
          val_ccf: valCcf
        };
      }
    });

    const allIds = new Set([...Object.keys(siimedRecords), ...Object.keys(arusRecords)]);
    const details = Array.from(allIds).map(eid => {
      const inSiimed = eid in siimedRecords;
      const inArus = eid in arusRecords;

      const sRec = siimedRecords[eid] || {
        name: "No en SIIMED", ibc_salud: 0, ibc_pension: 0, ibc_arl: 0, ibc_ccf: 0,
        val_salud: 0, val_pension: 0, val_arl: 0, val_ccf: 0
      };
      const aRec = arusRecords[eid] || {
        name: "No en ARUS", ibc_salud: 0, ibc_pension: 0, ibc_arl: 0, ibc_ccf: 0,
        val_salud: 0, val_pension: 0, val_arl: 0, val_ccf: 0
      };

      const name = inSiimed ? sRec.name : aRec.name;
      const sTotal = sRec.val_salud + sRec.val_pension + sRec.val_arl + sRec.val_ccf;
      const aTotal = aRec.val_salud + aRec.val_pension + aRec.val_arl + aRec.val_ccf;

      const hasDiff = 
        Math.abs(sRec.ibc_salud - aRec.ibc_salud) > 1.0 ||
        Math.abs(sRec.ibc_pension - aRec.ibc_pension) > 1.0 ||
        Math.abs(sRec.ibc_arl - aRec.ibc_arl) > 1.0 ||
        Math.abs(sRec.ibc_ccf - aRec.ibc_ccf) > 1.0 ||
        Math.abs(sTotal - aTotal) > 1.0 ||
        (inSiimed !== inArus);

      return {
        id: eid,
        name,
        present_in_siimed: inSiimed,
        present_in_arus: inArus,
        siimed: {
          ibc_salud: sRec.ibc_salud,
          ibc_pension: sRec.ibc_pension,
          ibc_arl: sRec.ibc_arl,
          ibc_ccf: sRec.ibc_ccf,
          val_salud: sRec.val_salud,
          val_pension: sRec.val_pension,
          val_arl: sRec.val_arl,
          val_ccf: sRec.val_ccf,
          total: sTotal
        },
        arus: {
          ibc_salud: aRec.ibc_salud,
          ibc_pension: aRec.ibc_pension,
          ibc_arl: aRec.ibc_arl,
          ibc_ccf: aRec.ibc_ccf,
          val_salud: aRec.val_salud,
          val_pension: aRec.val_pension,
          val_arl: aRec.val_arl,
          val_ccf: aRec.val_ccf,
          total: aTotal
        },
        diff: {
          ibc_salud: sRec.ibc_salud - aRec.ibc_salud,
          ibc_pension: sRec.ibc_pension - aRec.ibc_pension,
          ibc_arl: sRec.ibc_arl - aRec.ibc_arl,
          ibc_ccf: sRec.ibc_ccf - aRec.ibc_ccf,
          total: sTotal - aTotal
        },
        has_discrepancy: hasDiff
      };
    });

    details.sort((a, b) => a.name.localeCompare(b.name));

    const summary = {
      total_siimed: details.reduce((acc, r) => acc + r.siimed.total, 0),
      total_arus: details.reduce((acc, r) => acc + r.arus.total, 0),
      total_discrepancies: details.filter(r => r.has_discrepancy).length,
      cotizantes_siimed: Object.keys(siimedRecords).length,
      cotizantes_arus: Object.keys(arusRecords).length,
      is_demo: false,
      message: "Planilla comparada exitosamente a partir de los datos reales cargados."
    };

    return NextResponse.json({ success: true, data: { summary, details } });

  } catch (error) {
    console.error("Error comparando planillas en Next.js Route:", error);
    return NextResponse.json(
      { error: "Error interno del servidor: " + (error instanceof Error ? error.message : "Desconocido") },
      { status: 500 }
    );
  }
}
