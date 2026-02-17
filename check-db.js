import Database from 'better-sqlite3-multiple-ciphers';
import dotenv from 'dotenv';

dotenv.config();

const db = new Database('data/health-secure.db');
db.pragma(`key='${process.env.DB_ENCRYPTION_KEY}'`);
db.pragma('cipher_compatibility = 4');

console.log('Users table:');
try {
  const users = db.prepare('SELECT id, username FROM users').all();
  console.log(JSON.stringify(users, null, 2));
} catch (err) {
  console.error('Error querying users:', err.message);
}

console.log('\nMeals count:');
try {
  const mealsCount = db.prepare('SELECT COUNT(*) as count FROM meals').get();
  console.log(mealsCount);
} catch (err) {
  console.error('Error querying meals:', err.message);
}

console.log('\nFoods count:');
try {
  const foodsCount = db.prepare('SELECT COUNT(*) as count FROM foods').get();
  console.log(foodsCount);
} catch (err) {
  console.error('Error querying foods:', err.message);
}

console.log('\nTables in database:');
try {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  console.log(tables.map(t => t.name));
} catch (err) {
  console.error('Error listing tables:', err.message);
}

db.close();
