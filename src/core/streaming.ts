/**
 * Streaming Response Utilities
 * Handles Server-Sent Events (SSE) streaming for real-time LLM responses
 */

import type { Env } from '@/index';
import type { StreamChunk } from '@/llm';
import { complete, stream as llmStream } from '@/llm';
import { routeRequest } from '@/llm/router';
import type { ChatMessage, LLMProvider, Tool } from '@/types';

/**
 * Streaming options
 */
export interface StreamingOptions {
  tenantId: string;
  sessionId: string;
  messages: ChatMessage[];
  model?: string;
  provider?: LLMProvider;
  temperature?: number;
  maxTokens?: number;
  tools?: Tool[];
}

/**
 * Create an SSE response stream
 */
export function createSSEReStream(): TransformStream<unknown, Uint8Array> {
  const encoder = new TextEncoder();

  return new TransformStream({
    transform(chunk, controller) {
      const data = JSON.stringify(chunk);
      controller.enqueue(encoder.encode(`data: ${data}\n\n`));
    },
    flush(controller) {
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
    },
  });
}

/**
 * Stream a chat completion
 */
export async function streamChatCompletion(options: StreamingOptions, env: Env): Promise<Response> {
  // Determine routing
  const routing = routeRequest(
    {
      requestedProvider: options.provider,
      requiresTools: (options.tools?.length ?? 0) > 0,
      requiresStreaming: true,
    },
    env
  );

  // Create the stream
  const stream = new ReadableStream<StreamChunk>({
    async start(controller) {
      try {
        // Get the provider stream
        const providerStream = llmStream(
          routing.provider,
          {
            messages: options.messages,
            model: options.model || routing.model,
            temperature: options.temperature,
            maxTokens: options.maxTokens,
            tools: options.tools as Tool[] | undefined,
            stream: true,
          },
          env
        );

        const reader = providerStream.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          controller.enqueue(value);
        }

        controller.close();
      } catch (error) {
        console.error('Streaming error:', error);
        controller.error(error);
      }
    },
  });

  // Convert to SSE format
  const sseStream = stream.pipeThrough(createSSEReStream());

  return new Response(sseStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}

/**
 * Non-streaming chat completion
 */
export async function completeChat(options: StreamingOptions, env: Env): Promise<Response> {
  // Determine routing
  const routing = routeRequest(
    {
      requestedProvider: options.provider,
      requiresTools: (options.tools?.length ?? 0) > 0,
      requiresStreaming: false,
    },
    env
  );

  try {
    const result = await complete(
      routing.provider,
      {
        messages: options.messages,
        model: options.model || routing.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        tools: options.tools as Tool[] | undefined,
      },
      env
    );

    return Response.json({
      id: crypto.randomUUID(),
      tenantId: options.tenantId,
      sessionId: options.sessionId,
      message: {
        role: result.role,
        content: result.content,
        toolCalls: result.toolCalls,
      },
      usage: result.usage,
      model: result.model,
      provider: routing.provider,
    });
  } catch (error) {
    console.error('Completion error:', error);
    return Response.json(
      {
        error: {
          type: 'llm_error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 502 }
    );
  }
}

/**
 * Handle chat completion request (auto-detect streaming)
 */
export async function handleChatCompletion(
  options: StreamingOptions & { stream?: boolean },
  env: Env
): Promise<Response> {
  if (options.stream) {
    return streamChatCompletion(options, env);
  }

  return completeChat(options, env);
}

/**
 * Create a ping event for SSE keepalive
 */
export function createSSEPing(): string {
  return ': ping\n\n';
}

/**
 * Create SSE headers
 */
export function getSSEHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  };
}

/**
 * Validate SSE request
 */
export function validateSSERequest(request: Request): { valid: boolean; error?: string } {
  // Check if client accepts text/event-stream
  const accept = request.headers.get('Accept');
  if (accept && !accept.includes('text/event-stream') && !accept.includes('*/*')) {
    return {
      valid: false,
      error: 'Client must accept text/event-stream for streaming responses',
    };
  }

  return { valid: true };
}

/**
 * Create a heartbeat interval for SSE connections
 */
export function createHeartbeat(intervalMs: number = 30000): {
  start: () => void;
  stop: () => void;
} {
  let intervalId: number | null = null;

  return {
    start() {
      if (intervalId !== null) return;
      intervalId = setInterval(() => {
        // Send a comment to keep the connection alive
        // This would be used in a streaming context
      }, intervalMs) as unknown as number;
    },
    stop() {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },
  };
}

/**
 * Format tool calls for streaming response
 */
export function formatToolCallChunk(
  toolCall: { id: string; name: string; arguments: Record<string, unknown> },
  index: number
): StreamChunk {
  return {
    delta: {
      toolCalls: [
        {
          index,
          id: toolCall.id,
          type: 'function',
          name: toolCall.name,
          arguments: JSON.stringify(toolCall.arguments),
        },
      ],
    },
    finishReason: null,
  };
}

/**
 * Parse stream request from URL/search params
 */
export function parseStreamRequest(request: Request): {
  stream: boolean;
  options: Omit<StreamingOptions, 'tenantId' | 'sessionId' | 'messages'>;
} {
  const url = new URL(request.url);
  const stream = url.searchParams.get('stream') === 'true';

  const options: Omit<StreamingOptions, 'tenantId' | 'sessionId' | 'messages'> = {
    model: url.searchParams.get('model') || undefined,
    provider: (url.searchParams.get('provider') as LLMProvider) || undefined,
    temperature: url.searchParams.get('temperature')
      ? parseFloat(url.searchParams.get('temperature')!)
      : undefined,
    maxTokens: url.searchParams.get('max_tokens')
      ? parseInt(url.searchParams.get('max_tokens')!)
      : undefined,
  };

  return { stream, options };
}
