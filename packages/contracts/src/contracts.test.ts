import { describe, it, expect } from 'vitest';
import {
  IDEMPOTENCY_KEY_HEADER,
  CORRELATION_ID_HEADER,
  REQUEST_ID_HEADER,
  TENANT_ID_HEADER,
} from './headers/Headers';

describe('Contracts - Headers', () => {
  it('should export standard header constants', () => {
    expect(IDEMPOTENCY_KEY_HEADER).toBe('Idempotency-Key');
    expect(CORRELATION_ID_HEADER).toBe('X-Correlation-Id');
    expect(REQUEST_ID_HEADER).toBe('X-Request-Id');
    expect(TENANT_ID_HEADER).toBe('X-Tenant-Id');
  });

  it('should have string values', () => {
    expect(typeof IDEMPOTENCY_KEY_HEADER).toBe('string');
    expect(typeof CORRELATION_ID_HEADER).toBe('string');
    expect(typeof REQUEST_ID_HEADER).toBe('string');
    expect(typeof TENANT_ID_HEADER).toBe('string');
  });
});
