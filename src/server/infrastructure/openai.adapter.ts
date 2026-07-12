// server/infrastructure/ai/openai.adapter.ts
//
// ASSUMPTION: AIError constructor is `new AIError(message: string)`.
// Your Error Classes block lists AIError (502) — if the real constructor
// takes (message, cause) or (message, statusCode), adjust the throw sites
// below accordingly. This is the one thing most likely to not compile
// as-is against your actual error class.

import { aiConfig } from '@/server/config/ai_config';
import type { AIGenerateOptions, AIGenerateResult } from '@/server/types/Ai';
import { AIError } from "@/server/utils/errors"; // ADJUST PATH if different

export async function generateWithOpenAI(
  options: AIGenerateOptions
): Promise<AIGenerateResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), aiConfig.timeoutMs);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aiConfig.openai.apiKey}`,
      },
      body: JSON.stringify({
        model: aiConfig.openai.model,
        messages: [
          ...(options.systemPrompt
            ? [{ role: 'system', content: options.systemPrompt }]
            : []),
          { role: 'user', content: options.prompt },
        ],
        max_tokens: options.maxTokens ?? 1000,
        temperature: options.temperature ?? 0.7,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new AIError(`OpenAI request failed (${response.status}): ${body}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? '';
    const tokensUsed = data.usage?.total_tokens ?? 0;

    return {
      text,
      tokensUsed,
      provider: 'openai',
      model: aiConfig.openai.model,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    if (err instanceof AIError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new AIError(`OpenAI request timed out after ${aiConfig.timeoutMs}ms`);
    }
    throw new AIError(err instanceof Error ? err.message : 'Unknown OpenAI error');
  } finally {
    clearTimeout(timeout);
  }
}