/**
 * Fix legacy appointment doctor links
 * 
 * Legacy doctor IDs:
 *   4 = Dr. Vaibhav Awasthi
 *   9 = Dr. Ankita Sharma
 */
import { MongoClient, ServerApiVersion } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'clinic_db';

// Legacy doctor mapping
const LEGACY_DOCTORS = {
  4: { name: 'Dr. Vaibhav Awasthi', specialization: 'General Physician' },
  9: { name: 'Dr. Ankita Sharma', specialization: 'General Physician' },
};

async function fixDoctors() {
  console.log('=== Fixing Legacy Doctor Links ===\n');

  const client = new MongoClient(MONGODB_URI, {
    serverApi: { version: ServerApiVersion.v1 },
  });

  try {
    await client.connect();
    const db = client.db(DB_NAME);

    // Check existing doctors
    const existingDoctors = await db.collection('doctors').find({}).toArray();
    console.log(`Existing doctors in system: ${existingDoctors.length}`);
    existingDoctors.forEach(d => console.log(`  - ${d.name} (${d._id})`));

    // Create a map of doctor name -> _id
    const doctorMap = new Map();
    for (const doc of existingDoctors) {
      doctorMap.set(doc.name.toLowerCase(), doc._id);
    }

    // Check if we need to create the legacy doctors
    const doctorsToCreate = [];
    for (const [legacyId, info] of Object.entries(LEGACY_DOCTORS)) {
      const existing = existingDoctors.find(d => 
        d.name.toLowerCase().includes(info.name.toLowerCase().replace('dr. ', ''))
      );
      if (!existing) {
        doctorsToCreate.push({ legacyId: parseInt(legacyId), ...info });
      } else {
        doctorMap.set(parseInt(legacyId), existing._id);
        console.log(`  Found existing doctor for legacy ID ${legacyId}: ${existing.name}`);
      }
    }

    // Create missing doctors
    if (doctorsToCreate.length > 0) {
      console.log(`\nCreating ${doctorsToCreate.length} missing doctors...`);
      for (const doc of doctorsToCreate) {
        const result = await db.collection('doctors').insertOne({
          doctorId: `DOC${String(doc.legacyId).padStart(4, '0')}`,
          name: doc.name,
          specialization: doc.specialization,
          phone: '',
          email: '',
          isActive: true,
          legacyId: doc.legacyId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        doctorMap.set(doc.legacyId, result.insertedId);
        console.log(`  Created: ${doc.name} (legacy ID: ${doc.legacyId})`);
      }
    }

    // Now link appointments to doctors
    console.log('\nLinking legacy appointments to doctors...');
    
    const legacyAppointments = await db.collection('appointments')
      .find({ 
        legacyDoctorId: { $exists: true },
        $or: [
          { doctorId: null },
          { doctorId: { $exists: false } }
        ]
      })
      .project({ _id: 1, legacyDoctorId: 1 })
      .toArray();
    
    console.log(`  Found ${legacyAppointments.length} appointments to link`);

    if (legacyAppointments.length > 0) {
      const bulkOps = [];
      let linked = 0;
      let notFound = 0;

      for (const apt of legacyAppointments) {
        const doctorOid = doctorMap.get(apt.legacyDoctorId);
        if (doctorOid) {
          bulkOps.push({
            updateOne: {
              filter: { _id: apt._id },
              update: { $set: { doctorId: doctorOid } }
            }
          });
          linked++;
        } else {
          notFound++;
        }
      }

      if (bulkOps.length > 0) {
        const result = await db.collection('appointments').bulkWrite(bulkOps);
        console.log(`  ✅ Linked ${result.modifiedCount} appointments to doctors`);
      }
      
      if (notFound > 0) {
        console.log(`  ⚠️  ${notFound} appointments have unknown doctor IDs`);
      }
    }

    // Also link OPD bills to doctors
    console.log('\nLinking legacy OPD bills to doctors...');
    
    const legacyBills = await db.collection('opd_bills')
      .find({ 
        legacyDoctorId: { $exists: true },
        $or: [
          { doctorId: null },
          { doctorId: { $exists: false } }
        ]
      })
      .project({ _id: 1, legacyDoctorId: 1 })
      .toArray();
    
    console.log(`  Found ${legacyBills.length} OPD bills to link`);

    if (legacyBills.length > 0) {
      const bulkOps = legacyBills
        .filter(b => doctorMap.has(b.legacyDoctorId))
        .map(b => ({
          updateOne: {
            filter: { _id: b._id },
            update: { $set: { doctorId: doctorMap.get(b.legacyDoctorId) } }
          }
        }));

      if (bulkOps.length > 0) {
        const result = await db.collection('opd_bills').bulkWrite(bulkOps);
        console.log(`  ✅ Linked ${result.modifiedCount} OPD bills to doctors`);
      }
    }

    // Summary
    console.log('\n=== Summary ===');
    const linkedApts = await db.collection('appointments').countDocuments({ 
      legacyId: { $exists: true },
      doctorId: { $ne: null }
    });
    const unlinkedApts = await db.collection('appointments').countDocuments({ 
      legacyId: { $exists: true },
      $or: [{ doctorId: null }, { doctorId: { $exists: false } }]
    });
    console.log(`Legacy appointments with doctor: ${linkedApts}`);
    console.log(`Legacy appointments without doctor: ${unlinkedApts}`);

    console.log('\n✅ Done!');

  } catch (error) {
    console.error('Failed:', error);
  } finally {
    await client.close();
  }
}

fixDoctors();
