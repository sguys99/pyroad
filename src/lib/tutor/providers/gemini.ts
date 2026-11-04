import { GoogleGenAI } from '@google/genai';
import type { LLMCallOptions, LLMProvider } from './types';

export class GeminiProvider implements LLMProvider {
  private client: GoogleGenAI;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new GoogleGenAI({ apiKey });
    this.model = model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  }

  async call(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
    options?: LLMCallOptions,
  ): Promise<string> {
    const response = await this.client.models.generateContent({
      model: this.model,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: maxTokens,
        abortSignal: options?.signal,
      },
      contents: userPrompt,
    });

    return response.text ?? '';
  }

  async *callStream(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
    options?: LLMCallOptions,
  ): AsyncIterable<string> {
    // Gemini SDK의 abortSignal은 클라이언트 쪽 연결만 끊는다 (SDK 문서: 서버 작업 취소·과금 중단은 보장하지 않음)
    const response = await this.client.models.generateContentStream({
      model: this.model,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: maxTokens,
        abortSignal: options?.signal,
      },
      contents: userPrompt,
    });

    for await (const chunk of response) {
      const text = chunk.text;
      if (text) yield text;
    }
  }
}
