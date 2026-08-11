import { NextRequest, NextResponse } from "next/server";
import * as xlsx from "xlsx";

function cleanNumeric(val: unknown): number {
  if (val === null || val === undefined) return 0.0;
  if (typeof val === "number") return val;
  const valStr = String(val).replace(/[^0-9.-]/g, "").trim();
  const parsed = parseFloat(valStr);
  return isNaN(parsed) ? 0.0 : parsed;
}

interface Resource {
  insumo: string;
  name: string;
  unit: string;
  base_qty: number;
  base_unit_qty: number;
  base_price: number;
  base_subtotal: number;
  ejec_qty: number;
  ejec_unit_qty: number;
  ejec_price: number;
  ejec_subtotal: number;
  excel_faltante_qty: number;
  excel_faltante_unit_qty: number;
  excel_faltante_price: number;
  excel_faltante_subtotal: number;
  proj_theo?: {
    qty: number;
    cost: number;
    dev_qty: number;
    dev_cost: number;
  };
  proj_hist?: {
    qty: number;
    cost: number;
    dev_qty: number;
    dev_cost: number;
  };
}

interface MaterialBalanceItem {
  apu_code: string;
  apu_name: string;
  qty: number;
}

interface CostAlert {
  type: "danger" | "warning";
  title: string;
  message: string;
  apu_code: string;
  insumo_code: string;
}

interface ReutilizationTip {
  insumo_code: string;
  insumo_name: string;
  unit: string;
  from_apu_code: string;
  from_apu_name: string;
  to_apu_code: string;
  to_apu_name: string;
  qty: number;
  message: string;
}

