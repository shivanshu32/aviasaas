/**
 * Create OPD bills for legacy appointments that don't have them
 */
import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'clinic_db';

// Parse legacy OPD data from SQL to get billing info
function extractOpdBillingData(sqlContent) {
  const billingData = new Map(); // legacyId -> { amount, paymentMode }
  const lines = sqlContent.split('\n');
  
  let inInsert = false;
  
  for (const line of lines) {
    if (line.includes("INSERT INTO `opd_details`")) {
      inInsert = true;
      continue;
    }
    
    if (inInsert && (line.startsWith('--') || line.startsWith('CREATE') || line.startsWith('ALTER'))) {
      inInsert = false;
      continue;
    }
    
    if (inInsert && line.trim().startsWith('(')) {
      // Parse: (id, patient_id, opd_no, appointment_date, ..., cons_doctor, amount, tax, payment_mode, ...)
      // Columns: id(0), patient_id(1), opd_no(2), appointment_date(3), case_type(4), casualty(5), 
      //          symptoms(6), bp(7), height(8), weight(9), pulse(10), temperature(11), respiration(12),
      //          known_allergies(13), note_remark(14), refference(15), cons_doctor(16), 
      //          amount(17), tax(18), payment_mode(19), ...
      
      const match = line.match(/^\((\d+),\s*\d+,\s*'[^']*',\s*'[^']*',\s*'[^']*',\s*'[^']*',\s*'[^']*',\s*'[^']*',\s*'[^']*',\s*'[^']*',\s*'[^']*',\s*'[^']*',\s*'[^']*',\s*'[^']*',\s*(?:'[^']*'|NULL),\s*'[^']*',\s*\d+,\s*([\d.]+),\s*([\d.]+),\s*'([^']*)'/);
      
      if (match) {
        const legacyId = parseInt(match[1], 10);
        const amount = parseFloat(match[2]) || 0;
        const tax = parseFloat(match[3]) || 0;
        const paymentMode = match[4] || 'Cash';
        
        billingData.set(legacyId, {
          amount,
          tax,
          paymentMode: paymentMode.toLowerCase().includes('cash') ? 'cash' : 
                       paymentMode.toLowerCase().includes('card') ? 'card' : 
                       paymentMode.toLowerCase().includes('upi') ? 'upi' : 'cash',
          grandTotal: amount + tax,
        });
      }
    }
  }
  
  return billingData;
}

async function createBills() {
  console.log('=== Creating OPD Bills for Legacy Appointments ===\n');

  const client = new MongoClient(MONGODB_URI, {
    serverApi: { version: ServerApiVersion.v1 },
  });

  try {
    await client.connect();
    const db = client.db(DB_NAME);

    // Read SQL file to get billing amounts
    const sqlPath = path.join(__dirname, '..', 'public', 'aviawellnessadmi_hospitaldb (1).sql');
    console.log('Reading SQL file for billing data...');
    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
    const billingData = extractOpdBillingData(sqlContent);
    console.log(`  Found billing data for ${billingData.size} OPD records`);

    // Get legacy appointments without OPD bills
    const legacyAppointments = await db.collection('appointments')
      .find({ legacyId: { $exists: true } })
      .toArray();
    
    console.log(`\nLegacy appointments: ${legacyAppointments.length}`);

    // Check which ones already have bills
    const existingBills = await db.collection('opd_bills')
      .find({ legacyOpdId: { $exists: true } })
      .project({ legacyOpdId: 1 })
      .toArray();
    
    const existingBillIds = new Set(existingBills.map(b => b.legacyOpdId));
    console.log(`Existing OPD bills with legacy ID: ${existingBillIds.size}`);

    // Find appointments that need bills
    const appointmentsNeedingBills = legacyAppointments.filter(apt => 
      !existingBillIds.has(apt.legacyId) && billingData.has(apt.legacyId)
    );
    
    console.log(`Appointments needing bills: ${appointmentsNeedingBills.length}`);

    if (appointmentsNeedingBills.length === 0) {
      console.log('\n✅ All legacy appointments already have OPD bills');
      return;
    }

    // Create bills in batches
    const bills = [];
    let billNo = await getNextBillNo(db);
    
    for (const apt of appointmentsNeedingBills) {
      const billing = billingData.get(apt.legacyId);
      if (!billing) continue;

      const bill = {
        _id: new ObjectId(),
        billNo: `OPDN${billNo++}`,
        patientId: apt.patientId,
        doctorId: apt.doctorId,
        appointmentId: apt._id,
        billDate: apt.appointmentDate || apt.createdAt,
        items: [{
          description: 'Consultation Fee',
          quantity: 1,
          rate: billing.amount,
          amount: billing.amount,
        }],
        subtotal: billing.amount,
        tax: billing.tax,
        taxAmount: billing.tax,
        discount: 0,
        discountAmount: 0,
        grandTotal: billing.grandTotal,
        amountPaid: billing.grandTotal,
        paymentMode: billing.paymentMode,
        paymentStatus: 'paid',
        legacyOpdId: apt.legacyId,
        createdAt: apt.appointmentDate || apt.createdAt,
        updatedAt: apt.appointmentDate || apt.createdAt,
      };
      
      bills.push(bill);
    }

    if (bills.length > 0) {
      // Insert in batches of 1000
      const batchSize = 1000;
      let inserted = 0;
      
      for (let i = 0; i < bills.length; i += batchSize) {
        const batch = bills.slice(i, i + batchSize);
        const result = await db.collection('opd_bills').insertMany(batch);
        inserted += result.insertedCount;
        console.log(`  Inserted batch: ${result.insertedCount} bills`);
      }
      
      console.log(`\n✅ Created ${inserted} OPD bills for legacy appointments`);
    }

    // Final count
    const totalBills = await db.collection('opd_bills').countDocuments();
    console.log(`\nTotal OPD bills in database: ${totalBills}`);

  } catch (error) {
    console.error('Failed:', error);
  } finally {
    await client.close();
  }
}

async function getNextBillNo(db) {
  const lastBill = await db.collection('opd_bills')
    .find({})
    .sort({ billNo: -1 })
    .limit(1)
    .toArray();
  
  if (lastBill.length === 0) return 1;
  
  const match = lastBill[0].billNo.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) + 1 : 1;
}

createBills();
