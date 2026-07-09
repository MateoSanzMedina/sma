import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const pyResponse = await fetch("http://localhost:8000/api/v1/payroll/templates", {
      method: "GET",
    });

    if (!pyResponse.ok) {
      throw new Error(`Error en el backend de Python: ${pyResponse.statusText}`);
    }

    const data = await pyResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error retrieving templates:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al obtener plantillas." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const type = formData.get("type");
    const file = formData.get("file");

    if (!type || !file) {
      return NextResponse.json({ error: "Faltan parámetros requeridos (type, file)." }, { status: 400 });
    }

    const pyFormData = new FormData();
    pyFormData.append("type", type);
    pyFormData.append("file", file);

    const pyResponse = await fetch("http://localhost:8000/api/v1/payroll/templates/upload", {
      method: "POST",
      body: pyFormData,
    });

    if (!pyResponse.ok) {
      throw new Error(`Error en el backend de Python: ${pyResponse.statusText}`);
    }

    const data = await pyResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error uploading template:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al actualizar la plantilla." },
      { status: 500 }
    );
  }
}
