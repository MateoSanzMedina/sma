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

    const pyResponse = await fetch("http://localhost:8000/api/v1/payroll/generate/final", {
      method: "POST",
      body: pyFormData,
    });

    if (!pyResponse.ok) {
      throw new Error(`Error en el backend de Python: ${pyResponse.statusText}`);
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
