#!/usr/bin/env node

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'data', 'health.db');
const db = new Database(dbPath);

console.log('Adding Dr. Guru P. Sonpavde to healthcare providers...');

const insertProvider = db.prepare(`
    INSERT INTO healthcare_providers (
        name, specialty, institution, address, role, phone, email, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const provider = {
    name: 'Dr. Guru P. Sonpavde, MD',
    specialty: 'Genitourinary (GU) Oncology, Bladder Cancer, Phase I Clinical Trials',
    institution: 'AdventHealth Cancer Institute',
    address: 'Orlando, FL',
    role: 'second-opinion',
    phone: null,
    email: null,
    notes: `Medical Director of Genitourinary (GU) Oncology and Phase I Clinical Research Unit at AdventHealth Cancer Institute. Christopher K. Glanz Chair for Bladder Cancer Research. Expert in bladder cancer drug development, translational research, and Phase 1 clinical trials. Medical degree from Christian Medical College Vellore, 20+ years experience. Highly skilled medical oncologist with expertise in GU oncology, particularly bladder and prostate cancer. Focuses on evaluating new and promising treatments in Phase I trials.`
};

const result = insertProvider.run(
    provider.name,
    provider.specialty,
    provider.institution,
    provider.address,
    provider.role,
    provider.phone,
    provider.email,
    provider.notes
);

console.log(`✓ Added Dr. Guru P. Sonpavde (Provider ID: ${result.lastInsertRowid})`);

// Link to Stage IV Bladder Cancer condition
console.log('\nLinking Dr. Sonpavde to Stage IV Bladder Cancer condition...');

const bladderCancer = db.prepare('SELECT id FROM conditions WHERE name LIKE ?').get('%Bladder Cancer%');

if (bladderCancer) {
    const linkProvider = db.prepare(`
        INSERT INTO condition_providers (condition_id, provider_id, role)
        VALUES (?, ?, ?)
    `);
    
    linkProvider.run(bladderCancer.id, result.lastInsertRowid, 'second-opinion');
    console.log(`✓ Linked Dr. Sonpavde to Stage IV Bladder Cancer condition`);
} else {
    console.log('⚠️ Stage IV Bladder Cancer condition not found - skipping link');
}

console.log('\n✅ Dr. Guru P. Sonpavde added to provider network!');
console.log('\nYour Complete Healthcare Team:');

const providers = db.prepare(`
    SELECT name, specialty, institution, role 
    FROM healthcare_providers 
    ORDER BY 
        CASE role
            WHEN 'primary' THEN 1
            WHEN 'consulting' THEN 2
            WHEN 'second-opinion' THEN 3
            WHEN 'third-opinion' THEN 4
            WHEN 'specialist' THEN 5
            ELSE 6
        END,
        id
`).all();

let currentRole = '';
providers.forEach((p) => {
    if (p.role !== currentRole) {
        currentRole = p.role;
        console.log(`\n${currentRole.toUpperCase().replace('-', ' ')}:`);
    }
    console.log(`  • ${p.name}`);
    console.log(`    ${p.specialty}`);
    console.log(`    ${p.institution || '(Institution not listed)'}`);
});

console.log(`\n📊 Total: ${providers.length} healthcare providers`);

db.close();
