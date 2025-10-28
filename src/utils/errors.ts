/**
 * Custom error classes for better error handling and security
 * Prevents leaking sensitive information in error messages
 */

/**
 * Base error class for all Airtable MCP errors
 */
export class AirtableMCPError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = 'AirtableMCPError';
    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Get sanitized error message safe to return to clients
   * Removes potentially sensitive information
   */
  toClientError(): { error: string; code: string } {
    return {
      error: this.message,
      code: this.code
    };
  }
}

/**
 * Validation error - user provided invalid input
 */
export class ValidationError extends AirtableMCPError {
  constructor(message: string, public readonly details?: string[]) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }

  toClientError(): { error: string; code: string; details?: string[] } {
    return {
      error: this.message,
      code: this.code,
      details: this.details
    };
  }
}

/**
 * Authentication error - API key invalid or missing
 */
export class AuthenticationError extends AirtableMCPError {
  constructor(message: string = 'Invalid or missing API credentials') {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
  }

  toClientError(): { error: string; code: string } {
    // Don't leak specific authentication details
    return {
      error: 'Authentication failed. Please check your API credentials.',
      code: this.code
    };
  }
}

/**
 * Authorization error - user doesn't have permission
 */
export class AuthorizationError extends AirtableMCPError {
  constructor(message: string = 'Permission denied') {
    super(message, 'AUTHORIZATION_ERROR', 403);
    this.name = 'AuthorizationError';
  }

  toClientError(): { error: string; code: string } {
    return {
      error: 'You do not have permission to perform this action.',
      code: this.code
    };
  }
}

/**
 * Not found error - resource doesn't exist
 */
export class NotFoundError extends AirtableMCPError {
  constructor(resource: string, id?: string) {
    const message = id
      ? `${resource} with ID '${id}' not found`
      : `${resource} not found`;
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

/**
 * Rate limit error - too many requests
 */
export class RateLimitError extends AirtableMCPError {
  constructor(
    message: string = 'Too many requests. Please try again later.',
    public readonly retryAfter?: number
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429);
    this.name = 'RateLimitError';
  }

  toClientError(): { error: string; code: string; retryAfter?: number } {
    return {
      error: this.message,
      code: this.code,
      retryAfter: this.retryAfter
    };
  }
}

/**
 * Airtable API error - error from Airtable service
 */
export class AirtableAPIError extends AirtableMCPError {
  constructor(
    message: string,
    public readonly airtableErrorCode?: string,
    statusCode: number = 500
  ) {
    super(message, 'AIRTABLE_API_ERROR', statusCode);
    this.name = 'AirtableAPIError';
  }

  toClientError(): { error: string; code: string } {
    // Sanitize Airtable error messages to prevent information leakage
    const sanitizedMessage = this.sanitizeAirtableError(this.message);
    return {
      error: sanitizedMessage,
      code: this.code
    };
  }

  private sanitizeAirtableError(message: string): string {
    // Remove API keys, base IDs, and other sensitive info from error messages
    return message
      .replace(/key[a-zA-Z0-9]{14,}/gi, 'key***')  // Redact API keys
      .replace(/app[a-zA-Z0-9]{14}/gi, 'app***')   // Redact base IDs
      .replace(/rec[a-zA-Z0-9]{14}/gi, 'rec***')   // Redact record IDs (keep first 3 chars)
      .replace(/Bearer\s+[^\s]+/gi, 'Bearer ***'); // Redact Bearer tokens
  }
}

/**
 * Internal server error - something unexpected happened
 */
export class InternalServerError extends AirtableMCPError {
  constructor(
    message: string = 'An internal error occurred',
    public readonly originalError?: Error
  ) {
    super(message, 'INTERNAL_SERVER_ERROR', 500);
    this.name = 'InternalServerError';
  }

  toClientError(): { error: string; code: string } {
    // Never expose internal error details to clients
    return {
      error: 'An internal error occurred. Please try again later.',
      code: this.code
    };
  }
}

/**
 * Formula injection error - detected malicious formula input
 */
export class FormulaInjectionError extends AirtableMCPError {
  constructor(fieldName: string) {
    super(
      `Invalid field name "${fieldName}": contains potentially dangerous characters`,
      'FORMULA_INJECTION_DETECTED',
      400
    );
    this.name = 'FormulaInjectionError';
  }
}

/**
 * Payload too large error - request exceeds size limits
 */
export class PayloadTooLargeError extends AirtableMCPError {
  constructor(
    resource: string,
    limit: number,
    actual: number
  ) {
    super(
      `${resource} exceeds maximum size limit. Max: ${limit}, Actual: ${actual}`,
      'PAYLOAD_TOO_LARGE',
      413
    );
    this.name = 'PayloadTooLargeError';
  }
}

/**
 * Configuration error - missing required configuration like base ID
 * This error is safe to show to users as it contains helpful guidance
 */
export class ConfigurationError extends AirtableMCPError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR', 400);
    this.name = 'ConfigurationError';
  }

  toClientError(): { error: string; code: string } {
    // Pass through the full message as it contains helpful guidance
    return {
      error: this.message,
      code: this.code
    };
  }
}

/**
 * Safely wrap unknown errors into our error types
 */
export function wrapError(error: unknown): AirtableMCPError {
  if (error instanceof AirtableMCPError) {
    return error;
  }

  if (error instanceof Error) {
    // Check if it's an Airtable API error
    if (error.message.includes('AIRTABLE') || error.message.includes('API')) {
      return new AirtableAPIError(error.message);
    }

    // Check if it's an authentication error
    const lowerMessage = error.message.toLowerCase();
    if (lowerMessage.includes('unauthorized') ||
        lowerMessage.includes('invalid api key') ||
        lowerMessage.includes('invalid key') ||
        lowerMessage.includes('authentication failed')) {
      return new AuthenticationError();
    }

    // Check if it's a not found error
    if (error.message.toLowerCase().includes('not found') ||
        error.message.toLowerCase().includes('could not find')) {
      const match = error.message.match(/table\s+['"]?([^'"]+)['"]?/i);
      const resource = match ? `Table '${match[1]}'` : 'Resource';
      return new NotFoundError(resource);
    }

    // Default to internal server error
    return new InternalServerError(error.message, error);
  }

  // Unknown error type
  return new InternalServerError('An unexpected error occurred');
}

/**
 * Legacy logError function - now delegates to logger module
 * @deprecated Import from logger.ts instead
 */
export function logError(error: unknown, context?: Record<string, any>): void {
  // This will be replaced by logger.ts import
  // Kept for backwards compatibility during migration
  // NOTE: Do not use console.error - it breaks MCP stdio communication
  // Errors are logged via Winston logger instead (imported from logger.ts)
  const errorObj = wrapError(error);
  // Silently wrap error - actual logging happens in logger.ts
}
