/**
 * Migration Script: Legacy Hospital Database to Avia Clinic Management System
 * 
 * This script migrates data from the old MySQL-based hospital system to MongoDB.
 * 
 * Data to migrate:
 * 1. Patients - from `patients` table
 * 2. OPD Details (Appointments + Bills) - from `opd_details` table
 * 3. Service Charges - from `charges` table
 * 
 * Usage:
 *   Option 1: Set MONGODB_URI environment variable
 *     set MONGODB_URI=mongodb+srv://... && npm run migrate
 *   
 *   Option 2: Run with netlify dev (uses Netlify env vars)
 *     netlify dev:exec npm run migrate
 */

import { MongoClient, ServerApiVersion } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'clinic_db';

if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI environment variable is required');
  console.error('\nTo run this migration, use one of these methods:');
  console.error('  1. Set environment variable directly:');
  console.error('     Windows: set MONGODB_URI=your_connection_string && npm run migrate');
  console.error('     Linux/Mac: MONGODB_URI=your_connection_string npm run migrate');
  console.error('\n  2. Use Netlify CLI (if env vars are set in Netlify):');
  console.error('     netlify dev:exec npm run migrate');
  process.exit(1);
}

// Read and parse SQL file
function parseSQLFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return content;
}

// Extract data rows using line-by-line parsing (much faster)
function extractTableData(sqlContent, tableName, columns) {
  console.log(`   Searching for ${tableName} data...`);
  const rows = [];
  const lines = sqlContent.split('\n');
  
  let inInsert = false;
  let insertCount = 0;
  let rowsAttempted = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this line starts an INSERT for our table
    if (line.includes(`INSERT INTO \`${tableName}\``)) {
      inInsert = true;
      insertCount++;
      continue;
    }
    
    // Check if we've moved past the INSERT block
    if (inInsert && (line.startsWith('--') || line.startsWith('CREATE') || line.startsWith('ALTER'))) {
      inInsert = false;
      continue;
    }
    
    if (inInsert) {
      // Each data row starts with ( and ends with ), or );
      const trimmed = line.trim();
      if (trimmed.startsWith('(')) {
        rowsAttempted++;
        // Extract content between ( and )
        let rowContent = trimmed;
        
        // Remove leading ( and trailing ), or );
        if (rowContent.endsWith(');')) {
          rowContent = rowContent.slice(1, -2);
        } else if (rowContent.endsWith('),')) {
          rowContent = rowContent.slice(1, -2);
        } else if (rowContent.endsWith(')')) {
          rowContent = rowContent.slice(1, -1);
        } else {
          rowContent = rowContent.slice(1);
        }
        
        const values = parseRowValues(rowContent);
        
        if (values.length === columns.length) {
          const obj = {};
          columns.forEach((col, idx) => {
            obj[col] = values[idx];
          });
          rows.push(obj);
        } else if (rowsAttempted <= 3) {
          console.log(`   DEBUG: Row ${rowsAttempted} has ${values.length} values, expected ${columns.length}`);
        }
      }
    }
  }
  
  console.log(`   Found ${insertCount} INSERT statements, ${rowsAttempted} rows attempted`);
  return rows;
}

// Parse a single row's values
function parseRowValues(rowStr) {
  const values = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  
  for (let i = 0; i < rowStr.length; i++) {
    const char = rowStr[i];
    
    if (!inString && (char === "'" || char === '"')) {
      inString = true;
      stringChar = char;
    } else if (inString && char === stringChar) {
      if (rowStr[i+1] === stringChar) {
        // Escaped quote ('')
        current += char;
        i++;
      } else {
        inString = false;
      }
    } else if (!inString && char === ',') {
      values.push(parseValue(current.trim()));
      current = '';
    } else {
      current += char;
    }
  }
  
  // Always push the last value (even if empty)
  values.push(parseValue(current.trim()));
  
  return values;
}

// Parse individual value
function parseValue(val) {
  if (val === 'NULL' || val === 'null') return null;
  if (val === '') return '';
  // Don't convert long numeric strings (like phone numbers) to integers
  // as they may lose precision. Only convert short numbers.
  if (val.match(/^-?\d+$/) && val.length <= 9) return parseInt(val, 10);
  if (val.match(/^-?\d+\.\d+$/)) return parseFloat(val);
  return val;
}