interface APUItem {
  code: string;
  name: string;
  unit: string;
  base_qty: number;
  ejec_qty: number;
  faltante_qty_teorica: number;
  obra_faltante_qty: number;
  resources: Resource[];
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "El archivo de costos de SAO es requerido." },
        { status: 400 }
      );
    }

    // 1. Llamar al backend de Python (puerto 8000) con timeout suficiente para procesamiento completo
    try {
      const pyFormData = new FormData();
      pyFormData.append("file", file);

      console.log("Procesando costos en el backend de Python (puerto 8000)...");
      const pyResponse = await fetch("http://localhost:8000/api/v1/costs/process", {
        method: "POST",
        body: pyFormData,
        signal: AbortSignal.timeout(20000), // Timeout extendido de 20s para archivos grandes
      });

      if (pyResponse.ok) {
        const pyResult = await pyResponse.json();
        console.log("✅ Procesado con éxito en el backend de Python (Cierre de Costos).");
        return NextResponse.json(pyResult);
      }
    } catch (pyErr) {
      console.warn("⚠️ Error o timeout conectando al backend de Python:", pyErr);
    }

    // 2. --- FALLBACK LOCAL DETALLES (XLSX en JS) ---
    const buffer = await file.arrayBuffer();
    const workbook = xlsx.read(buffer, { type: "array" });
    
    // Buscar pestaña adecuada
    let sheetName = workbook.SheetNames[0];
    for (const name of workbook.SheetNames) {
      const lowerName = name.toLowerCase();
      if (lowerName.includes("costos") || lowerName.includes("sao") || lowerName.includes("niveles") || lowerName.includes("apu")) {
        sheetName = name;
        break;
      }
    }

    const worksheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: "" });

    const apus: APUItem[] = [];
    let currentApu: APUItem | null = null;

    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const col0 = String(row[0] || "").trim();
      if (!col0 || col0 === "nan") continue;

      const cleanCode = col0.replace(/\.0$/, "").replace(/\./g, "").trim();
      if (!/^\d+$/.test(cleanCode)) continue;

      const insumoVal = String(row[1] || "").trim();
      const nombre = String(row[2] || "").trim();
      const unidad = String(row[3] || "").trim();

      if (!insumoVal || insumoVal === "nan" || insumoVal === "") {
        const baseQty = cleanNumeric(row[4]);
        const ejecQty = cleanNumeric(row[8]);
        const faltanteTeorico = cleanNumeric(row[12]);
        let obraFaltante = row.length > 16 ? cleanNumeric(row[16]) : faltanteTeorico;

        if (obraFaltante === 0.0 && faltanteTeorico > 0) {
          obraFaltante = faltanteTeorico;
        }

        currentApu = {
          code: cleanCode,
          name: nombre,
          unit: unidad,
          base_qty: baseQty,
          ejec_qty: ejecQty,
          faltante_qty_teorica: faltanteTeorico,
          obra_faltante_qty: obraFaltante,
          resources: []
        };
        apus.push(currentApu);
      }
      else if (insumoVal !== "99999" && !insumoVal.toLowerCase().includes("subtotal") && currentApu) {
        currentApu.resources.push({
          insumo: insumoVal.replace(/\.0$/, "").trim(),
          name: nombre,
          unit: unidad,
          base_qty: cleanNumeric(row[4]),
          base_unit_qty: cleanNumeric(row[5]),
          base_price: cleanNumeric(row[6]),
          base_subtotal: cleanNumeric(row[7]),
          ejec_qty: cleanNumeric(row[8]),
          ejec_unit_qty: cleanNumeric(row[9]),
          ejec_price: cleanNumeric(row[10]),
          ejec_subtotal: cleanNumeric(row[11]),
          excel_faltante_qty: cleanNumeric(row[12]),
          excel_faltante_unit_qty: cleanNumeric(row[13]),
          excel_faltante_price: cleanNumeric(row[14]),
          excel_faltante_subtotal: cleanNumeric(row[15])
        });
      }
    }

    const materialBalances: Record<
      string,
      {
        name: string;
        unit: string;
        surpluses: MaterialBalanceItem[];
        deficits: MaterialBalanceItem[];
      }
    > = {};
    const alerts: CostAlert[] = [];
    const reutilizaciones: ReutilizationTip[] = [];

    for (const apu of apus) {
      const qRem = apu.obra_faltante_qty;

      for (const res of apu.resources) {
        const insCode = res.insumo;

        const projTheoRemQty = qRem * res.base_unit_qty;
        const projTheoRemCost = projTheoRemQty * res.base_price;
        res.proj_theo = {
          qty: res.ejec_qty + projTheoRemQty,
          cost: (res.ejec_qty * res.ejec_price) + projTheoRemCost,
          dev_qty: (res.ejec_qty + projTheoRemQty) - res.base_qty,
          dev_cost: ((res.ejec_qty * res.ejec_price) + projTheoRemCost) - (res.base_qty * res.base_price)
        };

        const uProj = res.ejec_qty > 0 ? res.ejec_unit_qty : res.base_unit_qty;
        const pProj = res.ejec_qty > 0 ? res.ejec_price : res.base_price;
        const projHistRemQty = qRem * uProj;
        const projHistRemCost = projHistRemQty * pProj;
        res.proj_hist = {
          qty: res.ejec_qty + projHistRemQty,
          cost: (res.ejec_qty * res.ejec_price) + projHistRemCost,
          dev_qty: (res.ejec_qty + projHistRemQty) - res.base_qty,
          dev_cost: ((res.ejec_qty * res.ejec_price) + projHistRemCost) - (res.base_qty * res.base_price)
        };

        const devQty = res.proj_hist.dev_qty;
        if (Math.abs(devQty) > 0.01) {
          if (!materialBalances[insCode]) {
            materialBalances[insCode] = {
              name: res.name,
              unit: res.unit,
              surpluses: [],
              deficits: []
            };
          }

          if (devQty < 0) {
            materialBalances[insCode].surpluses.push({
              apu_code: apu.code,
              apu_name: apu.name,
              qty: Math.abs(devQty)
            });
          } else {
            materialBalances[insCode].deficits.push({
              apu_code: apu.code,
              apu_name: apu.name,
              qty: devQty
            });
          }
        }

        const devCost = res.proj_hist.dev_cost;
        const baseCost = res.base_qty * res.base_price;
        if (devCost > 500000) {
          const pct = baseCost > 0 ? (devCost / baseCost) * 100 : 100;
          alerts.push({
            type: "danger",
            title: "Sobrecosto Crítico en Insumo",
            message: `El insumo '${res.name}' en el APU '${apu.name}' proyecta un sobrecosto de ${pct.toFixed(1)}% (${devCost.toLocaleString("es-CO", { maximumFractionDigits: 0 })} COP) sobre la base.`,
            apu_code: apu.code,
            insumo_code: res.insumo
          });
        }

        if (res.ejec_qty > 0 && res.base_unit_qty > 0 && res.ejec_unit_qty > res.base_unit_qty * 1.15) {
          alerts.push({
            type: "warning",
            title: "Desviación de Rendimiento",
            message: `El rendimiento ejecutado de '${res.name}' en '${apu.name}' es un ${((res.ejec_unit_qty / res.base_unit_qty - 1) * 100).toFixed(1)}% superior al presupuesto base.`,
            apu_code: apu.code,
            insumo_code: res.insumo
          });
        }
      }
    }

    for (const [insCode, balance] of Object.entries(materialBalances)) {
      const surpluses = balance.surpluses;
      const deficits = balance.deficits;

      if (surpluses.length > 0 && deficits.length > 0) {
        for (const sur of surpluses) {
          for (const defic of deficits) {
            const matchedQty = Math.min(sur.qty, defic.qty);
            if (matchedQty > 0.01) {
              reutilizaciones.push({
                insumo_code: insCode,
                insumo_name: balance.name,
                unit: balance.unit,
                from_apu_code: sur.apu_code,
                from_apu_name: sur.apu_name,
                to_apu_code: defic.apu_code,
                to_apu_name: defic.apu_name,
                qty: matchedQty,
                message: `El material '${balance.name}' presenta un excedente de ${sur.qty.toFixed(1)} ${balance.unit} en '${sur.apu_name}'. Se recomienda reutilizar ${matchedQty.toFixed(1)} ${balance.unit} para cubrir el faltante en '${defic.apu_name}'.`
              });
              sur.qty -= matchedQty;
              defic.qty -= matchedQty;
            }
          }
        }
      }
    }

    let totalBase = 0;
    let totalEjec = 0;
    let totalProjTheo = 0;
    let totalProjHist = 0;

    for (const apu of apus) {
      for (const res of apu.resources) {
        totalBase += res.base_qty * res.base_price;
        totalEjec += res.ejec_qty * res.ejec_price;
        if (res.proj_theo) totalProjTheo += res.proj_theo.cost;
        if (res.proj_hist) totalProjHist += res.proj_hist.cost;
      }
    }

    const summary = {
      project_name: file.name.replace("Copia de V1 SAO Costos por niveles_", "").split(".")[0].replace(/_/g, " ").trim(),
      total_base: totalBase,
      total_ejec: totalEjec,
      total_proj_theo: totalProjTheo,
      total_proj_hist: totalProjHist,
      dev_proj_theo: totalProjTheo - totalBase,
      dev_proj_hist: totalProjHist - totalBase,
      total_items: apus.length,
      total_alerts: alerts.length,
      total_reutilizations: reutilizaciones.length
    };

    const excel_b64 = xlsx.write(workbook, { type: "base64", bookType: "xlsx" });

    return NextResponse.json({
      success: true,
      data: {
        summary,
        alerts,
        reutilizaciones,
        details: apus,
        excel_b64
      }
    });

  } catch (error) {
      console.error("Error comparando costos en Next.js local fallback:", error);
      return NextResponse.json(
        { error: "Error interno en el procesamiento de costos local: " + (error instanceof Error ? error.message : "Desconocido") },
        { status: 500 }
      );
  }
}
