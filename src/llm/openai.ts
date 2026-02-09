/**
 * OpenAI LLM Provider
 * Supports GPT-4o, GPT-4o-mini, GPT-3.5-turbo, etc.
 */

import type { Env } from '@/index';

import type { CompletionOptions, CompletionResult, StreamChunk, ILLMProvider } from './base';
import { toStandardMessages, toOpenAITools, parseToolArguments } from './base';

/**
 * OpenAI available models
 */
export const OPENAI_MODELS = {
  gpt_4o: 'gpt-4o',
  gpt_4o_mini: 'gpt-4o-mini',
  gpt_4_turbo: 'gpt-4-turbo',
  gpt_35_turbo: 'gpt-3.5-turbo',
  gpt_4: 'gpt-4',
} as const;

/**
 * Default OpenAI model
 */
export const DEFAULT_OPENAI_MODEL = OPENAI_MODELS.gpt_4o_mini;

/**
 * OpenAI API endpoint
 */
const OPENAI_API = 'https://api.openai.com/v1/chat/completions';

/**
 * OpenAI Provider
 */
export class OpenAIProvider implements ILLMProvider {
  readonly name = 'openai' as const;

  complete(options: CompletionOptions, env: Env): Promise<CompletionResult> {
    return this._complete(options, env);
  }

  stream(options: CompletionOptions, env: Env): ReadableStream<StreamChunk> {
    const self = this;
    return new ReadableStream<StreamChunk>({
      async start(controller) {
        const response = await self._streamComplete(options, env);
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  controller.enqueue({
                    delta: {},
                    finishReason: 'stop',
                  });
                  continue;
                }

                try {
                  const parsed = JSON.parse(data);
                  controller.enqueue(self._parseStreamChunk(parsed));
                } catch {
                  // Skip invalid JSON
                }
              }
            }
          }
        } finally {
          controller.close();
        }
      },
    });
  }

  isAvailable(env: Env): boolean {
    return !!env.OPENAI_API_KEY;
  }

  private async _complete(options: CompletionOptions, env: Env): Promise<CompletionResult> {
    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const messages = toStandardMessages(options.messages);

    const request: Record<string, unknown> = {
      model: options.model || DEFAULT_OPENAI_MODEL,
      messages,
    };

    if (options.temperature !== undefined) {
      request.temperature = options.temperature;
    }

    if (options.maxTokens) {
      request.max_tokens = options.maxTokens;
    }

    if (options.tools && options.tools.length > 0) {
      request.tools = toOpenAITools(options.tools);
    }

    const response = await fetch(OPENAI_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    const data = (await response.json()) as OpenAIResponse;
    return this._parseResponse(data);
  }

  private async _streamComplete(options: CompletionOptions, env: Env): Promise<Response> {
    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const messages = toStandardMessages(options.messages);

    const request: Record<string, unknown> = {
      model: options.model || DEFAULT_OPENAI_MODEL,
      messages,
      stream: true,
    };

    if (options.temperature !== undefined) {
      request.temperature = options.temperature;
    }

    if (options.maxTokens) {
      request.max_tokens = options.maxTokens;
    }

    if (options.tools && options.tools.length > 0) {
      request.tools = toOpenAITools(options.tools);
    }

    return fetch(OPENAI_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(request),
    });
  }

  private _parseResponse(data: OpenAIResponse): CompletionResult {
    const choice = data.choices[0];
    const message = choice.message;

    // Parse tool calls
    const toolCalls = message.tool_calls?.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: parseToolArguments(tc.function.arguments),
    }));

    return {
      content: message.content || '',
      role: message.role,
      toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: choice.finish_reason,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
      model: data.model,
    };
  }

  private _parseStreamChunk(data: OpenAIStreamChunk): StreamChunk {
    const choice = data.choices[0];
    const delta = choice.delta;

    const chunk: StreamChunk = {
      delta: {},
      finishReason: choice.finish_reason || null,
    };

    if (delta.content) {
      chunk.delta.content = delta.content;
    }

    if (delta.tool_calls) {
      chunk.delta.toolCalls = delta.tool_calls.map((tc) => ({
        index: tc.index,
        id: tc.id,
        name: tc.function?.name,
        arguments: tc.function?.arguments,
      }));
    }

    return chunk;
  }
}

/**
 * OpenAI API response types
 */
interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
}

/**
 * Create an OpenAI provider instance
 */
export function createOpenAIProvider(): OpenAIProvider {
  return new OpenAIProvider();
}
