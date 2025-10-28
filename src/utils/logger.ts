/**
 * Structured logging configuration using Winston
 * Provides secure, production-ready logging with automatic credential redaction
 */

import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

/**
 * Custom log format with timestamp and structured data
 */
const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;

  // Add metadata if present
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }

  return msg;
});

/**
 * Sanitize sensitive data from logs
 * Redacts API keys, tokens, passwords, etc.
 */
const sanitizeFormat = winston.format((info) => {
  const sanitized = { ...info };

  // Recursively sanitize object values
  const sanitizeObject = (obj: any): any => {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const result: any = Array.isArray(obj) ? [] : {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();

      // Redact sensitive keys
      if (
        lowerKey.includes('api_key') ||
        lowerKey.includes('apikey') ||
        lowerKey.includes('password') ||
        lowerKey.includes('token') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('authorization') ||
        lowerKey.includes('bearer')
      ) {
        result[key] = '***REDACTED***';
      } else if (typeof value === 'string') {
        // Redact patterns in string values
        result[key] = value
          .replace(/key[a-zA-Z0-9]{14,}/gi, 'key***')  // API keys
          .replace(/app[a-zA-Z0-9]{14}/gi, 'app***')   // Base IDs
          .replace(/Bearer\s+[^\s]+/gi, 'Bearer ***'); // Bearer tokens
      } else if (typeof value === 'object') {
        result[key] = sanitizeObject(value);
      } else {
        result[key] = value;
      }
    }

    return result;
  };

  // Sanitize the entire log object
  return sanitizeObject(sanitized);
});

/**
 * Create logger instance with environment-appropriate configuration
 * NOTE: MCP servers communicate via stdio, so we CANNOT use console logging
 * All logs must go to files only to avoid interfering with JSON-RPC protocol
 */
const createLogger = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

  // For MCP servers, we use a no-op logger to avoid file I/O issues
  // The MCP SDK handles logging automatically
  const transports: winston.transport[] = [];

  // Only add file transports if explicitly enabled via env var
  // This prevents crashes when running as an extension where file paths may not be writable
  if (process.env.ENABLE_FILE_LOGGING === 'true') {
    try {
      transports.push(
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          format: combine(
            timestamp(),
            errors({ stack: true }),
            sanitizeFormat(),
            winston.format.json()
          )
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
          format: combine(
            timestamp(),
            errors({ stack: true }),
            sanitizeFormat(),
            isProduction ? winston.format.json() : logFormat
          )
        })
      );
    } catch (error) {
      // Silently fail if we can't create file transports
      // This is expected in extension mode
    }
  }

  return winston.createLogger({
    level: logLevel,
    transports,
    // Silence winston if no transports (prevents console warnings)
    silent: transports.length === 0,
    // Don't exit on uncaught exceptions - let the app handle it
    exitOnError: false
  });
};

/**
 * Global logger instance
 */
export const logger = createLogger();

/**
 * Log an error with context
 * Automatically sanitizes sensitive data
 */
export function logError(error: unknown, context?: Record<string, any>): void {
  const errorObj = error instanceof Error ? error : new Error(String(error));

  logger.error(errorObj.message, {
    name: errorObj.name,
    stack: errorObj.stack,
    context: context || {}
  });
}

/**
 * Log API request
 */
export function logRequest(tool: string, params: Record<string, any>): void {
  logger.info('API Request', {
    tool,
    params: sanitizeParams(params)
  });
}

/**
 * Log API response
 */
export function logResponse(tool: string, success: boolean, duration?: number): void {
  logger.info('API Response', {
    tool,
    success,
    duration: duration ? `${duration}ms` : undefined
  });
}

/**
 * Log security event
 */
export function logSecurityEvent(
  event: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  details?: Record<string, any>
): void {
  logger.warn('Security Event', {
    event,
    severity,
    details: details || {}
  });
}

/**
 * Sanitize parameters for logging
 */
function sanitizeParams(params: Record<string, any>): Record<string, any> {
  const sanitized = { ...params };

  // Limit array sizes in logs
  for (const [key, value] of Object.entries(sanitized)) {
    if (Array.isArray(value) && value.length > 10) {
      sanitized[key] = `[Array(${value.length})]`;
    }
  }

  return sanitized;
}

/**
 * Create child logger with additional context
 */
export function createChildLogger(defaultMeta: Record<string, any>) {
  return logger.child(defaultMeta);
}

// Export logger methods for convenience
export const {
  debug,
  info,
  warn,
  error
} = logger;
