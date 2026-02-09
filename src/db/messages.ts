/**
 * Message database queries
 */

import type { ChatMessage } from '@/types';

import { allRows } from './client';

/**
 * Message database record
 */
export interface DbMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls: string | null;
  toolCallId: string | null;
  tokensUsed: number | null;
  createdAt: Date;
}

/**
 * Get messages for a session
 */
export async function getSessionMessages(
  db: D1Database,
  sessionId: string,
  options: { limit?: number; before?: Date } = {}
): Promise<ChatMessage[]> {
  const conditions: string[] = ['session_id = ?'];
  const bindings: unknown[] = [sessionId];

  if (options.before) {
    conditions.push('created_at < ?');
    bindings.push(options.before.toISOString());
  }

  const limit = options.limit ?? 100;

  const result = await allRows(
    await db
      .prepare(
        `SELECT * FROM messages WHERE ${conditions.join(' AND ')} ORDER BY created_at ASC LIMIT ?`
      )
      .bind(...bindings, limit)
      .all()
  );

  return result.data.map(mapToChatMessage);
}

/**
 * Create message
 */
export async function createMessage(
  db: D1Database,
  data: {
    id: string;
    sessionId: string;
    role: ChatMessage['role'];
    content: string;
    toolCalls?: ChatMessage['toolCalls'];
    toolCallId?: string;
    tokensUsed?: number;
  }
): Promise<DbMessage> {
  await db
    .prepare(
      `INSERT INTO messages (id, session_id, role, content, tool_calls, tool_call_id, tokens_used)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      data.id,
      data.sessionId,
      data.role,
      data.content,
      data.toolCalls ? JSON.stringify(data.toolCalls) : null,
      data.toolCallId ?? null,
      data.tokensUsed ?? null
    )
    .run();

  return {
    id: data.id,
    sessionId: data.sessionId,
    role: data.role,
    content: data.content,
    toolCalls: data.toolCalls ? JSON.stringify(data.toolCalls) : null,
    toolCallId: data.toolCallId ?? null,
    tokensUsed: data.tokensUsed ?? null,
    createdAt: new Date(),
  };
}

/**
 * Create multiple messages in a batch
 */
export async function createMessages(
  db: D1Database,
  messages: Array<{
    id: string;
    sessionId: string;
    role: ChatMessage['role'];
    content: string;
    toolCalls?: ChatMessage['toolCalls'];
    toolCallId?: string;
    tokensUsed?: number;
  }>
): Promise<void> {
  const stmt = db.prepare(
    `INSERT INTO messages (id, session_id, role, content, tool_calls, tool_call_id, tokens_used)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
  );

  // Batch insert
  await db.batch(
    messages.map((m) =>
      stmt.bind(
        m.id,
        m.sessionId,
        m.role,
        m.content,
        m.toolCalls ? JSON.stringify(m.toolCalls) : null,
        m.toolCallId ?? null,
        m.tokensUsed ?? null
      )
    )
  );
}

/**
 * Delete messages for a session (useful for clearing history)
 */
export async function deleteSessionMessages(db: D1Database, sessionId: string): Promise<number> {
  const result = await db
    .prepare('DELETE FROM messages WHERE session_id = ?')
    .bind(sessionId)
    .run();

  return result.meta.rows_written ?? 0;
}

/**
 * Get token usage for a session
 */
export async function getSessionTokenUsage(
  db: D1Database,
  sessionId: string
): Promise<{
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
}> {
  const result = await db
    .prepare(
      `SELECT
         COALESCE(SUM(tokens_used), 0) as total_tokens,
         COALESCE(SUM(CASE WHEN role = 'user' THEN tokens_used ELSE 0 END), 0) as prompt_tokens,
         COALESCE(SUM(CASE WHEN role = 'assistant' THEN tokens_used ELSE 0 END), 0) as completion_tokens
       FROM messages
       WHERE session_id = ? AND tokens_used IS NOT NULL`
    )
    .bind(sessionId)
    .first<{
      total_tokens: number;
      prompt_tokens: number;
      completion_tokens: number;
    }>();

  return {
    totalTokens: result?.total_tokens ?? 0,
    promptTokens: result?.prompt_tokens ?? 0,
    completionTokens: result?.completion_tokens ?? 0,
  };
}

/**
 * Get message count for a session
 */
export async function getSessionMessageCount(db: D1Database, sessionId: string): Promise<number> {
  const result = await db
    .prepare('SELECT COUNT(*) as count FROM messages WHERE session_id = ?')
    .bind(sessionId)
    .first<{ count: number }>();

  return result?.count ?? 0;
}

/**
 * Map database row to ChatMessage
 */
function mapToChatMessage(row: Record<string, unknown>): ChatMessage {
  const message: ChatMessage = {
    role: row.role as ChatMessage['role'],
    content: row.content as string,
  };

  if (row.tool_calls) {
    message.toolCalls = JSON.parse(row.tool_calls as string);
  }
  if (row.tool_call_id) {
    message.toolCallId = row.tool_call_id as string;
  }

  return message;
}
