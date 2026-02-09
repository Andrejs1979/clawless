/**
 * Anthropic Claude LLM Provider
 * Supports Claude 3.5 Sonnet, Claude 3 Haiku, etc.
 */

import type { Env } from '@/index';

import type {
  CompletionOptions,
  CompletionResult,
  StreamChunk,
  ILLMProvider,
  ToolCallChunk,
} from './base';

/**
 * Anthropic available models
 */
export const ANTHROPIC_MODELS = {
  claude_3_5_sonnet: 'claude-3-5-sonnet-20241022',
  claude_3_5_haiku: 'claude-3-5-haiku-20241022',
  claude_3_opus: 'claude-3-opus-20240229',
  claude_3_sonnet: 'claude-3-sonnet-20240229',
  claude_3_haiku: 'claude-3-haiku-20240307',
} as const;

/**
 * Default Anthropic model
 */
export const DEFAULT_ANTHROPIC_MODEL = ANTHROPIC_MODELS.claude_3_5_haiku;

/**
 * Anthropic API endpoint
 */
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

/**
 * Anthropic Claude Provider
 */
export class AnthropicProvider implements ILLMProvider {
  readonly name = 'anthropic' as const;

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
    return !!env.ANTHROPIC_API_KEY;
  }

  private async _complete(options: CompletionOptions, env: Env): Promise<CompletionResult> {
    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const messages = this._convertMessages(options.messages);
    const systemMessage = messages.find((m) => m.role === 'system');
    const chatMessages = messages.filter((m) => m.role !== 'system');

    const request: Record<string, unknown> = {
      model: options.model || DEFAULT_ANTHROPIC_MODEL,
      messages: chatMessages,
      max_tokens: options.maxTokens || 4096,
    };

    if (systemMessage) {
      request.system = systemMessage.content;
    }

    if (options.temperature !== undefined) {
      request.temperature = options.temperature;
    }

    if (options.tools && options.tools.length > 0) {
      request.tools = this._convertTools(options.tools);
    }

    const response = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${error}`);
    }

    const data = (await response.json()) as AnthropicResponse;
    return this._parseResponse(data);
  }

  private async _streamComplete(options: CompletionOptions, env: Env): Promise<Response> {
    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const messages = this._convertMessages(options.messages);
    const systemMessage = messages.find((m) => m.role === 'system');
    const chatMessages = messages.filter((m) => m.role !== 'system');

    const request: Record<string, unknown> = {
      model: options.model || DEFAULT_ANTHROPIC_MODEL,
      messages: chatMessages,
      max_tokens: options.maxTokens || 4096,
      stream: true,
    };

    if (systemMessage) {
      request.system = systemMessage.content;
    }

    if (options.temperature !== undefined) {
      request.temperature = options.temperature;
    }

    if (options.tools && options.tools.length > 0) {
      request.tools = this._convertTools(options.tools);
    }

    return fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(request),
    });
  }

  private _convertMessages(messages: Array<{ role: string; content: string }>): Array<{
    role: string;
    content: string;
  }> {
    return messages.map((msg) => ({
      role: msg.role === 'tool' ? 'user' : msg.role,
      content: msg.content,
    }));
  }

  private _convertTools(
    tools: Array<{ name: string; description: string; parameters: Record<string, unknown> }>
  ): Array<{
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
  }> {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    }));
  }

  private _parseResponse(data: AnthropicResponse): CompletionResult {
    const content = data.content[0];
    const textContent = content?.type === 'text' ? content.text : '';

    // Check for tool calls
    const toolCalls = data.content
      .filter((c) => c.type === 'tool_use')
      .map((c) => ({
        id: c.id,
        name: c.name,
        arguments: c.input as Record<string, unknown>,
      }));

    return {
      content: textContent,
      role: 'assistant',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: data.stop_reason,
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
      model: data.model,
    };
  }

  private _parseStreamChunk(data: AnthropicStreamChunk): StreamChunk {
    const delta: { content?: string; toolCalls?: ToolCallChunk[] } = {};

    if (data.type === 'content_block_delta') {
      if (data.delta.type === 'text_delta') {
        delta.content = data.delta.text;
      }
    }

    if (data.type === 'message_stop') {
      return {
        delta: {},
        finishReason: 'stop',
      };
    }

    return {
      delta,
      finishReason: null,
    };
  }
}

/**
 * Anthropic API response types
 */
interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  >;
  stop_reason: string;
  model: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

type AnthropicStreamChunk =
  | { type: 'message_start'; message: AnthropicResponse }
  | { type: 'content_block_start'; index: number }
  | { type: 'content_block_delta'; index: number; delta: { type: 'text_delta'; text: string } }
  | { type: 'content_block_stop'; index: number }
  | { type: 'message_delta'; delta: {}; usage: { output_tokens: number } }
  | { type: 'message_stop' };

/**
 * Create an Anthropic provider instance
 */
export function createAnthropicProvider(): AnthropicProvider {
  return new AnthropicProvider();
}
