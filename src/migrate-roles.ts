import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

async function migrateRoles() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/quizz';
    
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection failed');
    }
    
    const usersCollection = db.collection('users');
    
    // Fix users with role: 'admin' to have roles: ['admin']
    const result1 = await usersCollection.updateMany(
      { role: 'admin', $or: [{ roles: { $eq: ['student'] } }, { roles: { $exists: false } }] },
      { 
        $set: { roles: ['admin'] },
        $unset: { role: '' }
      }
    );
    
    console.log('✓ Updated admin users:', result1.modifiedCount);
    
    // Fix users with role: 'teacher' to have roles: ['teacher']
    const result2 = await usersCollection.updateMany(
      { role: 'teacher', $or: [{ roles: { $eq: ['student'] } }, { roles: { $exists: false } }] },
      { 
        $set: { roles: ['teacher'] },
        $unset: { role: '' }
      }
    );
    
    console.log('✓ Updated teacher users:', result2.modifiedCount);
    
    // Show all users
    const users = await usersCollection.find({}).toArray();
    console.log('\nAll users after migration:');
    users.forEach(u => {
      console.log(`  - ${u.email}: roles=${JSON.stringify(u.roles)}, role=${u.role || 'N/A'}`);
    });
    
    console.log('\n✓ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

migrateRoles();
