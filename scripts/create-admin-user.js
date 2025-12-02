/**
 * Create default admin user
 */
import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb';
import crypto from 'crypto';

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'clinic_db';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

async function createAdmin() {
  console.log('Creating default admin user...\n');

  const client = new MongoClient(MONGODB_URI, {
    serverApi: { version: ServerApiVersion.v1 },
  });

  try {
    await client.connect();
    const db = client.db(DB_NAME);

    // Check if admin already exists
    const existingAdmin = await db.collection('users').findOne({ username: 'admin' });
    
    if (existingAdmin) {
      console.log('Admin user already exists');
      return;
    }

    // Create admin user
    const admin = {
      _id: new ObjectId(),
      username: 'admin',
      password: hashPassword('admin123'),
      name: 'Administrator',
      role: 'admin',
      email: null,
      phone: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection('users').insertOne(admin);
    
    console.log('✅ Admin user created successfully!');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('\n⚠️  Please change the password after first login!');

  } catch (error) {
    console.error('Failed:', error);
  } finally {
    await client.close();
  }
}

createAdmin();
