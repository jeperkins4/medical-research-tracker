#!/usr/bin/env node
/**
 * Manual sync trigger (bypasses authentication)
 */

import { syncPortal } from './server/portal-sync.js';

const credentialId = 1; // Your CareSpace credential ID

console.log('🔄 Starting manual CareSpace sync...\n');
console.log('This will take 30-60 seconds as the browser scrapes the portal.\n');

syncPortal(credentialId)
  .then(result => {
    console.log('\n✅ SYNC COMPLETE!\n');
    console.log('Results:');
    console.log(`  Records imported: ${result.recordsImported}`);
    console.log(`  Status: ${result.summary?.status || 'unknown'}`);
    console.log(`  Message: ${result.summary?.message || 'none'}`);
    
    if (result.summary?.details) {
      console.log('\nDetails:');
      console.log(`  Lab Results: ${result.summary.details.labResults || 0}`);
      console.log(`  Imaging Reports: ${result.summary.details.imagingReports || 0}`);
      console.log(`  Pathology Reports: ${result.summary.details.pathologyReports || 0}`);
      console.log(`  Clinical Notes: ${result.summary.details.clinicalNotes || 0}`);
      console.log(`  Medications: ${result.summary.details.medications || 0}`);
    }
    
    if (result.summary?.errors && result.summary.errors.length > 0) {
      console.log('\nErrors:');
      result.summary.errors.forEach(err => console.log(`  ⚠ ${err}`));
    }
    
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ SYNC FAILED!');
    console.error(`Error: ${error.message}`);
    console.error('\nStack trace:');
    console.error(error.stack);
    process.exit(1);
  });
