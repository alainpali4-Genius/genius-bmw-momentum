
'use server';
/**
 * @fileOverview Flujo de IA optimizado para detección de VIN y modelos BMW.
 * 
 * - scanVIN - Función para detectar VIN/VIN7 y modelo desde una imagen de placa técnica.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ScanVINInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "Foto del bastidor del coche o placa técnica, en formato data URI Base64."
    ),
});
export type ScanVINInput = z.infer<typeof ScanVINInputSchema>;

const ScanVINOutputSchema = z.object({
  vin: z.string().describe('El número de bastidor (VIN) completo o VIN7 detectado (7 caracteres).'),
  modelo: z.string().describe('El modelo de vehículo detectado (ej. X1, X5, Serie 3).'),
  confianza: z.number().describe('Nivel de confianza de la detección (0-1).'),
});
export type ScanVINOutput = z.infer<typeof ScanVINOutputSchema>;

export async function scanVIN(input: ScanVINInput): Promise<ScanVINOutput> {
  return scanVINFlow(input);
}

const prompt = ai.definePrompt({
  name: 'scanVINPrompt',
  input: { schema: ScanVINInputSchema },
  output: { schema: ScanVINOutputSchema },
  prompt: `Eres un experto en logística BMW altamente preciso. Tu misión es extraer el VIN7 (los últimos 7 caracteres del bastidor) de la imagen proporcionada.
  
  REGLAS CRÍTICAS DE DETECCIÓN:
  1. El VIN7 es fundamental. Suele ser una letra seguida de 6 números (ej. 7N12345) o similar.
  2. Busca específicamente el bloque de 17 caracteres (VIN completo) que empieza por WBA, WBS o WBY.
  3. Si el VIN completo es ilegible pero los últimos 7 caracteres son claros, devuelve esos 7 caracteres en el campo 'vin'.
  4. Identifica el modelo (X1, X3, M3, i4, etc.) basándote en cualquier texto visible o forma característica si es posible.
  5. Si ves varios códigos, prioriza el que parezca un número de bastidor troquelado o impreso en placa técnica.
  6. Ignora números de piezas, códigos de barras o fechas.

  Imagen: {{media url=photoDataUri}}`,
});

const scanVINFlow = ai.defineFlow(
  {
    name: 'scanVINFlow',
    inputSchema: ScanVINInputSchema,
    outputSchema: ScanVINOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
