import 'dotenv/config';
import sqlcipher from '@journeyapps/sqlcipher';

const Database = sqlcipher.Database;
const db = new Database('./data/health-secure.db');

db.exec(`PRAGMA key = "${process.env.DB_ENCRYPTION_KEY}";`);
db.exec('PRAGMA cipher_compatibility = 4;');

// Test API
console.log('Database methods:', Object.getOwnPropertyNames(db).slice(0, 10));

const stmt = db.prepare('SELECT * FROM users');
console.log('Statement methods:', Object.getOwnPropertyNames(stmt.__proto__).join(', '));

// Try different query methods
console.log('\nTrying stmt.all():');
const result1 = stmt.all();
console.log('Type:', typeof result1, 'Value:', result1);

console.log('\nTrying db.prepare().all():');
const result2 = db.prepare('SELECT COUNT(*) as count FROM users').all();
console.log('Type:', typeof result2, 'Value:', result2);
