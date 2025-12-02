/**
 * Centralized Error Handler for Netlify Functions
 * 
 * Provides consistent error handling and logging across all API endpoints.
 * Wraps handler functions to catch and format errors automatically.
 * 
 * Usage:
 *   import { withErrorHandler } from './utils/errorHandler.js';
 *   
 *   async function handler(event) {
 *     // Your logic here - errors are caught automatically
 *   }
 *   
 *   export const handler = withErrorHandler(mainHandler);
 */

import { serverError, badRequest, handleCors } from './response.js';

// =============================================================================
// CUSTOM ERROR CLASSES
// =============================================================================

/**
 * Base class for application errors
 * Extends Error with statusCode and details
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error (400 Bad Request)
 * Use for input validation failures
 * 
 * @example
 * throw new ValidationError('Invalid input', { phone: 'Must be 10 digits' });
 */
export class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors = null) {
    super(message, 400, errors);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/**
 * Not found error (404)
 * Use when resource doesn't exist
 * 
 * @example
 * throw new NotFoundError('Patient');
 */
export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
    this.name = 'NotFoundError';
    this.resource = resource;
  }
}

/**
 * Conflict error (409)
 * Use for duplicate entries
 * 
 * @example
 * throw new ConflictError('Patient with this phone already exists');
 */
export class ConflictError extends AppError {
  constructor(message = 'Resource already exists', details = null) {
    super(message, 409, details);
    this.name = 'ConflictError';
  }
}

/**
 * Unauthorized error (401)
 * Use when authentication is required
 * 
 * @example
 * throw new UnauthorizedError('Invalid token');
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Forbidden error (403)
 * Use when user lacks permission
 * 
 * @example
 * throw new ForbiddenError('Admin access required');
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

/**
 * Insufficient stock error (422)
 * Use when stock is not available
 * 
 * @example
 * throw new InsufficientStockError('Paracetamol', 10, 5);
 */
export class InsufficientStockError extends AppError {
  constructor(medicineName, requested, available) {
    super(`Insufficient stock for ${medicineName}`, 422, {
      medicineName,
      requested,
      available,
    });
    this.name = 'InsufficientStockError';
  }
}

// =============================================================================
// ERROR HANDLER WRAPPER
// =============================================================================

/**
 * Higher-order function that wraps a handler with error handling
 * 
 * Features:
 * - Catches all errors and returns appropriate responses
 * - Handles CORS preflight requests automatically
 * - Logs errors for debugging
 * - Parses JSON body automatically
 * 
 * @param {Function} handler - Async handler function
 * @returns {Function} Wrapped handler function
 * 
 * @example
 * async function mainHandler(event, context) {
 *   const db = await getDb();
 *   const patients = await db.collection('patients').find({}).toArray();
 *   return success({ patients });
 * }
 * 
 * export const handler = withErrorHandler(mainHandler);
 */
export function withErrorHandler(handler) {
  return async (event, context) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return handleCors();
    }

    try {
      // Parse JSON body if present
      if (event.body && typeof event.body === 'string') {
        try {
          event.parsedBody = JSON.parse(event.body);
        } catch (parseError) {
          return badRequest('Invalid JSON in request body');
        }
      }

      // Parse query parameters
      event.query = event.queryStringParameters || {};

      // Execute the handler
      return await handler(event, context);

    } catch (error) {
      return handleError(error);
    }
  };
}

/**
 * Convert error to appropriate HTTP response
 * 
 * @param {Error} error - Error object
 * @returns {Object} Netlify function response
 */
function handleError(error) {
  // Log error for debugging (visible in Netlify logs)
  console.error('Error:', {
    name: error.name,
    message: error.message,
    statusCode: error.statusCode,
    stack: error.stack,
  });

  // Handle known application errors
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
        ...(error.errors && { errors: error.errors }),
        ...(error.details && { details: error.details }),
      }),
    };
  }

  // Handle MongoDB duplicate key error
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0] || 'field';
    return {
      statusCode: 409,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: `Duplicate value for ${field}`,
        field,
      }),
    };
  }

  // Handle MongoDB validation errors
  if (error.name === 'MongoServerError') {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Database operation failed',
        details: error.message,
      }),
    };
  }

  // Handle Zod validation errors
  if (error.name === 'ZodError') {
    const errors = error.errors.reduce((acc, err) => {
      const path = err.path.join('.');
      acc[path] = err.message;
      return acc;
    }, {});

    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Validation failed',
        errors,
      }),
    };
  }

  // Handle unknown errors
  return serverError('An unexpected error occurred', error);
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Assert a condition, throw ValidationError if false
 * 
 * @param {boolean} condition - Condition to check
 * @param {string} message - Error message if condition is false
 * @param {Object} [errors] - Validation errors object
 * @throws {ValidationError}
 * 
 * @example
 * assertValid(phone.length === 10, 'Phone must be 10 digits', { phone: 'Invalid' });
 */
export function assertValid(condition, message, errors = null) {
  if (!condition) {
    throw new ValidationError(message, errors);
  }
}

/**
 * Assert resource exists, throw NotFoundError if null
 * 
 * @param {any} resource - Resource to check
 * @param {string} resourceName - Name of the resource for error message
 * @throws {NotFoundError}
 * 
 * @example
 * const patient = await db.collection('patients').findOne({ _id });
 * assertExists(patient, 'Patient');
 */
export function assertExists(resource, resourceName) {
  if (!resource) {
    throw new NotFoundError(resourceName);
  }
}

/**
 * Assert no duplicate exists, throw ConflictError if found
 * 
 * @param {any} existing - Existing resource (should be null/undefined)
 * @param {string} message - Error message if duplicate found
 * @throws {ConflictError}
 * 
 * @example
 * const existing = await db.collection('patients').findOne({ phone });
 * assertNoDuplicate(existing, 'Patient with this phone already exists');
 */
export function assertNoDuplicate(existing, message) {
  if (existing) {
    throw new ConflictError(message);
  }
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default {
  withErrorHandler,
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  InsufficientStockError,
  assertValid,
  assertExists,
  assertNoDuplicate,
};
