/**
 * MongoDB Connection Utility for Netlify Serverless Functions
 * 
 * This module implements connection caching to reuse MongoDB connections
 * across warm Lambda invocations, significantly improving performance.
 * 
 * Key Features:
 * - Connection reuse across warm invocations (avoids cold start penalty)
 * - Singleton pattern for MongoClient
 * - Automatic reconnection handling
 * - Optimized connection pool settings for serverless
 * 
 * Usage:
 *   import { getDb, getClient } from './utils/db.js';
 *   
 *   export async function handler(event) {
 *     const db = await getDb();
 *     const patients = await db.collection('patients').find({}).toArray();
 *     return { statusCode: 200, body: JSON.stringify(patients) };
 *   }
 */

import { MongoClient, ServerApiVersion } from 'mongodb';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * MongoDB connection URI from environment variables
 * Format: mongodb+srv://username:password@cluster.mongodb.net/dbname
 */
const MONGODB_URI = process.env.MONGODB_URI;

/**
 * Database name - extracted from URI or use default
 * Can be overridden via environment variable
 */
const DB_NAME = process.env.MONGODB_DB_NAME || 'clinic_db';

/**
 * Connection options optimized for serverless environment
 * 
 * Key settings explained:
 * - maxPoolSize: 10 - Limit connections (Atlas free tier allows 500 total)
 * - minPoolSize: 0 - Allow pool to shrink to 0 when idle
 * - maxIdleTimeMS: 10000 - Close idle connections after 10s
 * - serverSelectionTimeoutMS: 5000 - Fail fast if can't connect
 * - socketTimeoutMS: 45000 - Match Netlify function timeout
 */
const CONNECTION_OPTIONS = {
  maxPoolSize: 10,
  minPoolSize: 0,
  maxIdleTimeMS: 10000,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  retryWrites: true,
  retryReads: true,
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
};

// =============================================================================
// CONNECTION CACHING
// =============================================================================

/**
 * Cached MongoClient instance
 * Stored in module scope to persist across warm Lambda invocations
 * 
 * IMPORTANT: In serverless, the module scope persists between invocations
 * on the same container (warm start), but is reset on cold starts.
 */
let cachedClient = null;

/**
 * Cached database instance
 * Avoids repeated db() calls on the client
 */
let cachedDb = null;

/**
 * Connection promise to prevent race conditions
 * If multiple requests hit during connection, they all await the same promise
 */
let connectionPromise = null;

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

/**
 * Get MongoDB client instance with connection caching
 * 
 * This function implements the singleton pattern for MongoClient.
 * On warm invocations, it returns the cached client immediately.
 * On cold starts, it creates a new connection and caches it.
 * 
 * @returns {Promise<MongoClient>} Connected MongoDB client
 * @throws {Error} If MONGODB_URI is not configured or connection fails
 * 
 * @example
 * const client = await getClient();
 * const session = client.startSession(); // For transactions
 */
export async function getClient() {
  // Validate environment configuration
  if (!MONGODB_URI) {
    throw new Error(
      'MONGODB_URI environment variable is not defined. ' +
      'Please set it in your Netlify environment variables.'
    );
  }

  // Return cached client if available and connected
  if (cachedClient) {
    // Verify the client is still connected
    try {
      // Ping to check connection health (fast operation)
      await cachedClient.db('admin').command({ ping: 1 });
      return cachedClient;
    } catch (error) {
      // Connection lost, clear cache and reconnect
      console.warn('Cached MongoDB connection lost, reconnecting...', error.message);
      cachedClient = null;
      cachedDb = null;
      connectionPromise = null;
    }
  }

  // If connection is in progress, wait for it (prevents race conditions)
  if (connectionPromise) {
    await connectionPromise;
    return cachedClient;
  }

  // Create new connection
  connectionPromise = connectToMongoDB();
  
  try {
    await connectionPromise;
    return cachedClient;
  } finally {
    connectionPromise = null;
  }
}

