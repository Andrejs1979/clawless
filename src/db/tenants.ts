/**
 * Tenant database queries
 */

import type { Tenant, TenantSettings, TenantQuotas, TenantStatus } from '@/types';

import { parseJsonColumn, stringifyJson, wasSuccessful } from './client';

// Default tenant settings
const DEFAULT_SETTINGS: TenantSettings = {
  defaultModel: '@cf/meta/llama-3.1-8b-instruct',
  defaultProvider: 'workers',
  systemPrompt: undefined,
  allowedTools: ['sessions_list', 'sessions_send'],
  customTools: undefined,
};

// Default quotas by tier
const DEFAULT_QUOTAS: Record<string, TenantQuotas> = {
  starter: { monthlyMessages: 1000, monthlyTokens: 1_000_000, overagesAllowed: false },
  pro: { monthlyMessages: 10_000, monthlyTokens: 10_000_000, overagesAllowed: true },
  business: { monthlyMessages: 100_000, monthlyTokens: 100_000_000, overagesAllowed: true },
  enterprise: { monthlyMessages: 1_000_000, monthlyTokens: 1_000_000_000, overagesAllowed: true },
};

/**
 * Get tenant by ID
 */
export async function getTenant(db: D1Database, tenantId: string): Promise<Tenant | null> {
  const result = await db
    .prepare('SELECT * FROM tenants WHERE id = ? AND status != ?')
    .bind(tenantId, 'deleted')
    .first();

  if (!result) return null;

  return mapToTenant(result);
}

/**
 * Get tenant by API key
 */
export async function getTenantByApiKey(db: D1Database, keyHash: string): Promise<Tenant | null> {
  const result = await db
    .prepare(
      `
      SELECT t.* FROM tenants t
      INNER JOIN api_keys ak ON ak.tenant_id = t.id
      WHERE ak.key_hash = ? AND ak.status = ? AND t.status != ?
    `
    )
    .bind(keyHash, 'active', 'deleted')
    .first();

  if (!result) return null;

  return mapToTenant(result);
}

/**
 * Create tenant
 */
export async function createTenant(
  db: D1Database,
  data: {
    id: string;
    name: string;
    tier?: string;
    settings?: Partial<TenantSettings>;
    quotas?: Partial<TenantQuotas>;
  }
): Promise<Tenant> {
  const tier = data.tier ?? 'starter';
  const settings = { ...DEFAULT_SETTINGS, ...data.settings };
  const quotas = { ...DEFAULT_QUOTAS[tier], ...data.quotas };

  await db
    .prepare(
      `INSERT INTO tenants (id, name, tier, settings, quotas, status)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(data.id, data.name, tier, stringifyJson(settings), stringifyJson(quotas), 'active')
    .run();

  return {
    id: data.id,
    name: data.name,
    createdAt: new Date(),
    settings,
    quotas,
    status: 'active',
  };
}

/**
 * Update tenant
 */
export async function updateTenant(
  db: D1Database,
  tenantId: string,
  updates: Partial<Pick<Tenant, 'name' | 'settings' | 'quotas' | 'status'>>
): Promise<boolean> {
  const sets: string[] = [];
  const bindings: unknown[] = [];

  if (updates.name !== undefined) {
    sets.push('name = ?');
    bindings.push(updates.name);
  }
  if (updates.settings !== undefined) {
    sets.push('settings = ?');
    bindings.push(stringifyJson(updates.settings));
  }
  if (updates.quotas !== undefined) {
    sets.push('quotas = ?');
    bindings.push(stringifyJson(updates.quotas));
  }
  if (updates.status !== undefined) {
    sets.push('status = ?');
    bindings.push(updates.status);
  }

  if (sets.length === 0) return false;

  bindings.push(tenantId);

  const result = await db
    .prepare(`UPDATE tenants SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...bindings)
    .run();

  return wasSuccessful(result);
}

/**
 * List tenants (admin only)
 */
export async function listTenants(
  db: D1Database,
  options: { status?: TenantStatus; tier?: string; limit?: number; offset?: number } = {}
): Promise<{ tenants: Tenant[]; total: number }> {
  const conditions: string[] = [];
  const bindings: unknown[] = [];

  if (options.status) {
    conditions.push('status = ?');
    bindings.push(options.status);
  }
  if (options.tier) {
    conditions.push('tier = ?');
    bindings.push(options.tier);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get count
  const countResult = await db
    .prepare(`SELECT COUNT(*) as count FROM tenants ${whereClause}`)
    .bind(...bindings)
    .first<{ count: number }>();
  const total = countResult?.count ?? 0;

  // Get paginated results
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  const tenantsResult = await db
    .prepare(`SELECT * FROM tenants ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .bind(...bindings, limit, offset)
    .all();

  const tenants = (tenantsResult.results ?? []).map(mapToTenant);

  return { tenants, total };
}

/**
 * Map database row to Tenant object
 */
function mapToTenant(row: Record<string, unknown>): Tenant {
  return {
    id: row.id as string,
    name: row.name as string,
    createdAt: new Date(row.created_at as string),
    settings: parseJsonColumn<TenantSettings>(row.settings as string, DEFAULT_SETTINGS),
    quotas: parseJsonColumn<TenantQuotas>(row.quotas as string, DEFAULT_QUOTAS.starter),
    status: row.status as TenantStatus,
  };
}
