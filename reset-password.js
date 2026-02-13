import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'data', 'health.db');
const db = new Database(dbPath);

// Reset password for jeperkins4
const username = 'jeperkins4';
const newPassword = 'health2024';

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
