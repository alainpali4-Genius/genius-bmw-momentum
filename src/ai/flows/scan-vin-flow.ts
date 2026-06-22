
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
  prompt: `Eres un experto en logística BMW. Tu misión es extraer el VIN7 (últimos 7 caracteres del bastidor) de la imagen.
  
  REGLAS ESTRICTAS:
  1. El VIN7 suele tener un formato como '7N12345' (una letra seguida de 6 números) o similar.
  2. Si ves el VIN completo (17 caracteres que empiezan por WBA, WBS o WBY), extráelo.
  3. Si solo ves una parte, prioriza los últimos 7 caracteres.
  4. Identifica el modelo si es legible (X1, X3, i4, M3, etc.).
  5. Ignora cualquier otro texto, código de barras o número de pieza.

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
