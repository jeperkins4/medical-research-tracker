#!/usr/bin/env node

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'data', 'health.db');
const db = new Database(dbPath);

console.log('Adding Dr. John Gildea to healthcare providers...');

const insertProvider = db.prepare(`
    INSERT INTO healthcare_providers (
        name, specialty, institution, address, role, phone, email, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const provider = {
    name: 'Dr. John Gildea, PhD',
    specialty: 'Cancer Biology, Cell Signaling, Molecular Biology, Signal Transduction',
    institution: 'Advance Wellness and Longevity',
    address: null, // Not specified on website
    role: 'Integrative Oncology Consultant',
    phone: null,
    email: null,
    notes: `Johns Hopkins-trained PhD with 60+ scientific publications from over 20 NIH-funded studies. Expert in cell culture, exosomes, cancer biology, cell signaling, molecular biology and signal transduction. Performed science behind RESTORE gut supplement and Mara-labs "cultivating wellness" supplements. Provides genomic-driven supplement protocols based on Foundation One CDx report analysis. Designed personalized protocol targeting: 1) Hypoxia/HIF1 pathway (cancer stem cells), 2) Multi-drug resistance (MDR) phenotype, 3) Immune escape (PD-L1 axis). MD/PhD team approach to integrative cancer care.`
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

console.log(`✓ Added Dr. John Gildea (Provider ID: ${result.lastInsertRowid})`);

// Create consultation record
console.log('\nCreating consultation record...');

const insertConsultation = db.prepare(`
    INSERT INTO consultations (
        provider_id, consultation_date, consultation_type, reason, recommendations, next_steps, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const consultation = {
    provider_id: result.lastInsertRowid,
    consultation_date: '2025-09-01', // Approximate date - adjust if you have exact date
    consultation_type: 'Genomic Analysis & Integrative Protocol Design',
    reason: 'Stage IV Bladder Cancer with ARID1A, FGFR3, PIK3Ca mutations',
    recommendations: `Genomic-driven supplement protocol targeting Foundation One CDx mutations:

MOLECULAR TARGETS:
1. Hypoxia/HIF1 Pathway (ARID1A-driven cancer stem cells)
2. Multi-Drug Resistance (MDR) Phenotype
3. Immune Escape (PD-L1 axis - supports Keytruda efficacy)

SUPPLEMENT RECOMMENDATIONS:
- Alpha-Ketoglutarate (AKG) 1000mg - HIF1 pathway modulation
- Ubiquinol 100mg - Mitochondrial support, MDR reversal
- Methylene Blue - Mitochondrial function, hypoxia targeting
- Additional supplements targeting specific mutation vulnerabilities

RATIONALE:
Protocol designed to complement conventional therapy (Keytruda + Padcev) by targeting tumor vulnerabilities created by specific genomic alterations. Focus on pathways dysregulated by ARID1A loss, FGFR3 activation, and PIK3Ca mutations.`,
    next_steps: 'Ongoing supplement protocol adjustments based on treatment response and lab results',
    notes: 'First integrative oncology consultation focused on genomic-driven supplement selection. Dr. Gildea analyzed Foundation One CDx report to identify molecular pathways requiring support. Protocol complements conventional immunotherapy + ADC treatment.'
};

const consultResult = insertConsultation.run(
    consultation.provider_id,
    consultation.consultation_date,
    consultation.consultation_type,
    consultation.reason,
    consultation.recommendations,
    consultation.next_steps,
    consultation.notes
);

console.log(`✓ Created consultation record (ID: ${consultResult.lastInsertRowid})`);

// Link to Stage IV Bladder Cancer condition
console.log('\nLinking Dr. Gildea to Stage IV Bladder Cancer condition...');

// Get bladder cancer condition ID
const bladderCancer = db.prepare('SELECT id FROM conditions WHERE name LIKE ?').get('%Bladder Cancer%');

if (bladderCancer) {
    const linkProvider = db.prepare(`
        INSERT INTO condition_providers (condition_id, provider_id, role)
        VALUES (?, ?, ?)
    `);
    
    linkProvider.run(bladderCancer.id, result.lastInsertRowid, 'consulting');
    console.log(`✓ Linked Dr. Gildea to Stage IV Bladder Cancer condition`);
} else {
    console.log('⚠️ Stage IV Bladder Cancer condition not found - skipping link');
}

console.log('\n✅ Dr. John Gildea added to provider network!');
console.log('\nProvider Network Summary:');

const providers = db.prepare(`
    SELECT name, specialty, institution, role 
    FROM healthcare_providers 
    ORDER BY id
`).all();

console.log('\nYour Complete Healthcare Team:');
providers.forEach((p, idx) => {
    console.log(`${idx + 1}. ${p.name} - ${p.role}`);
    console.log(`   ${p.specialty}`);
    console.log(`   ${p.institution}`);
    console.log('');
});

db.close();