// Transform legacy patient to new format
function transformPatient(legacy, index) {
  const age = parseInt(legacy.age) || null;
  
  return {
    patientId: `PAT${String(legacy.patient_unique_id || (1000 + index)).padStart(4, '0')}`,
    name: cleanName(legacy.patient_name),
    phone: cleanPhone(legacy.mobileno),
    email: legacy.email || null,
    age: age,
    gender: normalizeGender(legacy.gender),
    dateOfBirth: parseDate(legacy.dob),
    bloodGroup: legacy.blood_group || null,
    address: {
      line1: legacy.address || '',
      city: '',
      state: '',
      pincode: '',
    },
    emergencyContact: {
      name: legacy.guardian_name || null,
      phone: legacy.guardian_phone || null,
      relation: 'Guardian',
    },
    medicalHistory: {
      allergies: legacy.known_allergies ? [legacy.known_allergies] : [],
      conditions: [],
      notes: legacy.note || '',
    },
    isActive: legacy.is_active === 'yes',
    legacyId: legacy.id,
    createdAt: parseDateTime(legacy.created_at) || new Date(),
    updatedAt: new Date(),
  };
}

// Transform legacy OPD to appointment + bill
function transformOPD(legacy, patientMap) {
  const patientId = patientMap.get(legacy.patient_id);
  
  const appointment = {
    appointmentId: legacy.opd_no,
    patientId: patientId || null,
    legacyPatientId: legacy.patient_id,
    appointmentDate: parseDateTime(legacy.appointment_date),
    timeSlot: {
      start: formatTime(legacy.appointment_date),
      end: null,
    },
    type: 'consultation',
    status: 'completed',
    symptoms: legacy.symptoms || null,
    vitals: {
      bp: legacy.bp || null,
      pulse: legacy.pulse || null,
      temperature: legacy.temperature || null,
      weight: legacy.weight || null,
      height: legacy.height || null,
      respiration: legacy.respiration || null,
    },
    notes: legacy.note_remark || null,
    legacyId: legacy.id,
    legacyDoctorId: legacy.cons_doctor,
    createdAt: parseDateTime(legacy.appointment_date) || new Date(),
  };

  // Create bill if amount > 0
  let bill = null;
  if (legacy.amount && parseFloat(legacy.amount) > 0) {
    bill = {
      billNo: `BILL-${legacy.opd_no}`,
      patientId: patientId || null,
      legacyPatientId: legacy.patient_id,
      appointmentId: null, // Will be linked after appointment is created
      legacyOpdId: legacy.id,
      billDate: parseDateTime(legacy.appointment_date),
      items: [{
        description: 'Consultation Fee',
        quantity: 1,
        rate: parseFloat(legacy.amount),
        amount: parseFloat(legacy.amount),
      }],
      subtotal: parseFloat(legacy.amount),
      discountType: 'fixed',
      discountValue: 0,
      discountAmount: 0,
      taxAmount: parseFloat(legacy.tax) || 0,
      grandTotal: parseFloat(legacy.amount) + (parseFloat(legacy.tax) || 0),
      paidAmount: parseFloat(legacy.amount) + (parseFloat(legacy.tax) || 0),
      dueAmount: 0,
      paymentMode: normalizePaymentMode(legacy.payment_mode),
      paymentStatus: 'paid',
      createdAt: parseDateTime(legacy.appointment_date) || new Date(),
    };
  }

  return { appointment, bill };
}

