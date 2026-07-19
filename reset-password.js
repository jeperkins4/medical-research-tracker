import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Username and new password must be supplied on the command line, e.g.:
//   node reset-password.js <username> <new-password>
const username = process.argv[2];
const newPassword = process.argv[3];

if (!username || !newPassword) {
  console.error('Usage: node reset-password.js <username> <new-password>');
  process.exit(1);
}

const dbPath = path.join(__dirname, 'data', 'health.db');
const db = new Database(dbPath);

const hashedPassword = bcrypt.hashSync(newPassword, 10);

const updateUser = db.prepare(`
  UPDATE users 
  SET password_hash = ?
  WHERE username = ?
`);

const result = updateUser.run(hashedPassword, username);

if (result.changes > 0) {
  console.log('✅ Password reset successful!');
  console.log(`\nUsername: ${username}`);
  console.log(`Password: ${newPassword}`);
  console.log('\nYou can now login at: http://localhost:5173/');
} else {
  console.log('❌ User not found');
}

db.close();
