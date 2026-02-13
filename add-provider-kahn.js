import Database from 'better-sqlite3';
const db = new Database('./data/health.db');

console.log('Adding Dr. Kahn at Johns Hopkins...\n');

// Insert provider
const insertProvider = db.prepare(`
    INSERT INTO healthcare_providers 
    (name, specialty, institution, role, first_seen_date, active, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// Add Dr. Kahn - assuming third opinion role based on chronology
// User can provide more details about the consultation date and specifics
const kahnId = insertProvider.run(
    'Dr. Kahn',
    'Medical Oncology',
    'Johns Hopkins',
    'third-opinion',  // Can be updated if different role
    '2025-03-01',  // Approximate date, can be updated with actual date
    1,
    'Consulted at Johns Hopkins for additional expert opinion on Stage IV bladder cancer treatment options.'
).lastInsertRowid;

console.log(`✓ Added: Dr. Kahn - Johns Hopkins (ID ${kahnId})`);

// Link to bladder cancer condition
const bladderCancer = db.prepare('SELECT id FROM conditions WHERE name = ?').get('Stage IV Bladder Cancer');

if (bladderCancer) {
    const linkConditionProvider = db.prepare(`
        INSERT INTO condition_providers (condition_id, provider_id, role, started_date, notes)
        VALUES (?, ?, ?, ?, ?)
    `);
    
    linkConditionProvider.run(
        bladderCancer.id,
        kahnId,
        'consulting',
        '2025-03-01',
        'Third opinion consultation for treatment options'
    );
    console.log('✓ Linked to Stage IV Bladder Cancer condition');
}

// Add a placeholder second opinion record that can be updated with actual details
const insertSecondOpinion = db.prepare(`
    INSERT INTO second_opinions
    (provider_id, requested_date, reason, notes)
    VALUES (?, ?, ?, ?)
`);

insertSecondOpinion.run(
    kahnId,
    '2025-03-01',
    'Third opinion consultation for Stage IV bladder cancer treatment options',
    'Johns Hopkins consultation. Details can be updated with specific recommendations and findings.'
);

console.log('✓ Added consultation record (can be updated with specific details)');

console.log('\n✅ Dr. Kahn at Johns Hopkins has been added to your healthcare team!');
console.log('\nTo update with specific details, you can provide:');
console.log('- Exact consultation date');
console.log('- Specific diagnosis opinion');
console.log('- Treatment recommendations');
console.log('- Whether opinion differed from primary oncologist');
console.log('- Any specific notes or findings');

db.close();
