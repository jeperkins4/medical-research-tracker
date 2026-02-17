/**
 * Fix Genomics Migration
 * 
 * Complete the migration for genomics tables that failed in the automated migration
 */

import PlaintextDb from 'better-sqlite3';
import EncryptedDb from 'better-sqlite3-multiple-ciphers';
import 'dotenv/config';

const PLAINTEXT_DB = './data/health.db';
const ENCRYPTED_DB = './data/health-secure.db';
const DB_KEY = process.env.DB_ENCRYPTION_KEY;

console.log('🔬 Fixing Genomics Migration...\n');

// Open databases
const oldDb = new PlaintextDb(PLAINTEXT_DB, { readonly: true });
const newDb = new EncryptedDb(ENCRYPTED_DB);
newDb.pragma(`key = "${DB_KEY}"`);
newDb.pragma('cipher_compatibility = 4');

// Genomics tables to migrate
const genomicsTables = [
  'genomic_mutations',
  'pathways',
  'mutation_pathways',
  'mutation_treatments',
  'genomic_trials',
  'biomarkers',
  'vus_variants',
  'treatment_genomic_correlation',
  'genomic_pathways',
  'mutation_pathway_map',
  'genomic_treatments'
];

let totalMigrated = 0;

for (const tableName of genomicsTables) {
  console.log(`📊 Migrating ${tableName}...`);
  
  try {
    // Get schema
    const schema = oldDb.prepare(`SELECT sql FROM sqlite_master WHERE name = ?`).get(tableName);
    
    if (schema && schema.sql) {
      // Create table in encrypted DB
      try {
        newDb.exec(schema.sql);
        console.log(`  ✅ Schema created`);
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log(`  ℹ️  Schema already exists`);
        } else {
          throw err;
        }
      }
      
      // Get data
      const rows = oldDb.prepare(`SELECT * FROM ${tableName}`).all();
      
      if (rows.length > 0) {
        const columns = Object.keys(rows[0]);
        const placeholders = columns.map(() => '?').join(',');
        const insertStmt = newDb.prepare(`INSERT OR REPLACE INTO ${tableName} (${columns.join(',')}) VALUES (${placeholders})`);
        
        // Use transaction for performance
        const insertMany = newDb.transaction((records) => {
          for (const record of records) {
            insertStmt.run(...columns.map(col => record[col]));
          }
        });
        
        insertMany(rows);
        console.log(`  ✅ Migrated ${rows.length} rows\n`);
        totalMigrated += rows.length;
      } else {
        console.log(`  ℹ️  No data to migrate\n`);
      }
    } else {
      console.log(`  ⚠️  Table not found in source database\n`);
    }
  } catch (err) {
    console.error(`  ❌ Error: ${err.message}\n`);
  }
}

// Verify migration
console.log('\n🔍 Verifying genomics data...\n');

const verification = {
  genomic_mutations: newDb.prepare('SELECT COUNT(*) as count FROM genomic_mutations').get(),
  pathways: newDb.prepare('SELECT COUNT(*) as count FROM pathways').get(),
  genomic_pathways: newDb.prepare('SELECT COUNT(*) as count FROM genomic_pathways').get(),
  genomic_treatments: newDb.prepare('SELECT COUNT(*) as count FROM genomic_treatments').get()
};

console.log('Verification Results:');
console.log(`  • Mutations: ${verification.genomic_mutations.count}`);
console.log(`  • Pathways: ${verification.pathways.count}`);
console.log(`  • Genomic Pathways: ${verification.genomic_pathways.count}`);
console.log(`  • Treatments: ${verification.genomic_treatments.count}`);

oldDb.close();
newDb.close();

console.log(`\n✅ Genomics migration complete! ${totalMigrated} rows migrated.\n`);
