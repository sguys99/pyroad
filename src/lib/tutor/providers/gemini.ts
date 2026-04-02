import { GoogleGenAI } from '@google/genai';
import type { LLMProvider } from './types';

export class GeminiProvider implements LLMProvider {
  private client: GoogleGenAI;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new GoogleGenAI({ apiKey });
    this.model = model || process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  }

  async call(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
  ): Promise<string> {
    const response = await this.client.models.generateContent({
      model: this.model,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: maxTokens,
      },
      contents: userPrompt,
    });

    return response.text ?? '';
  }

  async *callStream(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
  ): AsyncIterable<string> {
    const response = await this.client.models.generateContentStream({
      model: this.model,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: maxTokens,
      },
      contents: userPrompt,
    });

    for await (const chunk of response) {
      const text = chunk.text;
      if (text) yield text;
    }
  }
}
