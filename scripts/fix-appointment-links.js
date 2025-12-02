/**
 * Fix legacy appointment links to patients
 * Links legacyPatientId to actual patient ObjectIds
 */
import { MongoClient, ServerApiVersion } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'clinic_db';

async function fixLinks() {
  console.log('=== Fixing Legacy Appointment Links ===\n');

  const client = new MongoClient(MONGODB_URI, {
    serverApi: { version: ServerApiVersion.v1 },
  });

  try {
    await client.connect();
    const db = client.db(DB_NAME);

    // Build patient map: legacyId -> _id
    console.log('Building patient map...');
    const patients = await db.collection('patients')
      .find({ legacyId: { $exists: true } })
      .project({ _id: 1, legacyId: 1 })
      .toArray();
    
    const patientMap = new Map();
    patients.forEach(p => patientMap.set(p.legacyId, p._id));
    console.log(`  Found ${patientMap.size} patients with legacy IDs`);

    // Find legacy appointments without proper patientId
    const legacyApts = await db.collection('appointments')
      .find({ 
        legacyPatientId: { $exists: true },
        $or: [
          { patientId: null },
          { patientId: { $exists: false } }
        ]
      })
      .project({ _id: 1, legacyPatientId: 1 })
      .toArray();
    
    console.log(`  Found ${legacyApts.length} appointments to link`);

    if (legacyApts.length > 0) {
      const bulkOps = [];
      let linked = 0;
      let notFound = 0;

      for (const apt of legacyApts) {
        const patientOid = patientMap.get(apt.legacyPatientId);
        if (patientOid) {
          bulkOps.push({
            updateOne: {
              filter: { _id: apt._id },
              update: { $set: { patientId: patientOid } }
            }
          });
          linked++;
        } else {
          notFound++;
        }
      }

      if (bulkOps.length > 0) {
        const result = await db.collection('appointments').bulkWrite(bulkOps);
        console.log(`\n✅ Linked ${result.modifiedCount} appointments to patients`);
      }
      
      if (notFound > 0) {
        console.log(`⚠️  ${notFound} appointments have patients that were deleted (no phone)`);
      }
    }

    // Verify
    const stillUnlinked = await db.collection('appointments').countDocuments({
      legacyId: { $exists: true },
      patientId: null
    });
    console.log(`\nRemaining unlinked legacy appointments: ${stillUnlinked}`);

    console.log('\n✅ Done!');

  } catch (error) {
    console.error('Failed:', error);
  } finally {
    await client.close();
  }
}

fixLinks();
