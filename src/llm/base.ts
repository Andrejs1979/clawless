/**
 * LLM Provider Base Interface and Types
 */

import type { Env } from '@/index';
import type { ChatMessage, Tool, LLMProvider } from '@/types';

/**
 * Stream chunk for SSE responses
 */
export interface StreamChunk {
  delta: {
    role?: string;
    content?: string;
    toolCalls?: ToolCallChunk[];
  };
  finishReason: string | null;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Tool call chunk for streaming
 */
export interface ToolCallChunk {
  index: number;
  id?: string;
  type?: string;
  name?: string;
  arguments?: string;
}

/**
 * LLM completion options
 */
export interface CompletionOptions {
  messages: ChatMessage[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  tools?: Tool[];
  thinkingLevel?: 'off' | 'minimal' | 'low' | 'high';
  stream?: boolean;
}

/**
 * LLM completion result
 */
export interface CompletionResult {
  content: string;
  role: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  finishReason: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

/**
 * Base LLM provider interface
 */
export interface ILLMProvider {
  /**
   * Get provider name
   */
  readonly name: LLMProvider;

  /**
   * Complete a chat request (non-streaming)
   */
  complete(options: CompletionOptions, env: Env): Promise<CompletionResult>;

  /**
   * Stream a chat request
   * Returns a readable stream of SSE-formatted chunks
   */
  stream(options: CompletionOptions, env: Env): ReadableStream<StreamChunk>;

  /**
   * Check if this provider is available (has valid credentials)
   */
  isAvailable(env: Env): boolean;
}

/**
 * Convert our ChatMessage format to various provider formats
 */
export function toStandardMessages(messages: ChatMessage[]): Array<{
  role: string;
  content: string;
  tool_calls?: Array<{
    id: string;
    type: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
}> {
  return messages.map((msg) => {
    const standard: {
      role: string;
      content: string;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
      tool_call_id?: string;
    } = {
      role: msg.role,
      content: msg.content,
    };

    if (msg.toolCalls && msg.toolCalls.length > 0) {
      standard.tool_calls = msg.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.arguments),
        },
      }));
    }

    if (msg.toolCallId) {
      standard.tool_call_id = msg.toolCallId;
    }

    return standard;
  });
}

/**
 * Convert tools to OpenAI format
 */
export function toOpenAITools(tools?: Tool[]): Array<{
  type: string;
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}> {
  if (!tools || tools.length === 0) return [];

  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

/**
 * Parse tool call arguments from JSON string
 */
export function parseToolArguments(args: string): Record<string, unknown> {
  try {
    return JSON.parse(args);
  } catch {
    return {};
  }
}

/**
 * Create a transform stream for SSE formatting
 */
export function createSSEStream(): TransformStream<StreamChunk, string> {
  return new TransformStream({
    transform(chunk, controller) {
      // Format as SSE
      const data = JSON.stringify(chunk);
      controller.enqueue(`data: ${data}\n\n`);
    },
    flush(controller) {
      controller.enqueue('data: [DONE]\n\n');
    },
  });
}
