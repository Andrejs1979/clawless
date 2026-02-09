/**
 * Tool Execution Framework
 * Handles built-in and custom tool execution
 */

import { LLMError } from '@/core/errors';
import { listSessions, createMessage } from '@/db';
import type { Env } from '@/index';
import type { Tool, ToolCall } from '@/types';

/**
 * Tool execution result
 */
export interface ToolResult {
  toolCallId: string;
  name: string;
  output: string;
  error?: string;
}

/**
 * Tool execution context
 */
export interface ToolContext {
  tenantId: string;
  sessionId: string;
  env: Env;
  db: D1Database;
}

/**
 * Built-in tool definitions
 */
export const BUILT_IN_TOOLS: Tool[] = [
  {
    name: 'sessions_list',
    description: 'List all chat sessions for the current tenant',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of sessions to return (default: 10)',
        },
        offset: {
          type: 'number',
          description: 'Number of sessions to skip (for pagination)',
        },
      },
    },
  },
  {
    name: 'sessions_send',
    description: 'Send a message to a specific session',
    parameters: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The ID of the session to send the message to',
        },
        message: {
          type: 'string',
          description: 'The message content to send',
        },
      },
      required: ['sessionId', 'message'],
    },
  },
];

/**
 * Built-in tool handlers
 */
const BUILT_IN_HANDLERS: Record<
  string,
  (context: ToolContext, args: Record<string, unknown>) => Promise<string>
> = {
  sessions_list: async (context, args) => {
    const limit = (args.limit as number) || 10;
    const offset = (args.offset as number) || 0;

    const result = await listSessions(context.db, context.tenantId, {
      status: 'active',
      limit,
      offset,
    });

    const sessions = result.sessions.map((s) => ({
      id: s.id,
      externalId: s.externalId,
      model: s.model,
      provider: s.provider,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      messageCount: 0, // Would need to be populated separately
    }));

    return JSON.stringify({
      sessions,
      total: result.total,
      limit,
      offset,
    });
  },

  sessions_send: async (context, args) => {
    const sessionId = args.sessionId as string;
    const message = args.message as string;

    // Create the message
    await createMessage(context.db, {
      id: crypto.randomUUID(),
      sessionId,
      role: 'user',
      content: message,
    });

    return JSON.stringify({
      success: true,
      sessionId,
      message: 'Message sent successfully',
    });
  },
};

/**
 * Execute a single tool call
 */
export async function executeTool(context: ToolContext, toolCall: ToolCall): Promise<ToolResult> {
  const { name, arguments: args } = toolCall;

  try {
    // Check built-in tools first
    if (name in BUILT_IN_HANDLERS) {
      const output = await BUILT_IN_HANDLERS[name]!(context, args);
      return {
        toolCallId: toolCall.id,
        name,
        output,
      };
    }

    // Check for custom tools (from tenant settings)
    // TODO: Implement custom tool lookup from tenant.settings.customTools

    throw new LLMError(`Unknown tool: ${name}`);
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      name,
      output: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Execute multiple tool calls in parallel
 */
export async function executeTools(
  context: ToolContext,
  toolCalls: ToolCall[]
): Promise<ToolResult[]> {
  const promises = toolCalls.map((tc) => executeTool(context, tc));
  return Promise.all(promises);
}

/**
 * Get available tools for a tenant
 */
export function getAvailableTools(allowedTools: string[], customTools?: Tool[]): Tool[] {
  const tools: Tool[] = [];

  // Add allowed built-in tools
  for (const tool of BUILT_IN_TOOLS) {
    if (allowedTools.includes(tool.name)) {
      tools.push(tool);
    }
  }

  // Add custom tools
  if (customTools) {
    for (const tool of customTools) {
      if (allowedTools.includes(tool.name)) {
        tools.push(tool);
      }
    }
  }

  return tools;
}

/**
 * Convert tool results to assistant messages
 */
export function toolResultsToMessages(results: ToolResult[]): Array<{
  role: 'tool';
  content: string;
  toolCallId: string;
}> {
  return results.map((result) => ({
    role: 'tool' as const,
    content: result.error ? `Error: ${result.error}` : result.output,
    toolCallId: result.toolCallId,
  }));
}

/**
 * Validate tool call arguments
 */
export function validateToolArguments(
  tool: Tool,
  args: Record<string, unknown>
): { valid: boolean; error?: string } {
  // Check required parameters
  if (tool.parameters.required) {
    for (const required of tool.parameters.required) {
      if (!(required in args)) {
        return {
          valid: false,
          error: `Missing required parameter: ${required}`,
        };
      }
    }
  }

  // TODO: Add deeper validation based on parameter schemas

  return { valid: true };
}

/**
 * Check if a tool requires special permissions
 */
export function requiresSpecialPermission(_toolName: string): boolean {
  // Currently no tools require special permissions
  // This can be extended in the future
  return false;
}

/**
 * Format tool calls for LLM response
 */
export function formatToolCallsForLLM(toolCalls: ToolCall[]): string {
  return toolCalls
    .map((tc) => `[Tool: ${tc.name}]\n${JSON.stringify(tc.arguments, null, 2)}`)
    .join('\n\n');
}

/**
 * Parse tool calls from LLM response
 */
export function parseToolCallsFromLLM(content: string): ToolCall[] | null {
  // Try to extract tool calls from various formats
  // This is a simple implementation; more sophisticated parsing may be needed

  const toolCallRegex = /<tool_call>(.*?)<\/tool_call>/gs;
  const matches = Array.from(content.matchAll(toolCallRegex));

  if (matches.length === 0) return null;

  return matches
    .map((match, index) => {
      try {
        const parsed = JSON.parse(match[1]!.trim());
        return {
          id: `call_${index}_${Date.now()}`,
          name: parsed.name || parsed.tool,
          arguments: parsed.arguments || parsed.input || {},
        };
      } catch {
        return null;
      }
    })
    .filter((tc): tc is ToolCall => tc !== null);
}
