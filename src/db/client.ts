/**
 * D1 Database client wrapper
 * Provides typed query helpers and common utilities
 */

export interface DbResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DbListResult<T> {
  success: boolean;
  data: T[];
  error?: string;
}

/**
 * Helper to extract first row from D1 result
 */
export function firstRow<T>(result: D1Result<T>): DbResult<T> {
  if (!result.success) {
    return { success: false, error: 'Query failed' };
  }
  if (result.results.length === 0) {
    return { success: false, error: 'Not found' };
  }
  return { success: true, data: result.results[0]! };
}

/**
 * Helper to extract all rows from D1 result
 */
export function allRows<T>(result: D1Result<T>): DbListResult<T> {
  if (!result.success) {
    return { success: false, data: [], error: 'Query failed' };
  }
  return { success: true, data: result.results };
}

/**
 * Helper to check if a query affected rows
 */
export function wasSuccessful(result: D1Result<unknown>): boolean {
  return result.success && (result.meta.rows_written ?? 0) > 0;
}

/**
 * Parse JSON column safely
 */
export function parseJsonColumn<T>(column: string | null | undefined, fallback: T): T {
  if (!column) return fallback;
  try {
    return JSON.parse(column) as T;
  } catch {
    return fallback;
  }
}

/**
 * Stringify JSON for database storage
 */
export function stringifyJson(value: unknown): string {
  return JSON.stringify(value);
}
