import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const cleanVin = (value: unknown) =>
  typeof value === "string"
    ? value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "")
    : "";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "No hay una clave Gemini disponible en el servidor. Comprueba GEMINI_API_KEY en Vercel." },
        { status: 503 }
      );
    }

    const body = await request.json();
    const photoDataUri = body?.photoDataUri;
    if (typeof photoDataUri !== "string" || !photoDataUri.startsWith("data:image/")) {
      return NextResponse.json({ error: "La fotografía no tiene un formato válido." }, { status: 400 });
    }
    if (photoDataUri.length > 8_000_000) {
      return NextResponse.json({ error: "La imagen pesa demasiado. Acércate a la placa y vuelve a hacer la foto." }, { status: 413 });
    }

    const match = photoDataUri.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      return NextResponse.json({ error: "No se ha podido leer el archivo de imagen." }, { status: 400 });
    }

    const prompt = `Lee la inscripción del número de bastidor de este vehículo BMW o MINI.
Devuelve exclusivamente JSON válido con estas propiedades:
{"vin":"VIN completo de 17 caracteres o los últimos 7 caracteres si solo esos son legibles","modelo":"modelo si aparece escrito claramente, si no cadena vacía","confianza":0.0}
Reglas:
- Prioriza el VIN troquelado o impreso en la placa del vehículo, no números de referencia ni códigos de piezas.
- Un VIN tiene 17 caracteres y no contiene las letras I, O ni Q.
- Si puedes leer el VIN completo, devuelve los 17 caracteres. Si solo se distinguen con claridad los últimos 7, devuelve esos 7.
- No inventes ni completes caracteres dudosos. Si no puedes leer al menos 7 caracteres consecutivos del VIN, devuelve vin vacío y confianza 0.
- No confundas 0 con O ni 1 con I; en un VIN las letras I, O y Q no se utilizan.
- confianza es un número entre 0 y 1.`;

    const googleResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { text: prompt },
              { inline_data: { mime_type: match[1], data: match[2] } },
            ],
          }],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                vin: { type: "STRING" },
                modelo: { type: "STRING" },
                confianza: { type: "NUMBER" },
              },
              required: ["vin", "modelo", "confianza"],
            },
          },
        }),
        cache: "no-store",
      }
    );

    const googlePayload = await googleResponse.json().catch(() => ({}));
    if (!googleResponse.ok) {
      const status = googleResponse.status;
      const googleMessage = googlePayload?.error?.message || "";
      console.error("[VIN_RECOGNITION_PROVIDER]", status, googleMessage);
      if (status === 400 || status === 403) {
        return NextResponse.json(
          { error: "Google ha rechazado la clave Gemini o no tiene habilitada la API Generative Language. Revisa la clave y sus restricciones en Google AI Studio." },
          { status: 502 }
        );
      }
      if (status === 429) {
        return NextResponse.json({ error: "Se ha alcanzado temporalmente el límite de consultas de reconocimiento. Espera un minuto y vuelve a intentarlo." }, { status: 429 });
      }
      return NextResponse.json({ error: "El servicio de reconocimiento no está disponible ahora. Inténtalo de nuevo." }, { status: 502 });
    }

    const text = googlePayload?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || "")
      .join("")
      .trim();

    if (!text) {
      return NextResponse.json({ error: "No se ha podido leer el bastidor. Prueba con más luz, enfoque y sin reflejos." }, { status: 422 });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(text.replace(/^\u0060{3}(?:json)?\s*/i, "").replace(/\s*\u0060{3}$/i, ""));
    } catch {
      return NextResponse.json({ error: "La lectura no ha devuelto un bastidor válido. Repite la fotografía enfocando la inscripción." }, { status: 422 });
    }

    const vin = cleanVin(parsed?.vin);
    if (vin.length !== 7 && vin.length !== 17) {
      return NextResponse.json({ error: "No se ha podido identificar un VIN fiable. Acerca la cámara a los últimos 7 caracteres y evita reflejos." }, { status: 422 });
    }

    return NextResponse.json({
      vin,
      modelo: typeof parsed?.modelo === "string" ? parsed.modelo.trim() : "",
      confianza: Math.max(0, Math.min(1, Number(parsed?.confianza) || 0)),
    });
  } catch (error) {
    console.error("[VIN_RECOGNITION_ERROR]", error);
    return NextResponse.json(
      { error: "No se ha podido procesar la fotografía. Comprueba la conexión e inténtalo de nuevo." },
      { status: 500 }
    );
  }
}
