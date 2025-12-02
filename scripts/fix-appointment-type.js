/**
 * Fix appointment type - change 'new' to 'consultation'
 */
import { MongoClient, ServerApiVersion } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'clinic_db';

async function fix() {
  const client = new MongoClient(MONGODB_URI, {
    serverApi: { version: ServerApiVersion.v1 },
  });

  try {
    await client.connect();
    const db = client.db(DB_NAME);

    const result = await db.collection('appointments').updateMany(
      { type: 'new' },
      { $set: { type: 'consultation' } }
    );

    console.log(`✅ Updated ${result.modifiedCount} appointments from 'new' to 'consultation'`);

  } catch (error) {
    console.error('Failed:', error);
  } finally {
    await client.close();
  }
}

fix();