// Transform legacy charge to service item
function transformCharge(legacy) {
  const chargeType = (legacy.charge_type || '').toLowerCase();
  let category = 'other';
  
  if (chargeType.includes('pathology') || chargeType.includes('lab')) {
    category = 'laboratory';
  } else if (chargeType.includes('radiology') || chargeType.includes('x-ray') || chargeType.includes('xray')) {
    category = 'radiology';
  } else if (chargeType.includes('procedure')) {
    category = 'procedure';
  }

  return {
    name: cleanChargeName(legacy.charge_category),
    category: category,
    rate: parseFloat(legacy.standard_charge) || 0,
    description: legacy.description || '',
    code: legacy.code || '',
    isActive: true,
    legacyId: legacy.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Helper functions
function cleanName(name) {
  if (!name) return 'Unknown';
  const nameStr = String(name);
  return nameStr.replace(/^(Mr\.|Mrs\.|Ms\.|Dr\.|Baby|Master)\s*/i, '').trim() || nameStr;
}

function cleanPhone(phone) {
  if (!phone) return null;
  const phoneStr = String(phone);
  const cleaned = phoneStr.replace(/\D/g, '');
  return cleaned.length >= 10 ? cleaned.slice(-10) : null;
}

function normalizeGender(gender) {
  if (!gender) return null;
  const g = String(gender).toLowerCase();
  if (g.startsWith('m')) return 'Male';
  if (g.startsWith('f')) return 'Female';
  return 'Other';
}

function parseDate(dateStr) {
  if (!dateStr || dateStr === '0000-00-00') return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

function parseDateTime(dateTimeStr) {
  if (!dateTimeStr || dateTimeStr.includes('0000-00-00')) return null;
  const date = new Date(dateTimeStr);
  return isNaN(date.getTime()) ? null : date;
}

function formatTime(dateTimeStr) {
  if (!dateTimeStr) return '10:00';
  const date = new Date(dateTimeStr);
  if (isNaN(date.getTime())) return '10:00';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function normalizePaymentMode(mode) {
  if (!mode) return 'cash';
  const m = mode.toLowerCase();
  if (m.includes('cash')) return 'cash';
  if (m.includes('card')) return 'card';
  if (m.includes('upi')) return 'upi';
  return 'cash';
}

function cleanChargeName(name) {
  if (!name) return 'Unknown Service';
  return name.trim();
}

// Main migration function
async function migrate() {
  console.log('='.repeat(60));
  console.log('Legacy Data Migration Script');
  console.log('='.repeat(60));

  // Read SQL file
  const sqlPath = path.join(__dirname, '..', 'public', 'aviawellnessadmi_hospitaldb (1).sql');
  
  if (!fs.existsSync(sqlPath)) {
    console.error(`SQL file not found: ${sqlPath}`);
    process.exit(1);
  }

  console.log('\n📂 Reading SQL file...');
  const sqlContent = parseSQLFile(sqlPath);
  console.log(`   File size: ${(sqlContent.length / 1024 / 1024).toFixed(2)} MB`);

  // Connect to MongoDB
  console.log('\n🔌 Connecting to MongoDB...');
  const client = new MongoClient(MONGODB_URI, {
    serverApi: { version: ServerApiVersion.v1 },
  });

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    console.log('   Connected successfully!');

    // ========== MIGRATE PATIENTS ==========
    console.log('\n👥 Migrating Patients...');
    
    const patientColumns = [
      'id', 'patient_unique_id', 'lang_id', 'admission_date', 'patient_name', 
      'age', 'month', 'image', 'mobileno', 'email', 'dob', 'gender', 
      'marital_status', 'blood_group', 'address', 'guardian_name', 
      'guardian_phone', 'guardian_address', 'guardian_email', 'is_active', 
      'discharged', 'patient_type', 'credit_limit', 'organisation', 
      'known_allergies', 'old_patient', 'created_at', 'disable_at', 
      'note', 'is_ipd', 'app_key'
    ];

    const allPatients = extractTableData(sqlContent, 'patients', patientColumns);
    console.log(`   Found ${allPatients.length} patients in SQL`);

    // Transform and insert patients
    const patientMap = new Map(); // legacy id -> new ObjectId
    const transformedPatients = allPatients
      .filter(p => p.patient_name && p.patient_name !== '-')
      .map((p, i) => transformPatient(p, i));

    if (transformedPatients.length > 0) {
      // Check for existing patients to avoid duplicates
      const existingPatients = await db.collection('patients')
        .find({ legacyId: { $exists: true } })
        .toArray();
      
      const existingLegacyIds = new Set(existingPatients.map(p => p.legacyId));
      const newPatients = transformedPatients.filter(p => !existingLegacyIds.has(p.legacyId));

      if (newPatients.length > 0) {
        const result = await db.collection('patients').insertMany(newPatients);
        console.log(`   ✅ Inserted ${result.insertedCount} new patients`);
        
        // Build patient map
        newPatients.forEach((p, i) => {
          patientMap.set(p.legacyId, result.insertedIds[i]);
        });
      } else {
        console.log('   ⏭️  All patients already migrated');
      }

      // Add existing patients to map
      existingPatients.forEach(p => {
        patientMap.set(p.legacyId, p._id);
      });
    }

    // ========== MIGRATE OPD DETAILS (Appointments + Bills) ==========
    console.log('\n📅 Migrating OPD Details (Appointments & Bills)...');
    
    const opdColumns = [
      'id', 'patient_id', 'opd_no', 'appointment_date', 'case_type', 
      'casualty', 'symptoms', 'bp', 'height', 'weight', 'pulse', 
      'temperature', 'respiration', 'known_allergies', 'note_remark', 
      'refference', 'cons_doctor', 'amount', 'tax', 'payment_mode', 
      'header_note', 'footer_note', 'generated_by', 'discharged', 'live_consult'
    ];

    const allOpd = extractTableData(sqlContent, 'opd_details', opdColumns);
    console.log(`   Found ${allOpd.length} OPD records in SQL`);

    // Check existing
    const existingAppointments = await db.collection('appointments')
      .find({ legacyId: { $exists: true } })
      .toArray();
    const existingLegacyOpdIds = new Set(existingAppointments.map(a => a.legacyId));

    const newAppointments = [];
    const newBills = [];

    for (const opd of allOpd) {
      if (existingLegacyOpdIds.has(opd.id)) continue;
      
      const { appointment, bill } = transformOPD(opd, patientMap);
      newAppointments.push(appointment);
      if (bill) newBills.push(bill);
    }

    if (newAppointments.length > 0) {
      const aptResult = await db.collection('appointments').insertMany(newAppointments);
      console.log(`   ✅ Inserted ${aptResult.insertedCount} appointments`);
    } else {
      console.log('   ⏭️  All appointments already migrated');
    }

    if (newBills.length > 0) {
      // Check existing bills
      const existingBills = await db.collection('opd_bills')
        .find({ legacyOpdId: { $exists: true } })
        .toArray();
      const existingBillOpdIds = new Set(existingBills.map(b => b.legacyOpdId));
      
      const billsToInsert = newBills.filter(b => !existingBillOpdIds.has(b.legacyOpdId));
      
      if (billsToInsert.length > 0) {
        const billResult = await db.collection('opd_bills').insertMany(billsToInsert);
        console.log(`   ✅ Inserted ${billResult.insertedCount} OPD bills`);
      }
    }

    // ========== MIGRATE SERVICE CHARGES ==========
    console.log('\n💰 Migrating Service Charges...');
    
    const chargeColumns = [
      'id', 'charge_type', 'charge_category', 'description', 
      'code', 'standard_charge', 'date', 'status'
    ];

    const allCharges = extractTableData(sqlContent, 'charges', chargeColumns);
    console.log(`   Found ${allCharges.length} charges in SQL`);

    // Check existing
    const existingCharges = await db.collection('service_items')
      .find({ legacyId: { $exists: true } })
      .toArray();
    const existingLegacyChargeIds = new Set(existingCharges.map(c => c.legacyId));

    const transformedCharges = allCharges
      .filter(c => c.charge_category && !existingLegacyChargeIds.has(c.id))
      .map(transformCharge);

    // Remove duplicates by name+category
    const uniqueCharges = [];
    const seenCharges = new Set();
    
    for (const charge of transformedCharges) {
      const key = `${charge.name.toLowerCase()}-${charge.category}`;
      if (!seenCharges.has(key)) {
        seenCharges.add(key);
        uniqueCharges.push(charge);
      }
    }

    if (uniqueCharges.length > 0) {
      const chargeResult = await db.collection('service_items').insertMany(uniqueCharges);
      console.log(`   ✅ Inserted ${chargeResult.insertedCount} service charges`);
    } else {
      console.log('   ⏭️  All charges already migrated');
    }

    // ========== SUMMARY ==========
    console.log('\n' + '='.repeat(60));
    console.log('Migration Summary');
    console.log('='.repeat(60));
    
    const patientCount = await db.collection('patients').countDocuments();
    const appointmentCount = await db.collection('appointments').countDocuments();
    const billCount = await db.collection('opd_bills').countDocuments();
    const chargeCount = await db.collection('service_items').countDocuments();

    console.log(`   Patients:     ${patientCount}`);
    console.log(`   Appointments: ${appointmentCount}`);
    console.log(`   OPD Bills:    ${billCount}`);
    console.log(`   Services:     ${chargeCount}`);
    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run migration
migrate();
