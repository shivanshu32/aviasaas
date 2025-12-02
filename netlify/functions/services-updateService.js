import { ObjectId } from 'mongodb';
import { getDb } from './utils/db.js';

export async function handler(event) {
  // Only allow PUT
  if (event.httpMethod !== 'PUT') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const db = await getDb();
    const data = JSON.parse(event.body);
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

    // Build update object
    const updateData = {
      updatedAt: new Date(),
    };

    if (data.name && data.name.trim()) {
      // Check for duplicate name in same category (excluding current)
      const duplicate = await db.collection('service_items').findOne({
        _id: { $ne: new ObjectId(serviceId) },
        name: { $regex: `^${data.name.trim()}$`, $options: 'i' },
        category: data.category || existing.category,
        isActive: true,
      });

      if (duplicate) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Service with this name already exists in this category' }),
        };
      }
      updateData.name = data.name.trim();
    }

    if (data.category) {
      const validCategories = ['laboratory', 'radiology', 'procedure', 'other'];
      if (!validCategories.includes(data.category)) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Invalid category' }),
        };
      }
      updateData.category = data.category;
    }

    if (data.rate !== undefined) {
      if (data.rate <= 0) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Valid rate is required' }),
        };
      }
      updateData.rate = Number(data.rate);
    }

    if (data.description !== undefined) {
      updateData.description = data.description.trim();
    }

    await db.collection('service_items').updateOne(
      { _id: new ObjectId(serviceId) },
      { $set: updateData }
    );

    const updated = await db.collection('service_items').findOne({
      _id: new ObjectId(serviceId),
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Service updated successfully',
        service: updated,
      }),
    };
  } catch (error) {
    console.error('Update service error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to update service' }),
    };
  }
}
