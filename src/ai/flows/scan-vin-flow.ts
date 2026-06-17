'use server';
/**
 * @fileOverview Flujo de IA optimizado para detección de VIN y modelos BMW.
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
  modelo: z.string().describe('El modelo de vehículo detectado.'),
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
  prompt: `Eres un asistente experto en logística BMW Momentum Navarra. 
  
  Tu tarea es extraer el número de bastidor (VIN) de la imagen. 
  - El VIN completo tiene 17 caracteres alfanuméricos.
  - El VIN7 son los últimos 7 caracteres (ej. '4567890' o '7B12345').
  - Si solo ves el VIN7, devuélvelo.
  - Identifica también el modelo del coche si aparece (ej. X1, i4, M3).

  Imagen de la placa técnica o bastidor: {{media url=photoDataUri}}`,
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