/**
 * Get database instance with connection caching
 * 
 * This is the primary function you'll use in your serverless functions.
 * It returns a database instance ready for collection operations.
 * 
 * @param {string} [dbName] - Optional database name override
 * @returns {Promise<import('mongodb').Db>} MongoDB database instance
 * 
 * @example
 * const db = await getDb();
 * 
 * // Find documents
 * const patients = await db.collection('patients').find({}).toArray();
 * 
 * // Insert document
 * const result = await db.collection('patients').insertOne({ name: 'John' });
 * 
 * // With specific database
 * const logsDb = await getDb('logs_db');
 */
export async function getDb(dbName = DB_NAME) {
  // Return cached db if using default database and cache exists
  if (dbName === DB_NAME && cachedDb) {
    return cachedDb;
  }

  const client = await getClient();
  const db = client.db(dbName);

  // Cache only the default database
  if (dbName === DB_NAME) {
    cachedDb = db;
  }

  return db;
}

/**
 * Get a specific collection with connection caching
 * 
 * Convenience function to get a collection directly.
 * Useful when you only need one collection in a function.
 * 
 * @param {string} collectionName - Name of the collection
 * @param {string} [dbName] - Optional database name override
 * @returns {Promise<import('mongodb').Collection>} MongoDB collection instance
 * 
 * @example
 * const patientsCollection = await getCollection('patients');
 * const patient = await patientsCollection.findOne({ phone: '9876543210' });
 */
export async function getCollection(collectionName, dbName = DB_NAME) {
  const db = await getDb(dbName);
  return db.collection(collectionName);
}

// =============================================================================
// INTERNAL FUNCTIONS
// =============================================================================

/**
 * Internal function to establish MongoDB connection
 * Called only when no cached connection exists
 * 
 * @returns {Promise<void>}
 * @private
 */
async function connectToMongoDB() {
  console.log('Creating new MongoDB connection...');
  
  const startTime = Date.now();
  
  try {
    // Create new MongoClient instance
    const client = new MongoClient(MONGODB_URI, CONNECTION_OPTIONS);
    
    // Connect to MongoDB
    await client.connect();
    
    // Verify connection with ping
    await client.db('admin').command({ ping: 1 });
    
    const connectionTime = Date.now() - startTime;
    console.log(`MongoDB connected successfully in ${connectionTime}ms`);
    
    // Cache the client and default database
    cachedClient = client;
    cachedDb = client.db(DB_NAME);
    
    // Set up connection event handlers
    setupEventHandlers(client);
    
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    
    // Clear any partial state
    cachedClient = null;
    cachedDb = null;
    
    throw new Error(`Failed to connect to MongoDB: ${error.message}`);
  }
}

/**
 * Set up event handlers for connection monitoring
 * 
 * @param {MongoClient} client - MongoDB client instance
 * @private
 */
