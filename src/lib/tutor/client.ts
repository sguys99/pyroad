import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

async function attempt(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
): Promise<string> {
  const response = await getClient().messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const block = response.content[0];
  if (block.type === 'text') return block.text;
  return '';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callTutor(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 600,
): Promise<{ text: string; ok: boolean }> {
  try {
    const text = await attempt(systemPrompt, userPrompt, maxTokens);
    return { text, ok: true };
  } catch {
    // 1차 재시도 (1초 후)
    try {
      await delay(1000);
      const text = await attempt(systemPrompt, userPrompt, maxTokens);
      return { text, ok: true };
    } catch {
      return { text: '', ok: false };
    }
  }
}
