import Database from 'better-sqlite3';
const db = new Database('./data/health.db');

console.log('Importing healthcare providers from medical records...\n');

// Insert provider
const insertProvider = db.prepare(`
    INSERT INTO healthcare_providers 
    (name, specialty, institution, role, phone, first_seen_date, last_seen_date, active, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Insert consultation
const insertConsultation = db.prepare(`
    INSERT INTO consultations 
    (provider_id, consultation_date, consultation_type, reason, findings, recommendations, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// Insert second opinion
const insertSecondOpinion = db.prepare(`
    INSERT INTO second_opinions
    (provider_id, requested_date, completed_date, reason, diagnosis_opinion, treatment_opinion, differs_from_primary, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

// Link provider to condition
const linkConditionProvider = db.prepare(`
    INSERT INTO condition_providers (condition_id, provider_id, role, started_date, notes)
    VALUES (?, ?, ?, ?, ?)
`);

console.log('1. Adding oncologists and specialists...\n');

// Primary Oncologist
const doId = insertProvider.run(
    'Dr. Tien Phuc Do MD',
    'Medical Oncology',
    'Florida Cancer Specialists - Tallahassee Cancer Center',
    'primary',
    '(850) 877-8166',
    '2025-08-22',
    '2026-01-23',
    1,
    'Current primary oncologist. Managing Stage IV bladder cancer with Keytruda/Padcev regimen.'
).lastInsertRowid;
console.log(`   ✓ Added: Dr. Tien Phuc Do MD (Primary Oncologist) - ID ${doId}`);

// Previous Oncologist
const tetreaultId = insertProvider.run(
    'Dr. Tetreault',
    'Medical Oncology',
    'Florida Cancer Specialists',
    'consulting',
    null,
    '2022-05-03',
    '2025-08-22',
    0,
    'Previous oncologist. Patient transitioned to Dr. Do for continuity of care.'
).lastInsertRowid;
console.log(`   ✓ Added: Dr. Tetreault (Previous Oncologist) - ID ${tetreaultId}`);

// Moffitt Cancer Center - Second Opinion
const moffittId = insertProvider.run(
    'Dr. Zhang',
    'Medical Oncology',
    'H. Lee Moffitt Cancer Center',
    'second-opinion',
    null,
    '2025-03-01',
    '2025-03-01',
    1,
    'Consulted for clinical trial consideration. Patient did not qualify for trial at that time.'
).lastInsertRowid;
console.log(`   ✓ Added: Dr. Zhang at Moffitt (Second Opinion) - ID ${moffittId}`);

// Mayo Clinic - Second Opinion
const mayoId = insertProvider.run(
    'Dr. Adam Kase',
    'Medical Oncology',
    'Mayo Clinic',
    'second-opinion',
    null,
    '2025-03-01',
    '2025-03-01',
    1,
    'Consulted for additional treatment options and clinical trial eligibility.'
).lastInsertRowid;
console.log(`   ✓ Added: Dr. Adam Kase at Mayo Clinic (Second Opinion) - ID ${mayoId}`);

// Urologist
const melquistId = insertProvider.run(
    'Dr. Melquist',
    'Urology',
    'Jacksonville',
    'specialist',
    null,
    '2022-05-03',
    '2026-01-23',
    1,
    'Performed cystectomy with ileal conduit 5/3/2022. Follows urologic issues and ileal conduit infections.'
).lastInsertRowid;
console.log(`   ✓ Added: Dr. Melquist (Urologist) - ID ${melquistId}`);

// Gastroenterologist
const muniyappaId = insertProvider.run(
    'Dr. Muniyappa',
    'Gastroenterology',
    null,
    'specialist',
    null,
    '2023-09-01',
    '2026-01-23',
    1,
    'Follows GI health care issues, managed autoimmune colitis in 2023.'
).lastInsertRowid;
console.log(`   ✓ Added: Dr. Muniyappa (Gastroenterologist) - ID ${muniyappaId}`);

// Ophthalmologist
const bellId = insertProvider.run(
    'Dr. Bell',
    'Ophthalmology',
    null,
    'specialist',
    null,
    '2024-04-01',
    '2026-01-23',
    1,
    'Monitors corneal health every 6 months due to ocular toxicity from cancer treatment.'
).lastInsertRowid;
console.log(`   ✓ Added: Dr. Bell (Ophthalmologist) - ID ${bellId}`);

// Vascular Surgeon
const umanaId = insertProvider.run(
    'Dr. Umana',
    'Vascular Surgery',
    'Vascular Surgery Associates',
    'specialist',
    null,
    '2023-04-01',
    '2023-04-01',
    1,
    'Performed intervention procedure for right upper extremity DVT associated with port (April 2023).'
).lastInsertRowid;
console.log(`   ✓ Added: Dr. Umana (Vascular Surgeon) - ID ${umanaId}`);

// Primary Care Physician
const martinezId = insertProvider.run(
    'Dr. Marino Martinez',
    'Primary Care',
    null,
    'primary',
    null,
    '2020-01-01',
    '2026-01-23',
    1,
    'Primary and preventative health care. Manages usual primary medical care, age-appropriate vaccines and cancer screening.'
).lastInsertRowid;
console.log(`   ✓ Added: Dr. Marino Martinez (Primary Care) - ID ${martinezId}`);

// Advanced Practice Nurse who co-signed note
const vidalId = insertProvider.run(
    'Elenora Vidal-Pascal APRN',
    'Medical Oncology',
    'Florida Cancer Specialists - Tallahassee Cancer Center',
    'consulting',
    '(850) 877-8166',
    '2025-08-22',
    '2026-01-23',
    1,
    'APRN working with Dr. Do. Co-signed consultation note 1/23/2026.'
).lastInsertRowid;
console.log(`   ✓ Added: Elenora Vidal-Pascal APRN - ID ${vidalId}`);

// Link providers to conditions
console.log('\n2. Linking providers to conditions...\n');

// Get condition IDs
const bladderCancer = db.prepare('SELECT id FROM conditions WHERE name = ?').get('Stage IV Bladder Cancer');
const hypothyroid = db.prepare('SELECT id FROM conditions WHERE name = ?').get('Profound Hypothyroidism');
const dvt = db.prepare('SELECT id FROM conditions WHERE name = ?').get('History of DVT');
const colitis = db.prepare('SELECT id FROM conditions WHERE name = ?').get('Autoimmune Colitis');
const ocular = db.prepare('SELECT id FROM conditions WHERE name = ?').get('Ocular Toxicity');

if (bladderCancer) {
    linkConditionProvider.run(bladderCancer.id, doId, 'managing', '2025-08-22', 'Current primary management');
    linkConditionProvider.run(bladderCancer.id, tetreaultId, 'managing', '2022-05-03', 'Previous management until 8/2025');
    linkConditionProvider.run(bladderCancer.id, melquistId, 'consulting', '2022-05-03', 'Surgical management and urologic follow-up');
    console.log('   ✓ Linked bladder cancer to oncologists and urologist');
}

if (hypothyroid) {
    linkConditionProvider.run(hypothyroid.id, martinezId, 'managing', '2020-01-01', 'Primary management of thyroid condition');
    console.log('   ✓ Linked hypothyroidism to primary care');
}

if (dvt) {
    linkConditionProvider.run(dvt.id, umanaId, 'consulting', '2023-04-01', 'Intervention procedure for DVT');
    linkConditionProvider.run(dvt.id, doId, 'monitoring', '2023-04-01', 'Ongoing anticoagulation management');
    console.log('   ✓ Linked DVT history to vascular surgeon and oncologist');
}

if (colitis) {
    linkConditionProvider.run(colitis.id, muniyappaId, 'managing', '2023-09-01', 'Managed autoimmune colitis episode');
    console.log('   ✓ Linked colitis to gastroenterologist');
}

if (ocular) {
    linkConditionProvider.run(ocular.id, bellId, 'monitoring', '2024-04-01', 'Corneal monitoring every 6 months');
    console.log('   ✓ Linked ocular toxicity to ophthalmologist');
}

// Add consultations
console.log('\n3. Adding consultation records...\n');

// Most recent consultation with Dr. Do
insertConsultation.run(
    doId,
    '2026-01-23',
    'follow-up',
    'Routine follow-up for Stage IV bladder cancer',
    'Patient doing well. ECOG 0. Labs stable. Recent PET/CT 12/10/2025 shows stable disease.',
    'Continue current Keytruda/Padcev regimen. Next scan March 2026. Continue lifestyle modifications for pre-diabetes.',
    'BP 116/81, HR 65, Weight 209.8 lbs, O2 Sat 97%. Hip achiness in mornings noted. Tolerating treatment well.'
);
console.log('   ✓ Added consultation: Dr. Do 1/23/2026');

// Add second opinion records
console.log('\n4. Recording second opinion consultations...\n');

// Moffitt second opinion
insertSecondOpinion.run(
    moffittId,
    '2025-03-01',
    '2025-03-01',
    'Evaluation for clinical trial eligibility after progression on Padcev',
    'Stage IV bladder cancer with bone metastases',
    'Clinical trial considered but patient did not qualify at that time',
    0,
    'Patient consulted multiple centers after progression by CT/PET in March 2025. Did not qualify for Moffitt clinical trial. Subsequently started personalized Padcev + Keytruda 6/20/2025.'
);
console.log('   ✓ Added second opinion: Moffitt Cancer Center (clinical trial evaluation)');

// Mayo Clinic second opinion
insertSecondOpinion.run(
    mayoId,
    '2025-03-01',
    '2025-03-01',
    'Additional treatment options after progression',
    'Stage IV bladder cancer',
    'Evaluation for additional treatment options',
    0,
    'Part of multi-center consultation after disease progression. Patient ultimately restarted Padcev with addition of Keytruda.'
);
console.log('   ✓ Added second opinion: Mayo Clinic (treatment options)');

db.close();

console.log('\n✅ Healthcare providers import complete!\n');
console.log('Summary:');
console.log('- 10 healthcare providers added');
console.log('- Primary oncologist: Dr. Tien Phuc Do MD');
console.log('- 2 second opinion consultations documented');
console.log('- Providers linked to relevant conditions');
console.log('- Recent consultation record from 1/23/2026 added');
console.log('\nYou can now track all your healthcare team and consultations!');
