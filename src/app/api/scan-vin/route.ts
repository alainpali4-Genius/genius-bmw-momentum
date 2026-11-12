import { NextRequest, NextResponse } from "next/server";
import { scanVIN } from "@/ai/flows/scan-vin-flow";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    if (!process.env.GOOGLE_GENAI_API_KEY) {
      return NextResponse.json(
        { error: "Falta configurar GOOGLE_GENAI_API_KEY en las variables de entorno de Vercel." },
        { status: 503 }
      );
    }

    const body = await request.json();
    const photoDataUri = body?.photoDataUri;

    if (typeof photoDataUri !== "string" || !photoDataUri.startsWith("data:image/")) {
      return NextResponse.json({ error: "La fotografía no tiene un formato válido. Vuelve a hacer la foto." }, { status: 400 });
    }
    if (photoDataUri.length > 12_000_000) {
      return NextResponse.json({ error: "La imagen es demasiado grande. Inténtalo de nuevo acercando la cámara a la placa." }, { status: 413 });
    }

    const result = await scanVIN({ photoDataUri });
    if (!result?.vin) {
      return NextResponse.json({ error: "No se ha podido leer el bastidor. Prueba con más luz, enfoca la inscripción y evita reflejos." }, { status: 422 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[VIN_SCAN_ERROR]", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      { error: message.includes("API key") || message.includes("api key")
          ? "La clave de Gemini no está configurada correctamente en Vercel."
          : "Gemini no ha podido procesar la imagen. Comprueba la conexión e inténtalo de nuevo.",
        diagnostic: process.env.NODE_ENV === "development" ? message : undefined },
      { status: 500 }
    );
  }
}
