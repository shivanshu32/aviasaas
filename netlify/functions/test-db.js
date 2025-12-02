/**
 * Test DB Connection
 * Endpoint: GET /.netlify/functions/test-db
 */

import { getDb } from './utils/db.js';

export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    console.log('Testing DB connection...');
    console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);
    console.log('MONGODB_URI prefix:', process.env.MONGODB_URI?.substring(0, 20) + '...');
    
    const db = await getDb();
    
    // Test ping
    await db.command({ ping: 1 });
    
    // List collections
    const collections = await db.listCollections().toArray();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Database connected successfully!',
        database: db.databaseName,
        collections: collections.map(c => c.name),
      }),
    };
  } catch (error) {
    console.error('DB Test Error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        hint: error.message.includes('MONGODB_URI') 
          ? 'Set MONGODB_URI in your .env file'
          : error.message.includes('authentication')
          ? 'Check your MongoDB username/password'
          : error.message.includes('network') || error.message.includes('ENOTFOUND')
          ? 'Check your network or MongoDB Atlas IP whitelist (add 0.0.0.0/0 for dev)'
          : 'Check MongoDB Atlas dashboard for issues',
      }),
    };
  }
}
