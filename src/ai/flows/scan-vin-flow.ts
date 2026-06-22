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
  prompt: `Eres un asistente experto en logística BMW para Momentum Navarra.
  
  Tu objetivo es extraer el Número de Bastidor (VIN) de la imagen de una placa técnica o grabado en el chasis.
  
  REGLAS CRÍTICAS:
  1. El VIN completo tiene 17 caracteres alfanuméricos.
  2. El VIN7 (los últimos 7 caracteres) es la referencia principal en BMW (ej. '7N12345' o '4567890').
  3. Si la imagen es ruidosa, prioriza encontrar el VIN7.
  4. Identifica el modelo del coche si es visible (ej. X1, i4, M340i).
  5. Si ves varios códigos, el VIN suele empezar por 'WBA' o 'WBS'.

  Imagen a analizar: {{media url=photoDataUri}}`,
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
