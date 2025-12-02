import { ObjectId } from 'mongodb';
import { getDb } from './utils/db.js';

export async function handler(event) {
  // Only allow DELETE
  if (event.httpMethod !== 'DELETE') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const db = await getDb();
    const params = event.queryStringParameters || {};
    const serviceId = params.id;

    if (!serviceId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Service ID is required' }),
      };
    }

    // Validate ObjectId
    if (!ObjectId.isValid(serviceId)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid service ID' }),
      };
    }

    // Check if service exists
    const existing = await db.collection('service_items').findOne({
      _id: new ObjectId(serviceId),
    });

    if (!existing) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Service not found' }),
      };
    }

    // Soft delete - set isActive to false
    await db.collection('service_items').updateOne(
      { _id: new ObjectId(serviceId) },
      { 
        $set: { 
          isActive: false,
          deletedAt: new Date(),
        } 
      }
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Service deleted successfully',
      }),
    };
  } catch (error) {
    console.error('Delete service error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to delete service' }),
    };
  }
}
