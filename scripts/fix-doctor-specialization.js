/**
 * Fix Dr. Ankita Sharma - change specialization to Ophthalmologist
 * and update all appointments that referenced the deleted doctor
 */
import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'clinic_db';

// The deleted doctor's ID
const DELETED_DOCTOR_ID = new ObjectId('692ee7395bcffd02dd277ca9');

async function fixDoctor() {
  const client = new MongoClient(MONGODB_URI, {
    serverApi: { version: ServerApiVersion.v1 },
  });

  try {
    await client.connect();
    const db = client.db(DB_NAME);

    // Find Dr. Ankita Sharma (General Physician)
    const ankita = await db.collection('doctors').findOne({ 
      name: { $regex: /Ankita/i } 
    });

    if (!ankita) {
      console.log('Dr. Ankita not found');
      return;
    }

    console.log(`Found: ${ankita.name} (${ankita.specialization})`);
    console.log(`ID: ${ankita._id}`);

    // Update specialization to Ophthalmologist
    await db.collection('doctors').updateOne(
      { _id: ankita._id },
      { $set: { specialization: 'Ophthalmologist' } }
    );
    console.log('\n✅ Updated specialization to Ophthalmologist');

    // Update all appointments that reference the deleted doctor
    const aptResult = await db.collection('appointments').updateMany(
      { doctorId: DELETED_DOCTOR_ID },
      { $set: { doctorId: ankita._id } }
    );
    console.log(`✅ Updated ${aptResult.modifiedCount} appointments from deleted doctor`);

    // Update all OPD bills
    const billResult = await db.collection('opd_bills').updateMany(
      { doctorId: DELETED_DOCTOR_ID },
      { $set: { doctorId: ankita._id } }
    );
    console.log(`✅ Updated ${billResult.modifiedCount} OPD bills`);

    // Show final state
    const doctors = await db.collection('doctors').find({}).toArray();
    console.log('\nFinal doctors:');
    doctors.forEach(d => console.log(`  - ${d.name} (${d.specialization})`));

  } catch (error) {
    console.error('Failed:', error);
  } finally {
    await client.close();
  }
}

fixDoctor();
