// Password Hashing Utility
// Run this to generate hashed passwords for new admin users

import bcrypt from 'bcryptjs';

async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  return hash;
}

// Usage: npx tsx scripts/hash-password.ts <password>
async function generateHash() {
  const password = process.argv[2];
  if (!password) {
    console.error('Usage: npx tsx scripts/hash-password.ts <password>');
    process.exit(1);
  }
  const hash = await hashPassword(password);

  console.log('\n=== Password Hash Generator ===\n');
  console.log(`Hashed: ${hash}\n`);
  console.log('Paste this value into the user\'s passwordHash field in cms-data/users.json on the server.\n');
}

if (require.main === module) {
  generateHash();
}

export { hashPassword };
