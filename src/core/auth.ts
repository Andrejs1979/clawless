/**
 * Authentication and authorization
 */

import type { Env } from '@/index';

export interface AuthResult {
  ok: true;
  tenantId: string;
  apiKey: string;
  scopes?: string[];
}

export interface AuthError {
  ok: false;
  response: Response;
}

/**
 * Authenticate an incoming request
 * Extracts and validates API key from Authorization header
 */
export async function authenticateRequest(
  request: Request,
  env: Env
): Promise<AuthResult | AuthError> {
  // Extract Authorization header
  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    return {
      ok: false,
      response: Response.json(
        {
          error: {
            type: 'authentication_error',
            message: 'Missing Authorization header',
          },
        },
        { status: 401 }
      ),
    };
  }

  // Parse Bearer token
  const match = authHeader.match(/^Bearer\s+(.+)$/);
  if (!match) {
    return {
      ok: false,
      response: Response.json(
        {
          error: {
            type: 'authentication_error',
            message: 'Invalid Authorization header format. Expected: Bearer <api-key>',
          },
        },
        { status: 401 }
      ),
    };
  }

  const apiKey = match[1];

  // Validate API key format (basic validation)
  if (!isValidApiKeyFormat(apiKey)) {
    return {
      ok: false,
      response: Response.json(
        {
          error: {
            type: 'authentication_error',
            message: 'Invalid API key format',
          },
        },
        { status: 401 }
      ),
    };
  }

  // Look up API key in database
  const keyHash = await hashApiKey(apiKey);
  const result = await env.DB.prepare(
    "SELECT ak.tenant_id, ak.scopes, t.status FROM api_keys ak JOIN tenants t ON ak.tenant_id = t.id WHERE ak.key_hash = ? AND ak.status = 'active' AND t.status = 'active'"
  )
    .bind(keyHash)
    .first();

  if (!result) {
    return {
      ok: false,
      response: Response.json(
        {
          error: {
            type: 'authentication_error',
            message: 'Invalid API key',
          },
        },
        { status: 401 }
      ),
    };
  }

  // Update last_used_at timestamp asynchronously
  env.DB.prepare('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE key_hash = ?')
    .bind(keyHash)
    .run();

  return {
    ok: true,
    tenantId: result.tenant_id as string,
    apiKey,
    scopes: result.scopes ? (JSON.parse(result.scopes as string) as string[]) : undefined,
  };
}

/**
 * Validate API key format
 * Expected format: cls_<tenantId>_<random>
 */
function isValidApiKeyFormat(apiKey: string): boolean {
  return /^cls_[a-z0-9]+_[a-zA-Z0-9]+$/.test(apiKey);
}

/**
 * Hash API key for storage
 * Uses SHA-256
 */
export async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a new API key
 */
export function generateApiKey(tenantId: string): string {
  const random = crypto.randomUUID().replace(/-/g, '');
  return `cls_${tenantId}_${random}`;
}
