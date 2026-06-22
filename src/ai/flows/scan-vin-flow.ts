'use server';
/**
 * @fileOverview Flujo de IA optimizado para detección de VIN y modelos BMW.
 * 
 * - scanVIN - Función para detectar VIN/VIN7 y modelo desde una imagen.
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
  vin: z.string().describe('El número de bastidor (VIN) completo o VIN7 detectado.'),
  modelo: z.string().describe('El modelo de vehículo detectado (ej. X1, i4, M3).'),
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
  prompt: `Eres un experto en logística BMW para Momentum Navarra.
  
  Analiza la imagen para extraer el Número de Bastidor (VIN).
  
  REGLAS DE ORO:
  1. El VIN7 (últimos 7 caracteres) es fundamental (ej. 7N12345).
  2. Si no ves el VIN completo (17 caracteres), devuelve los 7 caracteres que identifiques como el VIN7.
  3. Identifica el modelo si es legible en la placa o por la forma del vehículo (X1, X5, Serie 3, etc.).
  4. Los VIN de BMW suelen empezar por WBA, WBS o WBY.
  5. Ignora otros códigos de barras o números de pieza.

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
