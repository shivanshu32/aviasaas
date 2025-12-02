import { getDb } from './utils/db.js';

export async function handler(event) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const db = await getDb();
    const data = JSON.parse(event.body);

    // Validate required fields
    if (!data.name || !data.name.trim()) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Service name is required' }),
      };
    }

    if (!data.category) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Category is required' }),
      };
    }

    const validCategories = ['laboratory', 'radiology', 'procedure', 'other'];
    if (!validCategories.includes(data.category)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid category' }),
      };
    }

    if (!data.rate || data.rate <= 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Valid rate is required' }),
      };
    }

    // Check for duplicate name in same category
    const existing = await db.collection('service_items').findOne({
      name: { $regex: `^${data.name.trim()}$`, $options: 'i' },
      category: data.category,
      isActive: true,
    });

    if (existing) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Service with this name already exists in this category' }),
      };
    }

    // Create service item
    const serviceItem = {
      name: data.name.trim(),
      category: data.category,
      rate: Number(data.rate),
      description: data.description?.trim() || '',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('service_items').insertOne(serviceItem);

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Service added successfully',
        service: { ...serviceItem, _id: result.insertedId },
      }),
    };
  } catch (error) {
    console.error('Add service error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to add service' }),
    };
  }
}
