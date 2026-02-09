/**
 * Input validation utilities
 */

import { ValidationError } from '@/core/errors';

/**
 * Validate required fields
 */
export function validateRequired<T extends Record<string, unknown>>(
  data: T,
  fields: (keyof T)[]
): void {
  const missing = fields.filter((field) => !data[field]);

  if (missing.length > 0) {
    throw new ValidationError(`Missing required fields: ${missing.join(', ')}`, {
      missing_fields: missing,
    });
  }
}

/**
 * Validate email format
 */
export function validateEmail(email: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format', { email });
  }
}

/**
 * Validate UUID format
 */
export function validateUuid(uuid: string): void {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(uuid)) {
    throw new ValidationError('Invalid UUID format', { uuid });
  }
}

/**
 * Validate chat completion request
 */
export function validateChatCompletionRequest(data: { messages?: unknown; model?: unknown }): void {
  if (!data.messages || !Array.isArray(data.messages)) {
    throw new ValidationError('messages must be an array', {
      received: typeof data.messages,
    });
  }

  if (data.messages.length === 0) {
    throw new ValidationError('messages cannot be empty');
  }

  // Validate each message
  data.messages.forEach((msg, index) => {
    if (typeof msg !== 'object' || msg === null) {
      throw new ValidationError(`messages[${index}] must be an object`);
    }

    if (!('role' in msg) || !('content' in msg)) {
      throw new ValidationError(`messages[${index}] must have 'role' and 'content' fields`);
    }
  });
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string, maxLength = 10_000): string {
  const trimmed = input.trim();

  if (trimmed.length > maxLength) {
    throw new ValidationError(`Input exceeds maximum length of ${maxLength}`, {
      length: trimmed.length,
      max_length: maxLength,
    });
  }

  return trimmed;
}

/**
 * Validate enum value
 */
export function validateEnum<T extends string>(
  value: unknown,
  enumName: string,
  allowedValues: readonly T[]
): T {
  if (typeof value !== 'string') {
    throw new ValidationError(`${enumName} must be a string`);
  }

  if (!allowedValues.includes(value as T)) {
    throw new ValidationError(`Invalid ${enumName}`, {
      received: value,
      allowed: allowedValues,
    });
  }

  return value as T;
}
