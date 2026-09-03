import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";

const execFileAsync = promisify(execFile);

async function runPythonCostsCLI(fileBuffer: ArrayBuffer, fileName: string) {
  const tmpDir = os.tmpdir();
  const fileHash = Math.random().toString(36).substring(7);
  const tmpInputPath = path.join(tmpDir, `sao_input_${Date.now()}_${fileHash}.xlsx`);

  await fs.promises.writeFile(tmpInputPath, Buffer.from(fileBuffer));

  const backendDir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), "backend");
  const normalizedBackendDir = backendDir.replace(/\\/g, "/");
  const normalizedInputPath = tmpInputPath.replace(/\\/g, "/");
  const safeFileName = fileName.replace(/"/g, '\\"');

  const pyScriptCode = `
import asyncio, json, sys, os
sys.path.insert(0, r"${normalizedBackendDir}")
from app.services.costs_service import process_sao_costs

async def main():
    with open(r"${normalizedInputPath}", "rb") as f:
        content = f.read()
    res = await process_sao_costs(content, "${safeFileName}")
    print(json.dumps({
        "success": True,
        "data": res
    }))

if __name__ == "__main__":
    asyncio.run(main())
`;

  const pyTmpScript = path.join(tmpDir, `run_costs_${Date.now()}_${fileHash}.py`);
  await fs.promises.writeFile(pyTmpScript, pyScriptCode, "utf-8");

  try {
    const { stdout } = await execFileAsync("python", [pyTmpScript], {
      cwd: backendDir,
      maxBuffer: 50 * 1024 * 1024,
    });
    const parsed = JSON.parse(stdout);
    return parsed;
  } finally {
    for (const p of [tmpInputPath, tmpInputPath + ".bak", tmpInputPath + ".bak2", pyTmpScript]) {
      if (fs.existsSync(p)) {
        try { fs.unlinkSync(p); } catch {}
      }
    }
  }
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

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "https://sma-backend-m7ia.onrender.com";

    // 1. Intentar llamar al backend HTTP oficial en Render
    try {
      const pyFormData = new FormData();
      pyFormData.append("file", file);

      console.log(`Procesando costos en backend Python (${backendUrl}/api/v1/costs/process)...`);
      const pyResponse = await fetch(`${backendUrl}/api/v1/costs/process`, {
        method: "POST",
        body: pyFormData,
        signal: AbortSignal.timeout(60000),
      });

      if (pyResponse.ok) {
        const pyResult = await pyResponse.json();
        console.log("✅ Procesado con éxito en backend Python.");
        return NextResponse.json(pyResult);
      } else {
        const errData = await pyResponse.json().catch(() => ({}));
        return NextResponse.json(
          { error: errData.detail || "Error al procesar el archivo de costos en el servidor." },
          { status: pyResponse.status }
        );
      }
    } catch (pyErr) {
      console.warn("⚠️ Servidor HTTP Python en la nube no respondió o dió timeout.", pyErr);
    }

    // 2. Solo intentar CLI local en desarrollo (en Vercel no hay Python instalado)
    if (process.env.NODE_ENV !== "production") {
      try {
        console.log("Ejecutando motor de análisis Python en modo CLI local...");
        const buffer = await file.arrayBuffer();
        const cliResult = await runPythonCostsCLI(buffer, file.name);

        if (cliResult && cliResult.data) {
          return NextResponse.json(cliResult);
        }
      } catch (cliErr) {
        console.warn("CLI local falló:", cliErr);
      }
    }

    return NextResponse.json(
      { error: "El servidor de análisis en Render está iniciando (arranque en frío). Por favor intente nuevamente en 30 segundos." },
      { status: 503 }
    );

  } catch (error) {
    console.error("Error comparando costos en API route:", error);
    return NextResponse.json(
      { error: "Error al procesar el archivo: " + (error instanceof Error ? error.message : "Desconocido") },
      { status: 500 }
    );
  }
}
