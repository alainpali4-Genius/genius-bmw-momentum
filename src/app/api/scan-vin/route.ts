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
{"vin":"VIN completo de 17 caracteres o los últimos 7 caracteres si solo esos son legibles","modelo":"modelo o motorización impresa en la placa, por ejemplo 420d","colorCode":"código de pintura impreso en la placa, por ejemplo A96","textoPlaca":"transcripción literal de todo el texto legible de la placa","confianza":0.0}
Reglas:
- Lee también el modelo/motorización y el código de pintura. En una placa BMW, por ejemplo, la columna izquierda puede mostrar 420d y A96. En la fotografía de una placa nítida no dejes esos campos vacíos si se distinguen.
- Devuelve en textoPlaca todo el texto legible de la placa, respetando letras y números.
- Prioriza el VIN de 17 caracteres situado en la zona central de la placa; en caso de que no sea legible completo, lee los últimos 7 caracteres consecutivos.
- Un VIN tiene 17 caracteres y no contiene las letras I, O ni Q.
- Si puedes leer el VIN completo, devuelve los 17 caracteres. Si solo se distinguen con claridad los últimos 7, devuelve esos 7.
- No inventes ni completes caracteres dudosos. Si no puedes leer al menos 7 caracteres consecutivos del VIN, devuelve vin vacío y confianza 0.
- No confundas 0 con O ni 1 con I; en un VIN las letras I, O y Q no se utilizan.
- confianza es un número entre 0 y 1.`;

    const modelIds = ["gemini-3.8-flash", "gemini-3.7-flash"];
    let googleResponse: Response | undefined;
    let googlePayload: any = {};
    for (const modelId of modelIds) {
      const geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/" + modelId + ":generateContent";
      for (let attempt = 0; attempt < 2; attempt++) {
        googleResponse = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: match[1], data: match[2] } }] }], generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: { type: "OBJECT", properties: { vin: { type: "STRING" }, modelo: { type: "STRING" }, colorCode: { type: "STRING" }, textoPlaca: { type: "STRING" }, confianza: { type: "NUMBER" } }, required: ["vin", "modelo", "colorCode", "textoPlaca", "confianza"] } } }),
          cache: "no-store",
        });
        googlePayload = await googleResponse.json().catch(() => ({}));
        if (googleResponse.ok) break;
        if (![429, 500, 502, 503, 504].includes(googleResponse.status)) break;
        if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 800));
      }
      if (googleResponse.ok || ![429, 500, 502, 503, 504].includes(googleResponse.status)) break;
    }
    if (!googleResponse) return NextResponse.json({ error: "No se ha recibido respuesta del servicio de reconocimiento." }, { status: 503 });    const googlePayload = await googleResponse.json().catch(() => ({}));
    if (!googleResponse.ok) {
      const status = googleResponse.status;
      const googleMessage = googlePayload?.error?.message || "";
      console.error("[VIN_RECOGNITION_PROVIDER]", status, googleMessage);
      if (status === 400 || status === 403 || status === 401) {
        const detail = String(googleMessage || "").slice(0, 280);
        let guidance = "Google ha rechazado la solicitud de Gemini.";
        if (/API_KEY_INVALID|invalid api key|API key not valid/i.test(detail)) {
          guidance = "La clave configurada en Vercel no es válida. Comprueba GEMINI_API_KEY.";
        } else if (/SERVICE_DISABLED|has not been used|not enabled|disabled/i.test(detail)) {
          guidance = "La API Generative Language no está habilitada en el proyecto de Google asociado a la clave.";
        } else if (/PERMISSION_DENIED|referer|IP address|blocked/i.test(detail)) {
          guidance = "La clave tiene restricciones que bloquean las llamadas desde Vercel. Revisa las restricciones de API y aplicación.";
        }
        return NextResponse.json({ error: guidance, diagnostic: detail || `Respuesta HTTP ${status} de Google.` }, { status: 502 });
      }
      if (status === 429) {
        return NextResponse.json({ error: "Google ha limitado temporalmente las consultas. Espera un minuto y vuelve a intentarlo.", diagnostic: String(googleMessage || "HTTP 429").slice(0, 280) }, { status: 429 });
      }
      // Diagnóstico acotado: nunca devolver la clave ni cabeceras de la petición.
      return NextResponse.json({
        error: "Gemini ha devuelto un error al analizar la fotografía.",
        diagnostic: String(googleMessage || `Respuesta HTTP ${status} de Google.`).slice(0, 280),
        providerStatus: status,
      }, { status: 502 });
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
    const plateText = String(parsed?.textoPlaca || "").toUpperCase();
    const detectedModel = String(parsed?.modelo || "").trim() || (plateText.match(/\b(?:[1-8]\d{2}[A-Z]{1,3}|X[1-7]|Z4|XM|IX[1-9]?)\b/)?.[0] || "");
    const detectedColor = String(parsed?.colorCode || "").trim().toUpperCase() || (plateText.match(/\b[A-Z]\d{2}\b/)?.[0] || "");
    if (vin.length !== 7 && vin.length !== 17) {
      return NextResponse.json({ error: "No se ha podido identificar un VIN fiable. Acerca la cámara a los últimos 7 caracteres y evita reflejos." }, { status: 422 });
    }

    return NextResponse.json({
      vin,
      modelo: detectedModel,
      colorCode: detectedColor,
      confianza: Math.max(0, Math.min(1, Number(parsed?.confianza) || 0)),
    });
  } catch (error) {
    const diagnostic = error instanceof Error ? error.message.slice(0, 220) : "Error inesperado de red o procesamiento.";
    console.error("[VIN_RECOGNITION_ERROR]", diagnostic);
    return NextResponse.json(
      { error: "No se ha podido completar la lectura de la fotografía.", diagnostic },
      { status: 500 }
    );
  }
}
