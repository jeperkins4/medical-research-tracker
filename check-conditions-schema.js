import 'dotenv/config';
import { init, query } from './server/db-secure.js';

await init();

console.log('\n📋 Conditions table schema:\n');

const schema = query(`SELECT sql FROM sqlite_master WHERE type='table' AND name='conditions'`);
console.log(schema[0]?.sql || 'Table not found');

console.log('\n📊 Conditions table columns:\n');
const columns = query(`PRAGMA table_info(conditions)`);
columns.forEach(col => {
  console.log(`  ${col.name} (${col.type})`);
});
