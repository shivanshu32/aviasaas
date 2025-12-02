/**
 * Standardized API Response Helpers for Netlify Functions
 * 
 * Provides consistent response formatting across all API endpoints.
 * Includes proper CORS headers and error handling.
 * 
 * Usage:
 *   import { success, error, notFound } from './utils/response.js';
 *   
 *   // Success response
 *   return success({ patients: [...] });
 *   
 *   // Error response
 *   return error('Validation failed', 400, { field: 'phone' });
 */

// =============================================================================
// CORS HEADERS
// =============================================================================

/**
 * Default CORS headers for all responses
 * Allows requests from any origin (adjust for production if needed)
 */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

// =============================================================================
// SUCCESS RESPONSES
// =============================================================================

/**
 * Create a success response (200 OK)
 * 
 * @param {Object} data - Response data
 * @param {string} [message] - Optional success message
 * @returns {Object} Netlify function response object
 * 
 * @example
 * return success({ patient: { id: '123', name: 'John' } });
 * 
 * // With message
 * return success({ patient }, 'Patient created successfully');
 */
export function success(data = {}, message = null) {
  const body = {
    success: true,
    ...data,
  };

  if (message) {
    body.message = message;
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

/**
 * Create a created response (201 Created)
 * Use when a new resource is created
 * 
 * @param {Object} data - Created resource data
 * @param {string} [message] - Optional success message
 * @returns {Object} Netlify function response object
 * 
 * @example
 * return created({ patient: newPatient }, 'Patient registered successfully');
 */
export function created(data = {}, message = 'Resource created successfully') {
  return {
    statusCode: 201,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success: true,
      message,
      ...data,
    }),
  };
}

/**
 * Create a no content response (204 No Content)
 * Use for successful DELETE operations
 * 
 * @returns {Object} Netlify function response object
 * 
 * @example
 * await db.collection('patients').deleteOne({ _id });
 * return noContent();
 */
export function noContent() {
  return {
    statusCode: 204,
    headers: CORS_HEADERS,
    body: '',
  };
}

// =============================================================================
// ERROR RESPONSES
// =============================================================================

/**
 * Create a generic error response
 * 
 * @param {string} message - Error message
 * @param {number} [statusCode=500] - HTTP status code
 * @param {Object} [details] - Additional error details
 * @returns {Object} Netlify function response object
 * 
 * @example
 * return error('Something went wrong', 500);
 * 
 * // With details
 * return error('Validation failed', 400, { 
 *   errors: [{ field: 'phone', message: 'Invalid phone number' }] 
 * });
 */
export function error(message, statusCode = 500, details = null) {
  const body = {
    success: false,
    error: message,
  };

  if (details) {
    body.details = details;
  }

  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

/**
 * Create a bad request response (400)
 * Use for validation errors or malformed requests
 * 
 * @param {string} [message] - Error message
 * @param {Object} [errors] - Validation errors object
 * @returns {Object} Netlify function response object
 * 
 * @example
 * return badRequest('Invalid request body');
 * 
 * // With validation errors
 * return badRequest('Validation failed', {
 *   name: 'Name is required',
 *   phone: 'Phone must be 10 digits'
 * });
 */
export function badRequest(message = 'Bad request', errors = null) {
  const body = {
    success: false,
    error: message,
  };

  if (errors) {
    body.errors = errors;
  }

  return {
    statusCode: 400,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

/**
 * Create an unauthorized response (401)
 * Use when authentication is required but not provided
 * 
 * @param {string} [message] - Error message
 * @returns {Object} Netlify function response object
 * 
 * @example
 * if (!authToken) {
 *   return unauthorized('Authentication required');
 * }
 */
export function unauthorized(message = 'Unauthorized') {
  return {
    statusCode: 401,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success: false,
      error: message,
    }),
  };
}

/**
 * Create a forbidden response (403)
 * Use when user is authenticated but not authorized
 * 
 * @param {string} [message] - Error message
 * @returns {Object} Netlify function response object
 * 
 * @example
 * if (!user.isAdmin) {
 *   return forbidden('Admin access required');
 * }
 */
export function forbidden(message = 'Forbidden') {
  return {
    statusCode: 403,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success: false,
      error: message,
    }),
  };
}

/**
 * Create a not found response (404)
 * Use when requested resource doesn't exist
 * 
 * @param {string} [resource] - Name of the resource
 * @returns {Object} Netlify function response object
 * 
 * @example
 * const patient = await db.collection('patients').findOne({ _id });
 * if (!patient) {
 *   return notFound('Patient');
 * }
 */
