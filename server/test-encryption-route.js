/**
 * Encryption Test API Route
 * 
 * Test application-level encryption through HTTP endpoint
 */

import { Router } from 'express';
import { getDb, encryptField, decryptField } from './db-secure.js';

const router = Router();

/**
 * GET /api/test/encryption
 * Run encryption tests and return results
 */
router.get('/encryption', (req, res) => {
  const db = getDb();
  const results = [];

  try {
    // Test 1: Field encryption/decryption
    const testData = 'Sensitive PHI: John Doe, SSN 123-45-6789';
    const encrypted = encryptField(testData);
    const decrypted = decryptField(encrypted);
    
    results.push({
      test: 'Field Encryption',
      passed: testData === decrypted,
      original_length: testData.length,
      encrypted_length: encrypted.length,
      sample: encrypted.substring(0, 40) + '...'
    });

    // Test 2: Database encryption
    db.exec(`
      CREATE TABLE IF NOT EXISTS test_phi (
        id INTEGER PRIMARY KEY,
        name TEXT,
        ssn TEXT,
        age INTEGER
      )
    `);

    const patient = {
      name: 'Test Patient',
      ssn: '999-88-7777',
      age: 55
    };

    // Insert with encryption
    const encName = encryptField(patient.name);
    const encSSN = encryptField(patient.ssn);

    db.prepare(`
      INSERT OR REPLACE INTO test_phi (id, name, ssn, age)
      VALUES (1, ?, ?, ?)
    `).run(encName, encSSN, patient.age);

    // Read raw (should be encrypted)
    const rawRow = db.prepare('SELECT * FROM test_phi WHERE id = 1').get();
    const isEncrypted = rawRow.name !== patient.name && rawRow.ssn !== patient.ssn;

    // Decrypt
    const decName = decryptField(rawRow.name);
    const decSSN = decryptField(rawRow.ssn);
    const decryptionCorrect = decName === patient.name && decSSN === patient.ssn;

    results.push({
      test: 'Database Encryption',
      passed: isEncrypted && decryptionCorrect,
      raw_name_sample: rawRow.name.substring(0, 40) + '...',
      decrypted_name: decName,
      age_not_encrypted: rawRow.age === patient.age
    });

    // Cleanup
    db.exec('DROP TABLE test_phi');

    res.json({
      success: true,
      all_tests_passed: results.every(r => r.passed),
      tests: results,
      encryption_method: 'AES-256-GCM',
      key_derivation: 'PBKDF2 (100k iterations)',
      message: results.every(r => r.passed) 
        ? '✅ All encryption tests passed! PHI is encrypted at rest.'
        : '❌ Some tests failed'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

export default router;
