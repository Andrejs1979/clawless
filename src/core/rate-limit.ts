/**
 * Rate limiting using Cloudflare KV
 */

import type { Env } from '@/index';

export type RateLimitResult =
  | { ok: true }
  | {
      ok: false;
      response: Response;
    };

/**
 * Check rate limits for a tenant
 * Uses sliding window counter in KV
 */
export async function rateLimitCheck(tenantId: string, env: Env): Promise<RateLimitResult> {
  // TODO: Load tenant's rate limit configuration from database
  const limit = 100; // Default: 100 requests per minute
  const window = 60; // 60 seconds

  const key = `ratelimit:${tenantId}:${Math.floor(Date.now() / (window * 1000))}`;

  // Get current count
  const current = await env.CACHE.get(key);
  const count = current ? parseInt(current, 10) : 0;

  if (count >= limit) {
    return {
      ok: false,
      response: Response.json(
        {
          error: {
            type: 'rate_limit_exceeded',
            message: 'Rate limit exceeded',
            details: {
              limit,
              window: `${window}s`,
              resets_at: Math.floor((Math.floor(Date.now() / (window * 1000)) + 1) * window * 1000),
            },
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(window),
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(
              Math.floor((Math.floor(Date.now() / (window * 1000)) + 1) * window * 1000)
            ),
          },
        }
      ),
    };
  }

  // Increment counter
  await env.CACHE.put(key, String(count + 1), {
    expirationTtl: window,
  });

  return { ok: true };
}

/**
 * Check quota limits (monthly, etc.)
 */
export async function quotaCheck(_tenantId: string, _env: Env): Promise<RateLimitResult> {
  // TODO: Implement quota checking based on tenant's plan
  // This would check monthly message limits, token limits, etc.

  // For now, always pass - TODO: implement actual quota checking
  return { ok: true };
}
