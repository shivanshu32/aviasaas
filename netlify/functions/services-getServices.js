import { getDb } from './utils/db.js';

export async function handler(event) {
  // Only allow GET
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const db = await getDb();
    const params = event.queryStringParameters || {};
    
    // Build query
    const query = { isActive: true };
    
    // Filter by category if provided
    if (params.category) {
      query.category = params.category;
    }
    
    // Search by name
    if (params.search) {
      query.name = { $regex: params.search, $options: 'i' };
    }

    const services = await db
      .collection('service_items')
      .find(query)
      .sort({ category: 1, name: 1 })
      .toArray();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        services,
        count: services.length,
      }),
    };
  } catch (error) {
    console.error('Get services error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to fetch services' }),
    };
  }
}
