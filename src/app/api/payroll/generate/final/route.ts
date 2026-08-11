import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const pyFormData = new FormData();
    
    const files = formData.getAll("files") as File[];
    if (files.length === 0) {
      return NextResponse.json({ error: "Debe subir al menos un archivo de informe." }, { status: 400 });
    }

    for (const file of files) {
      pyFormData.append("files", file);
    }

    let pyResponse: Response;
    try {
      pyResponse = await fetch("http://localhost:8000/api/v1/payroll/generate/final", {
        method: "POST",
        body: pyFormData,
      });
    } catch (e) {
      console.error("Error conectando al backend de Python en puerto 8000:", e);
      return NextResponse.json(
        { error: "El backend de Python en el puerto 8000 no está iniciado. Inicia el servidor ejecutando en la terminal: cd backend && python -m uvicorn app.main:app --port 8000" },
        { status: 503 }
      );
    }

    if (!pyResponse.ok) {
      const errJson = await pyResponse.json().catch(() => ({}));
      throw new Error(errJson.detail || `Error en el backend de Python: ${pyResponse.statusText}`);
    }

    const blob = await pyResponse.blob();
    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=Planilla_seguridad_social_final.xlsx",
      },
    });

  } catch (error) {
    console.error("Error generating final security planilla in proxy:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al procesar la planilla final." },
      { status: 500 }
    );
  }
}
