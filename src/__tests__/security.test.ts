/**
 * Security-focused tests - Only tests that prevent real vulnerabilities
 * No fluff, no testing obvious Zod behavior, no redundant tests
 */

import { describe, it, expect } from '@jest/globals';
import {
  buildAgeRangeFormula,
  buildMultipleSelectHasAny,
  buildNumberRangeFormula,
  buildDateRangeFormula
} from '../utils/query-helpers.js';
import {
  listRecordsSchema,
  getRecordSchema,
  createRecordSchema
} from '../validation/tool-schemas.js';
import {
  AirtableAPIError,
  wrapError
} from '../utils/errors.js';

describe('Formula Injection Prevention', () => {
  it('prevents SQL injection via single quote escaping', () => {
    const result = buildMultipleSelectHasAny('Field', ["'; DROP TABLE users--"]);
    // Should use SQL-style escaping ('' not \')
    expect(result).toContain("''; DROP TABLE users--");
    expect(result).not.toContain("\\'");
  });

  it('prevents field name injection with curly braces', () => {
    // Attacker tries to break out of {FieldName} context
    expect(() => buildAgeRangeFormula('Field}OR{Evil', 25, 34, ['25-34']))
      .toThrow(/Invalid field name/);
  });

  it('prevents field name injection with newlines', () => {
    expect(() => buildAgeRangeFormula('Field\nOR 1=1', 25, 34, ['25-34']))
      .toThrow(/Invalid field name/);
  });

  it('prevents number injection via NaN', () => {
    expect(() => buildNumberRangeFormula('Rating', NaN, 5))
      .toThrow(/finite number/);
  });

  it('prevents number injection via Infinity', () => {
    expect(() => buildNumberRangeFormula('Rating', Infinity, 5))
      .toThrow(/finite number/);
  });

  it('prevents date injection with invalid formats', () => {
    // Only ISO 8601 allowed - validates format, not actual date validity
    expect(() => buildDateRangeFormula('Created', '01/01/2024', undefined))
      .toThrow(/ISO 8601 format/);
    expect(() => buildDateRangeFormula('Created', 'random-string', undefined))
      .toThrow(/ISO 8601 format/);
  });
});

describe('DoS Protection', () => {
  it('rejects requests with excessive record limits', () => {
    const result = listRecordsSchema.safeParse({
      table: 'Test',
      maxRecords: 10000  // Max is 1000
    });
    expect(result.success).toBe(false);
  });

  it('rejects arrays that could cause memory exhaustion', () => {
    const result = listRecordsSchema.safeParse({
      table: 'Test',
      fields: Array(1000).fill('field')  // Max is 100
    });
    expect(result.success).toBe(false);
  });

  it('rejects excessively long strings', () => {
    const result = listRecordsSchema.safeParse({
      table: 'A'.repeat(2000),  // Max is 1000
    });
    expect(result.success).toBe(false);
  });
});

describe('Input Validation for Common Attacks', () => {
  it('rejects SQL injection attempt in table name', () => {
    const result = listRecordsSchema.safeParse({
      table: "Users'; DROP TABLE users--"
    });
    expect(result.success).toBe(false);
  });

  it('rejects table names with special characters', () => {
    const result = listRecordsSchema.safeParse({
      table: "Table{}DROP"
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid record ID formats that bypass API validation', () => {
    const invalidIds = [
      'rec123',               // Too short - would cause API error
      'ABC123456789012',      // Wrong prefix - would cause API error
      'rec{DROP}',            // Injection attempt
      '../../../etc/passwd'   // Path traversal attempt
    ];

    invalidIds.forEach(recordId => {
      const result = getRecordSchema.safeParse({ table: 'Test', recordId });
      expect(result.success).toBe(false);
    });
  });

  it('prevents NoSQL-style injection via empty object fields', () => {
    const result = createRecordSchema.safeParse({
      table: 'Test',
      fields: {}  // Should require at least one field
    });
    expect(result.success).toBe(false);
  });
});

describe('Credential Redaction in Errors', () => {
  it('redacts Airtable API keys from error messages', () => {
    const error = new AirtableAPIError('Authentication failed with key keyABCDEFGHIJKLMNOPQR');
    const clientError = error.toClientError();
    expect(clientError.error).toContain('key***');
    expect(clientError.error).not.toContain('keyABCDEFGHIJKLMNOPQR');
  });

  it('redacts base IDs from error messages', () => {
    const error = new AirtableAPIError('Base appABCDEFGHIJKLMN not found');
    const clientError = error.toClientError();
    expect(clientError.error).toContain('app***');
    expect(clientError.error).not.toContain('appABCDEFGHIJKLMN');
  });

  it('redacts record IDs from error messages', () => {
    const error = new AirtableAPIError('Record recABCDEFGHIJKLMN not found');
    const clientError = error.toClientError();
    expect(clientError.error).toContain('rec***');
    expect(clientError.error).not.toContain('recABCDEFGHIJKLMN');
  });

  it('redacts Bearer tokens from error messages', () => {
    const error = new AirtableAPIError('Request failed: Bearer keyABCDEFGHIJKLMNOPQR invalid');
    const clientError = error.toClientError();
    expect(clientError.error).toContain('Bearer ***');
    expect(clientError.error).not.toContain('keyABCDEFGHIJKLMNOPQR');
  });

  it('redacts multiple credential types in one message', () => {
    const error = new AirtableAPIError(
      'Failed: base appABCDEF12345678 with key keyXYZ78901234567 for record recDEF45678901234'
    );
    const clientError = error.toClientError();

    expect(clientError.error).toContain('app***');
    expect(clientError.error).toContain('key***');
    expect(clientError.error).toContain('rec***');
    expect(clientError.error).not.toContain('appABCDEF12345678');
    expect(clientError.error).not.toContain('keyXYZ78901234567');
    expect(clientError.error).not.toContain('recDEF45678901234');
  });
});

describe('Error Wrapping Security', () => {
  it('never exposes internal errors to clients', () => {
    const internalError = new Error('Database password: secret123');
    const wrapped = wrapError(internalError);
    const clientError = wrapped.toClientError();

    expect(clientError.error).not.toContain('password');
    expect(clientError.error).not.toContain('secret123');
    expect(clientError.error).toBe('An internal error occurred. Please try again later.');
  });

  it('wraps authentication errors to avoid information leakage', () => {
    const error = new Error('Invalid key for user john@example.com');
    const wrapped = wrapError(error);
    const clientError = wrapped.toClientError();

    // Should not leak specific user info
    expect(clientError.error).toBe('Authentication failed. Please check your API credentials.');
    expect(clientError.error).not.toContain('john@example.com');
  });
});

describe('Real-World Attack Scenarios', () => {
  it('prevents chained formula injection attack', () => {
    // Attacker tries: Field'}OR{Status='Admin to bypass filters
    expect(() => buildMultipleSelectHasAny("Field'}OR{Status", ["value"]))
      .toThrow(/Invalid field name/);
  });

  it('prevents formula injection via range values', () => {
    // Even if field name is safe, values must be escaped
    const result = buildAgeRangeFormula('Age', 25, 34, ["25-34'; DELETE"]);
    expect(result).toContain("25-34''; DELETE");  // Escaped, not executed
  });

  it('prevents bypassing validation with zero-width characters', () => {
    // Table name with zero-width space - our regex should reject non-standard chars
    const result = listRecordsSchema.safeParse({ table: 'Table\u200B' });
    // Zero-width space is not in our allowed charset
    expect(result.success).toBe(false);
  });
});
