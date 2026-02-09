/**
 * WebChat Worker
 *
 * Handles embeddable chat widget and WebSocket connections
 */

import type { Env } from '@/index';

export class WebChatWorker {
  static async fetch(request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace('/webchat', '');

    switch (true) {
      case path === '/widget.js':
        // Serve embeddable widget script
        return this.serveWidget();

      case path === '/connect':
        // WebSocket/SSE connection endpoint
        return Response.json({ error: 'Not implemented' }, { status: 501 });

      default:
        return new Response('Not Found', { status: 404 });
    }
  }

  private static async serveWidget(): Promise<Response> {
    // TODO: Return embeddable JavaScript widget
    return new Response('// WebChat Widget - Coming soon', {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }
}
