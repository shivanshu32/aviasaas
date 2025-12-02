/**
 * Delete orphan appointments (no patient link)
 */
import { MongoClient, ServerApiVersion } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'clinic_db';

async function deleteOrphans() {
  const client = new MongoClient(MONGODB_URI, {
    serverApi: { version: ServerApiVersion.v1 },
  });

  try {
    await client.connect();
    const db = client.db(DB_NAME);

    // Delete appointments without patient
    const result = await db.collection('appointments').deleteMany({
      $or: [
        { patientId: null },
        { patientId: { $exists: false } }
      ]
    });

    console.log(`✅ Deleted ${result.deletedCount} orphan appointments`);

    // Also delete related OPD bills for these appointments
    const orphanBills = await db.collection('opd_bills').deleteMany({
      $or: [
        { patientId: null },
        { patientId: { $exists: false } }
      ]
    });
    console.log(`✅ Deleted ${orphanBills.deletedCount} orphan OPD bills`);

    // Show remaining counts
    const remainingApts = await db.collection('appointments').countDocuments();
    const remainingBills = await db.collection('opd_bills').countDocuments();
    
    console.log(`\nRemaining appointments: ${remainingApts}`);
    console.log(`Remaining OPD bills: ${remainingBills}`);

  } catch (error) {
    console.error('Failed:', error);
  } finally {
    await client.close();
  }
}

deleteOrphans();
