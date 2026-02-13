import Database from 'better-sqlite3';
const db = new Database('./data/health.db');

console.log('Adding Ubiquinol 100mg to medication list...\n');

// Check if it already exists
const checkMed = db.prepare('SELECT id FROM medications WHERE name LIKE ? AND stopped_date IS NULL').get('%Ubiquinol%');

if (checkMed) {
    console.log('⚠ Ubiquinol already exists in medication list');
} else {
    const insertMed = db.prepare(`
        INSERT INTO medications (name, dosage, frequency, started_date, reason, notes)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertMed.run(
        'Ubiquinol (CoQ10)',
        '100 mg',
        'Daily',
        '2022-01-01',  // Approximate start date, can be updated
        'Cardiovascular support, cellular energy, antioxidant',
        `Ubiquinol is the active, reduced form of Coenzyme Q10 (CoQ10).

Key benefits:
- Cardiovascular health support
- Cellular energy production (mitochondrial function)
- Powerful antioxidant
- May help reduce oxidative stress from cancer treatment
- Important for patients on statins or with heart conditions
- Can support healthy blood pressure

Particularly relevant for patient with:
- DVT history (cardiovascular health)
- Cancer treatment (oxidative stress protection)
- Overall mitochondrial/cellular health support`
    );

    console.log('✓ Successfully added Ubiquinol 100mg');
}

// Display current supplement regimen
console.log('\n' + '═'.repeat(70));
console.log('CURRENT SUPPLEMENT REGIMEN:');
console.log('═'.repeat(70) + '\n');

const supplements = db.prepare(`
    SELECT name, dosage, frequency, reason
    FROM medications 
    WHERE stopped_date IS NULL 
    AND (name LIKE '%Vitamin%' 
         OR name LIKE '%Ubiquinol%' 
         OR name LIKE '%CoQ10%'
         OR name LIKE '%Sea Moss%' 
         OR name LIKE '%Mushroom%'
         OR name LIKE '%Pendulum%'
         OR name LIKE '%Probiotic%')
    ORDER BY name
`).all();

supplements.forEach(sup => {
    console.log(`${sup.name}`);
    console.log(`  Dosage: ${sup.dosage}`);
    console.log(`  Frequency: ${sup.frequency}`);
    console.log(`  Purpose: ${sup.reason}`);
    console.log();
});

db.close();

console.log('═'.repeat(70));
console.log('✅ Medication list updated with Ubiquinol 100mg!');
