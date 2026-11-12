import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

// Vercel tiene configurada GEMINI_API_KEY. Se pasa explícitamente al plugin
// para no depender del nombre de variable que detecta automáticamente Genkit.
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;

export const ai = genkit({
  plugins: [googleAI({ apiKey: geminiApiKey })],
  model: 'googleai/gemini-2.5-flash',
});
