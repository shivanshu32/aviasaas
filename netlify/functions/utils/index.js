/**
 * Utility Functions Index
 * 
 * Re-exports all utility functions for convenient imports
 * 
 * Usage:
 *   import { getDb, success, withErrorHandler } from './utils/index.js';
 *   
 *   // Or import specific modules
 *   import { getDb } from './utils/db.js';
 */

// Database utilities
export {
  getClient,
  getDb,
  getCollection,
  closeConnection,
  isConnected,
  getConnectionStats,
  withTransaction,
  COLLECTIONS,
} from './db.js';

// Response helpers
export {
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
} from './response.js';

// Error handling
export {
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
} from './errorHandler.js';
