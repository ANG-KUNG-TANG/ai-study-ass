// server/infrastructure/ai/gemini.adapter.ts
//
// Same AIError constructor assumption as openai.adapter.ts — see note there.
// Also ASSUMPTION: Gemini's generateContent v1beta REST shape. If you're on
// the @google/generative-ai SDK instead of raw fetch, this should become a
// thin wrapper around that SDK's client instead — let me know which you're
// actually using and I'll swap it.

import { aiConfig } from '@/server/config/ai_config';
import type { AIGenerateOptions, AIGenerateResult } from '@/server/types/Ai';
import { AIError } from '@/server/utils/errors'; // ADJUST PATH if different

export async function generateWithGemini(
  options: AIGenerateOptions
): Promise<AIGenerateResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), aiConfig.timeoutMs);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${aiConfig.gemini.model}:generateContent?key=${aiConfig.gemini.apiKey}`;

  try {
    const promptText = options.systemPrompt
      ? `${options.systemPrompt}\n\n${options.prompt}`
      : options.prompt;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          maxOutputTokens: options.maxTokens ?? 1000,
          temperature: options.temperature ?? 0.7,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new AIError(`Gemini request failed (${response.status}): ${body}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const tokensUsed =
      (data.usageMetadata?.promptTokenCount ?? 0) +
      (data.usageMetadata?.candidatesTokenCount ?? 0);

    return {
      text,
      tokensUsed,
      provider: 'gemini',
      model: aiConfig.gemini.model,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    if (err instanceof AIError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new AIError(`Gemini request timed out after ${aiConfig.timeoutMs}ms`);
    }
    throw new AIError(err instanceof Error ? err.message : 'Unknown Gemini error');
  } finally {
    clearTimeout(timeout);
  }
}