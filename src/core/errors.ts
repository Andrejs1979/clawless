/**
 * Error handling utilities
 */

import type { Env } from '@/index';

export class ApiError extends Error {
  constructor(
    public type: string,
    public status: number,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('validation_error', 400, message, details);
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = 'Invalid or missing API key') {
    super('authentication_error', 401, message);
  }
}

export class RateLimitError extends ApiError {
  constructor(details: Record<string, unknown>) {
    super('rate_limit_exceeded', 429, 'Rate limit exceeded', details);
  }
}

export class TenantNotFoundError extends ApiError {
  constructor(tenantId: string) {
    super('tenant_not_found', 404, `Tenant not found: ${tenantId}`, { tenantId });
  }
}

export class SessionNotFoundError extends ApiError {
  constructor(sessionId: string) {
    super('session_not_found', 404, `Session not found: ${sessionId}`, { sessionId });
  }
}

export class LLMError extends ApiError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('llm_error', 502, 'LLM provider error', { message, ...details });
  }
}

export class InternalError extends ApiError {
  constructor(message: string = 'Internal server error') {
    super('internal_error', 500, message);
  }
}

/**
 * Convert an error to an API response
 */
export function handleError(error: unknown, env: Env): Response {
  console.error('Error:', error);

  // Generate request ID for tracing
  const requestId = crypto.randomUUID();

  if (error instanceof ApiError) {
    return Response.json(
      {
        error: {
          type: error.type,
          message: error.message,
          details: error.details,
          request_id: requestId,
        },
      },
      { status: error.status }
    );
  }

  // Unknown errors
  return Response.json(
    {
      error: {
        type: 'internal_error',
        message: env.ENVIRONMENT === 'production' ? 'An unexpected error occurred' : String(error),
        request_id: requestId,
      },
    },
    { status: 500 }
  );
}
