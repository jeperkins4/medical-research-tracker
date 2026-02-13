import Database from 'better-sqlite3';
const db = new Database('./data/health.db');

console.log('Adding Dr. Zaiden at MD Anderson Jacksonville...\n');

// Insert provider
const insertProvider = db.prepare(`
    INSERT INTO healthcare_providers 
    (name, specialty, institution, role, first_seen_date, active, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// Add Dr. Zaiden - MD Anderson is a major cancer center, likely another opinion consultation
const zaidenId = insertProvider.run(
    'Dr. Zaiden',
    'Medical Oncology',
    'MD Anderson Cancer Center - Jacksonville',
    'second-opinion',  // Can be updated if different role
    '2025-03-01',  // Approximate date, can be updated with actual date
    1,
    'Consulted at MD Anderson Jacksonville for expert opinion on Stage IV bladder cancer treatment options.'
).lastInsertRowid;

console.log(`✓ Added: Dr. Zaiden - MD Anderson Jacksonville (ID ${zaidenId})`);

// Link to bladder cancer condition
const bladderCancer = db.prepare('SELECT id FROM conditions WHERE name = ?').get('Stage IV Bladder Cancer');

if (bladderCancer) {
    const linkConditionProvider = db.prepare(`
        INSERT INTO condition_providers (condition_id, provider_id, role, started_date, notes)
        VALUES (?, ?, ?, ?, ?)
    `);
    
    linkConditionProvider.run(
        bladderCancer.id,
        zaidenId,
        'consulting',
        '2025-03-01',
        'MD Anderson consultation for treatment options'
    );
    console.log('✓ Linked to Stage IV Bladder Cancer condition');
}

// Add a placeholder consultation record
const insertSecondOpinion = db.prepare(`
    INSERT INTO second_opinions
    (provider_id, requested_date, reason, notes)
    VALUES (?, ?, ?, ?)
`);

insertSecondOpinion.run(
    zaidenId,
    '2025-03-01',
    'Expert consultation for Stage IV bladder cancer treatment options',
    'MD Anderson Jacksonville consultation. Details can be updated with specific recommendations and findings.'
);

console.log('✓ Added consultation record (can be updated with specific details)');

console.log('\n✅ Dr. Zaiden at MD Anderson Jacksonville has been added to your healthcare team!');
console.log('\nBoth Dr. Kahn (Johns Hopkins) and Dr. Zaiden (MD Anderson) are now documented.');
console.log('You can provide specific details from either consultation to update their records.');

db.close();
