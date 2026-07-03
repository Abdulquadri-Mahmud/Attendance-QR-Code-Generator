require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

async function seed() {
  try {
    console.log('🌱 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected\n');

    // Clear existing users (comment this out if you don't want to reset)
    await User.deleteMany({});
    console.log('🗑️  Cleared existing users\n');

    const users = [
      {
        fullName: 'System Administrator',
        role: 'admin',
        department: 'ICT',
        staffId: 'ADMIN001',
        passwordHash: 'admin123',
        level: 'STAFF',
        email: 'admin@gaposa.edu.ng',
      },
      {
        fullName: 'Dr. Adeyemi Mahmud',
        role: 'lecturer',
        department: 'Computer Science',
        staffId: 'LEC001',
        passwordHash: 'lec123',
        level: 'STAFF',
        email: 'adeyemi@gaposa.edu.ng',
      },
      {
        fullName: 'Dr. Fatima Bello',
        role: 'lecturer',
        department: 'Computer Science',
        staffId: 'LEC002',
        passwordHash: 'lec123',
        level: 'STAFF',
        email: 'fatima@gaposa.edu.ng',
      },
      {
        fullName: 'Abubakar Musa Ibrahim',
        role: 'student',
        department: 'Computer Science',
        matricNumber: 'GIP/ND2/CSC/001',
        passwordHash: 'GIP/ND2/CSC/001',
        level: 'ND2',
      },
      {
        fullName: 'Chioma Okonkwo Grace',
        role: 'student',
        department: 'Computer Science',
        matricNumber: 'GIP/ND2/CSC/002',
        passwordHash: 'GIP/ND2/CSC/002',
        level: 'ND2',
      },
      {
        fullName: 'Emeka Chukwuemeka Victor',
        role: 'student',
        department: 'Computer Science',
        matricNumber: 'GIP/ND2/CSC/003',
        passwordHash: 'GIP/ND2/CSC/003',
        level: 'ND2',
      },
      {
        fullName: 'Fatima Al-Hassan Zainab',
        role: 'student',
        department: 'Computer Science',
        matricNumber: 'GIP/ND2/CSC/004',
        passwordHash: 'GIP/ND2/CSC/004',
        level: 'ND2',
      },
      {
        fullName: 'Daniel Adewale Oluwaseun',
        role: 'student',
        department: 'Computer Science',
        matricNumber: 'GIP/ND2/CSC/005',
        passwordHash: 'GIP/ND2/CSC/005',
        level: 'ND2',
      },
    ];

    const created = await User.create(users);
    console.log(`✅ Created ${created.length} users:\n`);
    created.forEach((u) => {
      const id = u.matricNumber || u.staffId;
      console.log(`  [${u.role.toUpperCase()}] ${u.fullName} — Login ID: ${id}`);
    });

    console.log('\n📋 TEST CREDENTIALS:');
    console.log('  Admin    → ID: ADMIN001  | Password: admin123');
    console.log('  Lecturer → ID: LEC001    | Password: lec123');
    console.log('  Student  → ID: GIP/ND2/CSC/001 | Password: GIP/ND2/CSC/001');
    console.log('\n✅ Seed complete!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
}

seed();
