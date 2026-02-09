/**
 * Webhook Worker
 *
 * Handles incoming webhooks from external services
 */

import type { Env } from '@/index';

export class WebhookWorker {
  static async fetch(request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace('/webhooks', '');

    // Extract tenant ID from path: /webhooks/:tenantId/:webhookId
    const match = path.match(/^\/([^/]+)\/([^/]+)$/);

    if (!match) {
      return Response.json(
        {
          error: {
            type: 'invalid_webhook_url',
            message: 'Webhook URL must include tenant ID and webhook ID',
          },
        },
        { status: 400 }
      );
    }

    const [, tenantId, webhookId] = match;

    // TODO: Verify webhook signature
    // TODO: Route to appropriate handler based on webhookId

    return Response.json(
      {
        tenantId,
        webhookId,
        status: 'received',
      },
      { status: 202 }
    );
  }
}
