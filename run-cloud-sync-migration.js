import 'dotenv/config';
import { init, run } from './server/db-secure.js';
import { readFileSync } from 'fs';

init();

const migration = readFileSync('./server/migrations/004_add_cloud_sync.sql', 'utf-8');
const statements = migration.split(';').filter(s => s.trim());

console.log('📦 Applying cloud sync migration...\n');

for (const statement of statements) {
  if (statement.trim()) {
    try {
      run(statement);
      const preview = statement.trim().split('\n')[0].substring(0, 70);
      console.log('✅', preview + (preview.length >= 70 ? '...' : ''));
    } catch (err) {
      if (err.message.includes('duplicate column name')) {
        const preview = statement.trim().split('\n')[0].substring(0, 70);
        console.log('⊘  (already exists)', preview.substring(0, 50) + '...');
      } else {
        console.error('❌', err.message);
        throw err;
      }
    }
  }
}

console.log('\n✅ Migration complete!');
