import 'dotenv/config';
import { init, query } from './server/db-secure.js';

await init();

console.log('\n📊 DATABASE DATA CHECK\n');
console.log('=' .repeat(60));

// Check users
const users = query('SELECT id, username, created_at FROM users');
console.log(`\n👥 Users: ${users.length}`);
users.forEach(u => console.log(`  - ${u.username} (ID: ${u.id}, created: ${u.created_at})`));

// Check conditions  
const conditions = query('SELECT id, name, diagnosed_date, status FROM conditions');
console.log(`\n🏥 Conditions: ${conditions.length}`);
conditions.forEach(c => console.log(`  - ${c.name} (${c.status}, diagnosed: ${c.diagnosed_date || 'N/A'})`));

// Check medications
const medications = query('SELECT COUNT(*) as count FROM medications');
console.log(`\n💊 Medications: ${medications[0].count}`);

// Check test results
const testResults = query('SELECT COUNT(*) as count FROM test_results');
console.log(`\n🧪 Test Results: ${testResults[0].count}`);

// Check genomic mutations
const mutations = query('SELECT COUNT(*) as count FROM genomic_mutations');
console.log(`\n🧬 Genomic Mutations: ${mutations[0].count}`);

// Check papers
const papers = query('SELECT COUNT(*) as count FROM papers');
console.log(`\n📚 Research Papers: ${papers[0].count}`);

// Check vitals
const vitals = query('SELECT COUNT(*) as count FROM vitals');
console.log(`\n💓 Vitals: ${vitals[0].count}`);

console.log('\n' + '='.repeat(60));
console.log('\n✅ Data check complete\n');
