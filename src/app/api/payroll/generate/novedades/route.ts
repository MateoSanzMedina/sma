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

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "https://sma-backend-m7ia.onrender.com";
    let pyResponse: Response;
    try {
      pyResponse = await fetch(`${backendUrl}/api/v1/payroll/generate/novedades`, {
        method: "POST",
        body: pyFormData,
        signal: AbortSignal.timeout(60000),
      });
    } catch (e) {
      console.error("Error conectando al backend de Python:", e);
      return NextResponse.json(
        { error: "El backend de Python está iniciando en la nube. Por favor intente nuevamente en unos segundos." },
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
        "Content-Disposition": "attachment; filename=PLANILLA_NOVEDADES_ARUS.xlsx",
      },
    });

  } catch (error) {
    console.error("Error generating ARUS Novedades in proxy:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al procesar novedades." },
      { status: 500 }
    );
  }
}
