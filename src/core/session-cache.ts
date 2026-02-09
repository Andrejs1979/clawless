/**
 * Session Cache using Cloudflare KV
 * Caches session contexts for fast retrieval and reduced LLM costs
 */

import type { Env } from '@/index';
import type { ChatMessage, Session, LLMProvider } from '@/types';

/**
 * Cached session data
 */
export interface CachedSession {
  id: string;
  tenantId: string;
  externalId?: string;
  model: string;
  provider: LLMProvider;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  metadata: Record<string, unknown>;
}

/**
 * KV cache TTL in seconds (1 hour)
 */
const CACHE_TTL = 3600;

/**
 * KV key prefix for session cache
 */
const SESSION_KEY_PREFIX = 'session:';

/**
 * Get session cache key
 */
function getSessionKey(sessionId: string): string {
  return `${SESSION_KEY_PREFIX}${sessionId}`;
}

/**
 * Get session from cache
 */
export async function getSessionFromCache(
  env: Env,
  sessionId: string
): Promise<CachedSession | null> {
  try {
    const cached = await env.CACHE.get(getSessionKey(sessionId), 'json');
    if (!cached || typeof cached !== 'object') return null;

    return cached as CachedSession;
  } catch {
    return null;
  }
}

/**
 * Save session to cache
 */
export async function saveSessionToCache(env: Env, session: CachedSession): Promise<void> {
  try {
    await env.CACHE.put(getSessionKey(session.id), JSON.stringify(session), {
      expirationTtl: CACHE_TTL,
    });
  } catch (error) {
    console.error('Failed to cache session:', error);
  }
}

/**
 * Update session messages in cache
 */
export async function updateSessionMessages(
  env: Env,
  sessionId: string,
  messages: ChatMessage[]
): Promise<void> {
  const cached = await getSessionFromCache(env, sessionId);
  if (!cached) return;

  cached.messages = messages;
  cached.updatedAt = Date.now();

  await saveSessionToCache(env, cached);
}

/**
 * Invalidate session cache
 */
export async function invalidateSessionCache(env: Env, sessionId: string): Promise<void> {
  try {
    await env.CACHE.delete(getSessionKey(sessionId));
  } catch (error) {
    console.error('Failed to invalidate session cache:', error);
  }
}

/**
 * Create cached session from database session
 */
export function createCachedSession(session: Session, messages: ChatMessage[]): CachedSession {
  return {
    id: session.id,
    tenantId: session.tenantId,
    externalId: session.externalId,
    model: session.model,
    provider: session.provider,
    messages,
    createdAt: session.createdAt.getTime(),
    updatedAt: session.updatedAt.getTime(),
    metadata: session.metadata,
  };
}

/**
 * Get messages with cache fallback
 * First tries KV cache, then falls back to database
 */
export async function getSessionMessages(
  env: Env,
  sessionId: string,
  dbMessages?: ChatMessage[]
): Promise<ChatMessage[]> {
  // Try cache first
  const cached = await getSessionFromCache(env, sessionId);
  if (cached) {
    return cached.messages;
  }

  // Fallback to database messages
  return dbMessages || [];
}

/**
 * Warm up cache for a session
 * Loads from database and stores in KV
 */
export async function warmSessionCache(env: Env, sessionId: string, db: D1Database): Promise<void> {
  try {
    // Check if already cached
    const existing = await getSessionFromCache(env, sessionId);
    if (existing) return;

    // Load session and messages from database
    const sessionResult = await db
      .prepare('SELECT * FROM sessions WHERE id = ? AND status = ?')
      .bind(sessionId, 'active')
      .first();

    if (!sessionResult) return;

    const messagesResult = await db
      .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC')
      .bind(sessionId)
      .all();

    // Convert to cache format
    const messages: ChatMessage[] = (messagesResult.results ?? []).map((row) => {
      const msg: ChatMessage = {
        role: row.role as ChatMessage['role'],
        content: row.content as string,
      };

      if (row.tool_calls) {
        msg.toolCalls = JSON.parse(row.tool_calls as string);
      }

      return msg;
    });

    const cached: CachedSession = {
      id: sessionResult.id as string,
      tenantId: sessionResult.tenant_id as string,
      externalId: sessionResult.external_id as string | undefined,
      model: sessionResult.model as string,
      provider: sessionResult.provider as LLMProvider,
      messages,
      createdAt: new Date(sessionResult.created_at as string).getTime(),
      updatedAt: new Date(sessionResult.updated_at as string).getTime(),
      metadata: JSON.parse((sessionResult.metadata as string) || '{}'),
    };

    await saveSessionToCache(env, cached);
  } catch (error) {
    console.error('Failed to warm session cache:', error);
  }
}

/**
 * Batch warm multiple sessions
 */
export async function warmSessionBatch(
  env: Env,
  sessionIds: string[],
  db: D1Database
): Promise<void> {
  const promises = sessionIds.map((id) => warmSessionCache(env, id, db));
  await Promise.allSettled(promises);
}

/**
 * Get cache statistics
 */
export async function getCacheStats(env: Env): Promise<{
  hits: number;
  misses: number;
}> {
  const statsKey = 'cache:stats';
  const stats = await env.CACHE.get(statsKey, 'json');

  return (stats as { hits: number; misses: number }) || { hits: 0, misses: 0 };
}
