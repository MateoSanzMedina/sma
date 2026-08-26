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

    // 1. Intentar llamar al backend HTTP de Python (puerto 8000)
    try {
      const pyFormData = new FormData();
      pyFormData.append("file", file);

      console.log("Procesando costos en backend Python (http://localhost:8000)...");
      const pyResponse = await fetch("http://localhost:8000/api/v1/costs/process", {
        method: "POST",
        body: pyFormData,
        signal: AbortSignal.timeout(30000), // Timeout de 30s
      });

      if (pyResponse.ok) {
        const pyResult = await pyResponse.json();
        console.log("✅ Procesado con éxito en backend Python HTTP.");
        return NextResponse.json(pyResult);
      }
    } catch (pyErr) {
      console.warn("⚠️ Servidor HTTP Python no responde o dió timeout. Ejecutando motor Python CLI...", pyErr);
    }

    // 2. Si el servidor HTTP de Python no responde, ejecutar el motor Python directamente vía CLI
    console.log("Ejecutando motor de análisis Python en modo CLI directo...");
    const buffer = await file.arrayBuffer();
    const cliResult = await runPythonCostsCLI(buffer, file.name);

    if (cliResult && cliResult.data) {
      console.log("✅ Procesado con éxito vía motor Python CLI.");
      return NextResponse.json(cliResult);
    }

    return NextResponse.json(
      { error: "No se pudo procesar el archivo mediante el motor de Python." },
      { status: 500 }
    );

  } catch (error) {
    console.error("Error comparando costos en API route:", error);
    return NextResponse.json(
      { error: "Error interno en el procesamiento de costos: " + (error instanceof Error ? error.message : "Desconocido") },
      { status: 500 }
    );
  }
}
