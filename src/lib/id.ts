/**
 * ID generation utilities
 */

/**
 * Generate a unique tenant ID
 * Format: tenant_<random>
 */
export function generateTenantId(): string {
  const random = crypto.randomUUID().split('-')[0];
  return `tenant_${random}`;
}

/**
 * Generate a unique session ID
 * Format: sess_<random>
 */
export function generateSessionId(): string {
  const random = crypto.randomUUID().split('-')[0];
  return `sess_${random}`;
}

/**
 * Generate a unique message ID
 * Format: msg_<random>
 */
export function generateMessageId(): string {
  const random = crypto.randomUUID().split('-')[0];
  return `msg_${random}`;
}

/**
 * Generate a unique API key ID
 * Format: key_<random>
 */
export function generateApiKeyId(): string {
  const random = crypto.randomUUID().split('-')[0];
  return `key_${random}`;
}

/**
 * Generate a unique request ID
 * Format: req_<timestamp>_<random>
 */
export function generateRequestId(): string {
  const timestamp = Date.now();
  const random = crypto.randomUUID().split('-')[0];
  return `req_${timestamp}_${random}`;
}