export function notFound(resource = 'Resource') {
  return {
    statusCode: 404,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success: false,
      error: `${resource} not found`,
    }),
  };
}

/**
 * Create a conflict response (409)
 * Use when there's a conflict with existing data (e.g., duplicate)
 * 
 * @param {string} [message] - Error message
 * @param {Object} [details] - Conflict details
 * @returns {Object} Netlify function response object
 * 
 * @example
 * const existing = await db.collection('patients').findOne({ phone });
 * if (existing) {
 *   return conflict('Patient with this phone number already exists');
 * }
 */
export function conflict(message = 'Resource already exists', details = null) {
  const body = {
    success: false,
    error: message,
  };

  if (details) {
    body.details = details;
  }

  return {
    statusCode: 409,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

/**
 * Create an unprocessable entity response (422)
 * Use for semantic errors in request data
 * 
 * @param {string} [message] - Error message
 * @param {Object} [errors] - Validation errors
 * @returns {Object} Netlify function response object
 * 
 * @example
 * if (stock.currentQty < requestedQty) {
 *   return unprocessable('Insufficient stock', { 
 *     available: stock.currentQty, 
 *     requested: requestedQty 
 *   });
 * }
 */
export function unprocessable(message = 'Unprocessable entity', errors = null) {
  const body = {
    success: false,
    error: message,
  };

  if (errors) {
    body.errors = errors;
  }

  return {
    statusCode: 422,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

/**
 * Create an internal server error response (500)
 * Use for unexpected errors
 * 
 * @param {string} [message] - Error message
 * @param {Error} [err] - Original error object (for logging)
 * @returns {Object} Netlify function response object
 * 
 * @example
 * try {
 *   // ... operation
 * } catch (err) {
 *   console.error('Operation failed:', err);
 *   return serverError('Failed to process request', err);
 * }
 */
export function serverError(message = 'Internal server error', err = null) {
  // Log the actual error for debugging (visible in Netlify logs)
  if (err) {
    console.error('Server Error:', err);
  }

  return {
    statusCode: 500,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success: false,
      error: message,
      // Only include error details in development
      ...(process.env.NODE_ENV === 'development' && err && {
        debug: err.message,
      }),
    }),
  };
}

// =============================================================================
// SPECIAL RESPONSES
// =============================================================================

/**
 * Handle CORS preflight OPTIONS request
 * 
 * @returns {Object} Netlify function response object
 * 
 * @example
 * export async function handler(event) {
 *   if (event.httpMethod === 'OPTIONS') {
 *     return handleCors();
 *   }
 *   // ... rest of handler
 * }
 */
export function handleCors() {
  return {
    statusCode: 204,
    headers: CORS_HEADERS,
    body: '',
  };
}

/**
 * Create a method not allowed response (405)
 * Use when HTTP method is not supported
 * 
 * @param {string[]} allowedMethods - List of allowed methods
 * @returns {Object} Netlify function response object
 * 
 * @example
 * if (!['GET', 'POST'].includes(event.httpMethod)) {
 *   return methodNotAllowed(['GET', 'POST']);
 * }
 */
export function methodNotAllowed(allowedMethods = []) {
  return {
    statusCode: 405,
    headers: {
      ...CORS_HEADERS,
      'Allow': allowedMethods.join(', '),
    },
    body: JSON.stringify({
      success: false,
      error: 'Method not allowed',
      allowedMethods,
    }),
  };
}

// =============================================================================
// PAGINATION HELPER
// =============================================================================

/**
 * Create a paginated success response
 * 
 * @param {Object} options - Pagination options
 * @param {Array} options.data - Array of items
 * @param {number} options.total - Total count of items
 * @param {number} options.page - Current page number
 * @param {number} options.limit - Items per page
 * @param {string} [options.dataKey='data'] - Key name for data array
 * @returns {Object} Netlify function response object
 * 
 * @example
 * const patients = await db.collection('patients')
 *   .find({})
 *   .skip((page - 1) * limit)
 *   .limit(limit)
 *   .toArray();
 * 
 * const total = await db.collection('patients').countDocuments({});
 * 
 * return paginated({
 *   data: patients,
 *   total,
 *   page,
 *   limit,
 *   dataKey: 'patients'
 * });
 */
export function paginated({ data, total, page, limit, dataKey = 'data' }) {
  const totalPages = Math.ceil(total / limit);
  
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success: true,
      [dataKey]: data,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    }),
  };
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default {
  success,
  created,
  noContent,
  error,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  unprocessable,
  serverError,
  handleCors,
  methodNotAllowed,
  paginated,
};
