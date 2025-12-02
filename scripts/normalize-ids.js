/**
 * Normalize all IDs to legacy format using bulk operations
 * - Patients: numeric only (1001, 1002, ...)
 * - Appointments: OPDN + number (OPDN1, OPDN2, ...)
 * - OPD Bills: OPDN + number (same as appointment)
 */

import { MongoClient, ServerApiVersion } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'clinic_db';

// Extract numeric part from various ID formats
function extractNumber(id) {
  if (!id) return 0;
  const str = String(id);
  const match = str.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

async function normalizeIds() {
  console.log('=== Normalizing IDs to Legacy Format ===\n');

  const client = new MongoClient(MONGODB_URI, {
    serverApi: { version: ServerApiVersion.v1 },
  });

  try {
    await client.connect();
    const db = client.db(DB_NAME);

    // ========== NORMALIZE PATIENTS ==========
    console.log('📋 Normalizing Patient IDs...');
    
    // Find patients not in correct format
    const badPatients = await db.collection('patients')
      .find({ patientId: { $not: /^\d{4,}$/ } })
      .project({ _id: 1, patientId: 1 })
      .toArray();
    
    console.log(`   Found ${badPatients.length} patients to update`);
    
    if (badPatients.length > 0) {
      const bulkOps = badPatients.map(p => {
        const num = extractNumber(p.patientId);
        const newId = num >= 1001 ? String(num) : String(num || 1001);
        return {
          updateOne: {
            filter: { _id: p._id },
            update: { $set: { patientId: newId } }
          }
        };
      });
      
      const result = await db.collection('patients').bulkWrite(bulkOps);
      console.log(`   ✅ Updated: ${result.modifiedCount} patients`);
    }

    // ========== NORMALIZE APPOINTMENTS ==========
    console.log('\n📅 Normalizing Appointment IDs...');
    
    const badApts = await db.collection('appointments')
      .find({ appointmentId: { $not: /^OPDN\d+$/ } })
      .project({ _id: 1, appointmentId: 1 })
      .toArray();
    
    console.log(`   Found ${badApts.length} appointments to update`);
    
    if (badApts.length > 0) {
      const bulkOps = badApts.map(a => {
        const num = extractNumber(a.appointmentId);
        const newId = `OPDN${num || 1}`;
        return {
          updateOne: {
            filter: { _id: a._id },
            update: { $set: { appointmentId: newId } }
          }
        };
      });
      
      const result = await db.collection('appointments').bulkWrite(bulkOps);
      console.log(`   ✅ Updated: ${result.modifiedCount} appointments`);
    }

    // ========== NORMALIZE OPD BILLS ==========
    console.log('\n💰 Normalizing OPD Bill Numbers...');
    
    const badBills = await db.collection('opd_bills')
      .find({ billNo: { $not: /^OPDN\d+$/ } })
      .project({ _id: 1, billNo: 1 })
      .toArray();
    
    console.log(`   Found ${badBills.length} OPD bills to update`);
    
    if (badBills.length > 0) {
      const bulkOps = badBills.map(b => {
        const num = extractNumber(b.billNo);
        const newId = `OPDN${num || 1}`;
        return {
          updateOne: {
            filter: { _id: b._id },
            update: { $set: { billNo: newId } }
          }
        };
      });
      
      const result = await db.collection('opd_bills').bulkWrite(bulkOps);
      console.log(`   ✅ Updated: ${result.modifiedCount} OPD bills`);
    }

    // ========== VERIFY ==========
    console.log('\n=== Sample Results ===');
    
    const samplePatients = await db.collection('patients')
      .find({}).limit(3).project({ patientId: 1, name: 1 }).toArray();
    console.log('Patients:', samplePatients.map(p => `${p.patientId}`).join(', '));
    
    const sampleApts = await db.collection('appointments')
      .find({}).limit(3).project({ appointmentId: 1 }).toArray();
    console.log('Appointments:', sampleApts.map(a => a.appointmentId).join(', '));
    
    const sampleBills = await db.collection('opd_bills')
      .find({}).limit(3).project({ billNo: 1 }).toArray();
    console.log('OPD Bills:', sampleBills.map(b => b.billNo).join(', '));

    console.log('\n✅ Done!');

  } catch (error) {
    console.error('Failed:', error);
  } finally {
    await client.close();
  }
}

normalizeIds();
