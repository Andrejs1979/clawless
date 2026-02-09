/**
 * Example test file
 * Tests will be added as we build out functionality
 */

import { describe, it, expect } from 'vitest';

import { generateTenantId, generateSessionId } from '@/lib/id';

describe('ID Generation', () => {
  it('should generate a valid tenant ID', () => {
    const id = generateTenantId();
    expect(id).toMatch(/^tenant_[a-f0-9]+$/);
  });

  it('should generate a valid session ID', () => {
    const id = generateSessionId();
    expect(id).toMatch(/^sess_[a-f0-9]+$/);
  });

  it('should generate unique IDs', () => {
    const id1 = generateTenantId();
    const id2 = generateTenantId();
    expect(id1).not.toBe(id2);
  });
});
