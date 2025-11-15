#!/usr/bin/env node
const bcrypt = require('bcrypt');

const password = process.argv[2];

if (!password) {
  console.error('Usage: node scripts/generate-password-hash.js <password>');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
console.log('');
console.log('Password hash generated:');
console.log(hash);
console.log('');
console.log('Add to your ADMIN_ACCESS_CREDENTIALS:');
console.log(JSON.stringify({
  actorId: 'admin-001',
  email: 'admin@example.com',
  passwordHash: hash,
  label: 'Admin User'
}, null, 2));
console.log('');
