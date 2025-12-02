/**
 * Merge Dr. Ankita Sharma (General Physician) into Dr. Ankita Awasthi (Ophthalmologist)
 * and delete the duplicate
 */
import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'clinic_db';

async function mergeDoctors() {
  const client = new MongoClient(MONGODB_URI, {
    serverApi: { version: ServerApiVersion.v1 },
  });

  try {
    await client.connect();
    const db = client.db(DB_NAME);

    // Find both doctors
    const doctors = await db.collection('doctors').find({}).toArray();
    console.log('Current doctors:');
    doctors.forEach(d => console.log(`  - ${d.name} (${d.specialization || 'N/A'}) - ID: ${d._id}`));

    // Find the doctor to delete (General Physician)
    const doctorToDelete = doctors.find(d => 
      d.specialization === 'General Physician' && d.name.includes('Ankita')
    );

    // Find the doctor to keep (Ophthalmologist)
    const doctorToKeep = doctors.find(d => 
      d.specialization === 'Ophthalmologist' && d.name.includes('Ankita')
    );

    if (!doctorToDelete) {
      console.log('\nDoctor to delete not found');
      return;
    }

    if (!doctorToKeep) {
      console.log('\nDoctor to keep not found');
      return;
    }

    console.log(`\nWill merge:`);
    console.log(`  FROM: ${doctorToDelete.name} (${doctorToDelete._id})`);
    console.log(`  TO:   ${doctorToKeep.name} (${doctorToKeep._id})`);

    // Update all appointments from old doctor to new doctor
    const aptResult = await db.collection('appointments').updateMany(
      { doctorId: doctorToDelete._id },
      { $set: { doctorId: doctorToKeep._id } }
    );
    console.log(`\n✅ Updated ${aptResult.modifiedCount} appointments`);

    // Update all OPD bills from old doctor to new doctor
    const billResult = await db.collection('opd_bills').updateMany(
      { doctorId: doctorToDelete._id },
      { $set: { doctorId: doctorToKeep._id } }
    );
    console.log(`✅ Updated ${billResult.modifiedCount} OPD bills`);

    // Update all prescriptions from old doctor to new doctor
    const rxResult = await db.collection('prescriptions').updateMany(
      { doctorId: doctorToDelete._id },
      { $set: { doctorId: doctorToKeep._id } }
    );
    console.log(`✅ Updated ${rxResult.modifiedCount} prescriptions`);

    // Delete the old doctor
    await db.collection('doctors').deleteOne({ _id: doctorToDelete._id });
    console.log(`\n✅ Deleted ${doctorToDelete.name}`);

    // Show remaining doctors
    const remainingDoctors = await db.collection('doctors').find({}).toArray();
    console.log('\nRemaining doctors:');
    remainingDoctors.forEach(d => console.log(`  - ${d.name} (${d.specialization || 'N/A'})`));

  } catch (error) {
    console.error('Failed:', error);
  } finally {
    await client.close();
  }
}

mergeDoctors();
