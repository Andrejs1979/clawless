/**
 * Session database queries
 */

import type { Session, LLMProvider } from '@/types';

import { firstRow, wasSuccessful, parseJsonColumn } from './client';

const DEFAULT_METADATA = {
  thinkingLevel: 'minimal' as const,
  verbose: false,
};

/**
 * Get session by ID
 */
export async function getSession(db: D1Database, sessionId: string): Promise<Session | null> {
  const result = await firstRow(
    await db
      .prepare('SELECT * FROM sessions WHERE id = ? AND status != ?')
      .bind(sessionId, 'deleted')
      .all()
  );

  if (!result.success) return null;
  return mapToSession(result.data!);
}

/**
 * Get session by external ID
 */
export async function getSessionByExternalId(
  db: D1Database,
  tenantId: string,
  externalId: string
): Promise<Session | null> {
  const result = await firstRow(
    await db
      .prepare('SELECT * FROM sessions WHERE tenant_id = ? AND external_id = ? AND status = ?')
      .bind(tenantId, externalId, 'active')
      .all()
  );

  if (!result.success) return null;
  return mapToSession(result.data!);
}

/**
 * Create session
 */
export async function createSession(
  db: D1Database,
  data: {
    id: string;
    tenantId: string;
    externalId?: string;
    model: string;
    provider: LLMProvider;
    metadata?: Record<string, unknown>;
  }
): Promise<Session> {
  const metadata = { ...DEFAULT_METADATA, ...data.metadata };

  await db
    .prepare(
      `INSERT INTO sessions (id, tenant_id, external_id, model, provider, metadata, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      data.id,
      data.tenantId,
      data.externalId ?? null,
      data.model,
      data.provider,
      JSON.stringify(metadata),
      'active'
    )
    .run();

  return {
    id: data.id,
    tenantId: data.tenantId,
    externalId: data.externalId,
    model: data.model,
    provider: data.provider,
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata,
    status: 'active',
  };
}

/**
 * Update session timestamp and metadata
 */
export async function updateSession(
  db: D1Database,
  sessionId: string,
  updates: {
    metadata?: Record<string, unknown>;
    status?: 'active' | 'archived' | 'deleted';
  }
): Promise<boolean> {
  const sets: string[] = ['updated_at = CURRENT_TIMESTAMP'];
  const bindings: unknown[] = [];

  if (updates.metadata !== undefined) {
    sets.push('metadata = ?');
    bindings.push(JSON.stringify(updates.metadata));
  }
  if (updates.status !== undefined) {
    sets.push('status = ?');
    bindings.push(updates.status);
  }

  bindings.push(sessionId);

  const result = await db
    .prepare(`UPDATE sessions SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...bindings)
    .run();

  return wasSuccessful(result);
}

/**
 * List sessions for a tenant
 */
export async function listSessions(
  db: D1Database,
  tenantId: string,
  options: {
    status?: 'active' | 'archived' | 'deleted';
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ sessions: Session[]; total: number }> {
  const conditions: string[] = ['tenant_id = ?'];
  const bindings: unknown[] = [tenantId];

  if (options.status) {
    conditions.push('status = ?');
    bindings.push(options.status);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  // Get count
  const countResult = await db
    .prepare(`SELECT COUNT(*) as count FROM sessions ${whereClause}`)
    .bind(...bindings)
    .first<{ count: number }>();
  const total = countResult?.count ?? 0;

  // Get paginated results
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  const sessionsResult = await db
    .prepare(`SELECT * FROM sessions ${whereClause} ORDER BY updated_at DESC LIMIT ? OFFSET ?`)
    .bind(...bindings, limit, offset)
    .all();

  const sessions = (sessionsResult.results ?? []).map(mapToSession);

  return { sessions, total };
}

/**
 * Archive old sessions (utility function)
 */
export async function archiveOldSessions(
  db: D1Database,
  tenantId: string,
  olderThanDays: number = 30
): Promise<number> {
  const result = await db
    .prepare(
      `UPDATE sessions
       SET status = 'archived', updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ?
       AND status = 'active'
       AND datetime(created_at) < datetime('now', '-' || ? || ' days')`
    )
    .bind(tenantId, olderThanDays)
    .run();

  return result.meta.rows_written ?? 0;
}

/**
 * Map database row to Session object
 */
function mapToSession(row: Record<string, unknown>): Session {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    externalId: row.external_id as string | undefined,
    model: row.model as string,
    provider: row.provider as LLMProvider,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
    metadata: parseJsonColumn(row.metadata as string, DEFAULT_METADATA),
    status: row.status as 'active' | 'archived' | 'deleted',
  };
}