function setupEventHandlers(client) {
  // Monitor for connection issues
  client.on('close', () => {
    console.warn('MongoDB connection closed');
    cachedClient = null;
    cachedDb = null;
  });

  client.on('error', (error) => {
    console.error('MongoDB connection error:', error.message);
  });

  client.on('timeout', () => {
    console.warn('MongoDB connection timeout');
  });

  // Optional: Monitor connection pool (useful for debugging)
  if (process.env.DEBUG_MONGODB === 'true') {
    client.on('connectionPoolCreated', (event) => {
      console.log('Connection pool created:', event.address);
    });

    client.on('connectionCheckedOut', () => {
      console.log('Connection checked out from pool');
    });

    client.on('connectionCheckedIn', () => {
      console.log('Connection checked in to pool');
    });
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Close the MongoDB connection
 * 
 * Generally NOT needed in serverless - connections are reused.
 * Use only for cleanup in tests or graceful shutdown scenarios.
 * 
 * @returns {Promise<void>}
 * 
 * @example
 * // In test cleanup
 * afterAll(async () => {
 *   await closeConnection();
 * });
 */
export async function closeConnection() {
  if (cachedClient) {
    console.log('Closing MongoDB connection...');
    await cachedClient.close();
    cachedClient = null;
    cachedDb = null;
    console.log('MongoDB connection closed');
  }
}

/**
 * Check if MongoDB is connected
 * 
 * @returns {boolean} True if connected
 * 
 * @example
 * if (!isConnected()) {
 *   console.log('Database not connected');
 * }
 */
export function isConnected() {
  return cachedClient !== null;
}

/**
 * Get connection statistics (for monitoring/debugging)
 * 
 * @returns {Promise<Object>} Connection statistics
 * 
 * @example
 * const stats = await getConnectionStats();
 * console.log('Pool size:', stats.connections);
 */
export async function getConnectionStats() {
  if (!cachedClient) {
    return { connected: false };
  }

  try {
    const adminDb = cachedClient.db('admin');
    const serverStatus = await adminDb.command({ serverStatus: 1 });
    
    return {
      connected: true,
      connections: serverStatus.connections,
      uptime: serverStatus.uptime,
      version: serverStatus.version,
    };
  } catch (error) {
    return {
      connected: true,
      error: error.message,
    };
  }
}

// =============================================================================
// TRANSACTION HELPER
// =============================================================================

/**
 * Execute a function within a MongoDB transaction
 * 
 * Transactions ensure atomicity - all operations succeed or all fail.
 * Essential for operations like billing where you need to:
 * 1. Create bill
 * 2. Deduct stock
 * Both must succeed or both must rollback.
 * 
 * NOTE: Transactions require MongoDB replica set (Atlas free tier supports this)
 * 
 * @param {Function} transactionFn - Async function receiving (session, db)
 * @returns {Promise<any>} Result of the transaction function
 * @throws {Error} If transaction fails (automatically rolled back)
 * 
 * @example
 * const result = await withTransaction(async (session, db) => {
 *   // Create bill
 *   const billResult = await db.collection('bills').insertOne(
 *     { billNo: 'BILL-001', total: 100 },
 *     { session }
 *   );
 *   
 *   // Deduct stock
 *   await db.collection('stock').updateOne(
 *     { medicineId: 'MED-001' },
 *     { $inc: { quantity: -5 } },
 *     { session }
 *   );
 *   
 *   return billResult;
 * });
 */
export async function withTransaction(transactionFn) {
  const client = await getClient();
  const session = client.startSession();
  
  try {
    let result;
    
    await session.withTransaction(async () => {
      const db = client.db(DB_NAME);
      result = await transactionFn(session, db);
    }, {
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
      maxCommitTimeMS: 5000,
    });
    
    return result;
  } catch (error) {
    console.error('Transaction failed:', error.message);
    throw error;
  } finally {
    await session.endSession();
  }
}

// =============================================================================
// COLLECTION NAMES (for consistency)
// =============================================================================

/**
 * Collection name constants
 * Use these to avoid typos in collection names
 * 
 * @example
 * const db = await getDb();
 * const patients = await db.collection(COLLECTIONS.PATIENTS).find({}).toArray();
 */
export const COLLECTIONS = {
  PATIENTS: 'patients',
  DOCTORS: 'doctors',
  APPOINTMENTS: 'appointments',
  OPD_PRESCRIPTIONS: 'opd_prescriptions',
  OPD_BILLS: 'opd_bills',
  MISC_BILLS: 'misc_bills',
  MEDICINES: 'medicines',
  MEDICINE_STOCK_BATCHES: 'medicine_stock_batches',
  MEDICINE_BILLS: 'medicine_bills',
  CLINIC_SETTINGS: 'clinic_settings',
  SERVICE_ITEMS: 'service_items',
  USERS: 'users',
};

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default {
  getClient,
  getDb,
  getCollection,
  closeConnection,
  isConnected,
  getConnectionStats,
  withTransaction,
  COLLECTIONS,
};
