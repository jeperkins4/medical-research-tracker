#!/usr/bin/env node
/**
 * Direct test of CareSpace scraper (bypasses API authentication)
 */

import { init as initDb, query } from './server/db.js';
import { unlockVault } from './server/vault.js';
import { getCredential } from './server/portal-credentials.js';
import { syncCareSpace } from './server/connectors/carespace.js';

// Initialize database
initDb();

// Unlock vault (you'll need to enter the master password)
const masterPassword = process.env.VAULT_PASSWORD || 'test123'; // Change this!

try {
  unlockVault(masterPassword);
  console.log('✅ Vault unlocked');
} catch (error) {
  console.error('❌ Failed to unlock vault:', error.message);
  console.error('   Set VAULT_PASSWORD environment variable or update the script');
  process.exit(1);
}

// Get CareSpace credential
const credentialRows = query("SELECT id FROM portal_credentials WHERE portal_type = 'carespace' LIMIT 1");
if (!credentialRows || credentialRows.length === 0) {
  console.error('❌ No CareSpace credential found');
  process.exit(1);
}

const credential = getCredential(credentialRows[0].id);
console.log(`🔐 Got credential for: ${credential.service_name}`);

// Run the sync
console.log('\n🚀 Starting CareSpace sync...\n');

syncCareSpace(credential)
  .then(result => {
    console.log('\n✅ Sync complete!');
    console.log(JSON.stringify(result, null, 2));
  })
  .catch(error => {
    console.error('\n❌ Sync failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
