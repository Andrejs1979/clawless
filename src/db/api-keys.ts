/**
 * API key database queries
 */

import type { ApiKey } from '@/types';

import { firstRow, allRows, wasSuccessful } from './client';

/**
 * Hash an API key for storage (simple version - use crypto.subtle in production)
 */
export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a new API key
 */
export function generateApiKey(): { key: string; id: string } {
  const id = crypto.randomUUID();
  const prefix = 'clk_';
  const random = Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return { key: `${prefix}${random}`, id };
}

/**
 * Get API key by ID
 */
export async function getApiKey(db: D1Database, keyId: string): Promise<ApiKey | null> {
  const result = await firstRow(
    await db.prepare('SELECT * FROM api_keys WHERE id = ?').bind(keyId).all()
  );

  if (!result.success) return null;
  return mapToApiKey(result.data!);
}

/**
 * Get API key by hash
 */
export async function getApiKeyByHash(db: D1Database, keyHash: string): Promise<ApiKey | null> {
  const result = await firstRow(
    await db
      .prepare('SELECT * FROM api_keys WHERE key_hash = ? AND status = ?')
      .bind(keyHash, 'active')
      .all()
  );

  if (!result.success) return null;
  return mapToApiKey(result.data!);
}

/**
 * Create API key
 */
export async function createApiKey(
  db: D1Database,
  data: {
    id: string;
    tenantId: string;
    keyHash: string;
    scopes?: string[];
    expiresAt?: Date;
  }
): Promise<ApiKey> {
  await db
    .prepare(
      `INSERT INTO api_keys (id, tenant_id, key_hash, scopes, expires_at, status)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(
      data.id,
      data.tenantId,
      data.keyHash,
      data.scopes ? JSON.stringify(data.scopes) : null,
      data.expiresAt?.toISOString() ?? null,
      'active'
    )
    .run();

  return {
    id: data.id,
    tenantId: data.tenantId,
    keyHash: data.keyHash,
    scopes: data.scopes,
    createdAt: new Date(),
    status: 'active',
    expiresAt: data.expiresAt,
  };
}

/**
 * Revoke API key
 */
export async function revokeApiKey(db: D1Database, keyId: string): Promise<boolean> {
  const result = await db
    .prepare('UPDATE api_keys SET status = ? WHERE id = ?')
    .bind('revoked', keyId)
    .run();

  return wasSuccessful(result);
}

/**
 * Update last used timestamp
 */
export async function updateApiKeyLastUsed(db: D1Database, keyHash: string): Promise<void> {
  await db
    .prepare('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE key_hash = ?')
    .bind(keyHash)
    .run();
}

/**
 * List API keys for a tenant
 */
export async function listApiKeys(
  db: D1Database,
  tenantId: string,
  options: { status?: 'active' | 'revoked'; limit?: number } = {}
): Promise<ApiKey[]> {
  const conditions: string[] = ['tenant_id = ?'];
  const bindings: unknown[] = [tenantId];

  if (options.status) {
    conditions.push('status = ?');
    bindings.push(options.status);
  }

  const limit = options.limit ?? 100;

  const result = await allRows(
    await db
      .prepare(
        `SELECT * FROM api_keys WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT ?`
      )
      .bind(...bindings, limit)
      .all()
  );

  return result.data.map(mapToApiKey);
}

/**
 * Map database row to ApiKey object
 */
function mapToApiKey(row: Record<string, unknown>): ApiKey {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    keyHash: row.key_hash as string,
    scopes: row.scopes ? JSON.parse(row.scopes as string) : undefined,
    createdAt: new Date(row.created_at as string),
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at as string) : undefined,
    expiresAt: row.expires_at ? new Date(row.expires_at as string) : undefined,
    status: row.status as 'active' | 'revoked',
  };
}
