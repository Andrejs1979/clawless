/**
 * Clawless - Multi-Tenant Serverless AI Platform
 *
 * Main entry point for Cloudflare Workers
 */

import { handleError } from '@/core/errors';
import { ApiGatewayWorker } from '@/workers/api-gateway';
import { WebChatWorker } from '@/workers/webchat';
import { WebhookWorker } from '@/workers/webhook';

export interface Env {
  // D1 Database
  DB: D1Database;

  // KV Cache
  CACHE: KVNamespace;

  // R2 Storage
  STORAGE: R2Bucket;

  // Environment variables
  ENVIRONMENT: string;

  // Optional secrets
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
}

/**
 * Main Cloudflare Workers handler
 * Routes requests to appropriate workers based on path
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Route to appropriate worker based on path
      if (path.startsWith('/api/')) {
        return ApiGatewayWorker.fetch(request, env, ctx);
      }

      if (path.startsWith('/webchat/')) {
        return WebChatWorker.fetch(request, env, ctx);
      }

      if (path.startsWith('/webhooks/')) {
        return WebhookWorker.fetch(request, env, ctx);
      }

      // Health check endpoint
      if (path === '/health' || path === '/') {
        return Response.json({
          status: 'ok',
          service: 'clawless',
          version: '0.1.0',
          environment: env.ENVIRONMENT,
        });
      }

      // 404 for unknown paths
      return new Response('Not Found', { status: 404 });
    } catch (error) {
      return handleError(error, env);
    }
  },
};

/**
 * Scheduled event handler (for cron jobs)
 */
export interface ScheduledEvent {
  scheduledTime: number;
  cron: string;
}

export function scheduled(event: ScheduledEvent, _env: Env, ctx: ExecutionContext): void {
  // Handle scheduled tasks (e.g., data cleanup, aggregations)
  ctx.waitUntil(
    (async () => {
      // TODO: Implement scheduled tasks
      console.log('Scheduled event:', event.cron);
    })()
  );
}
