/**
 * Check appointments with missing patients
 */
import { MongoClient, ServerApiVersion } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'clinic_db';

async function check() {
  const client = new MongoClient(MONGODB_URI, {
    serverApi: { version: ServerApiVersion.v1 },
  });

  try {
    await client.connect();
    const db = client.db(DB_NAME);

    // Count appointments without patient link
    const orphanApts = await db.collection('appointments')
      .find({ 
        $or: [
          { patientId: null },
          { patientId: { $exists: false } }
        ]
      })
      .toArray();
    
    console.log(`Appointments without patient link: ${orphanApts.length}`);
    
    // Check if these have legacyPatientId
    const withLegacyPatient = orphanApts.filter(a => a.legacyPatientId);
    console.log(`  - With legacyPatientId: ${withLegacyPatient.length}`);
    
    // Get unique legacy patient IDs
    const legacyPatientIds = [...new Set(withLegacyPatient.map(a => a.legacyPatientId))];
    console.log(`  - Unique legacy patient IDs: ${legacyPatientIds.length}`);
    
    // Sample some
    console.log('\nSample orphan appointments:');
    orphanApts.slice(0, 5).forEach(a => {
      console.log(`  - ${a.appointmentId}: legacyPatientId=${a.legacyPatientId}, date=${a.appointmentDate}`);
    });

    // These patients were deleted because they had no phone
    // We can either:
    // 1. Delete these appointments too
    // 2. Keep them but show "Unknown Patient" in the UI
    
    console.log('\nOptions:');
    console.log('1. Delete these orphan appointments (they belong to patients without phone)');
    console.log('2. Keep them with "Unknown Patient" display');

  } catch (error) {
    console.error('Failed:', error);
  } finally {
    await client.close();
  }
}

check();
