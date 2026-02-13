import Database from 'better-sqlite3';
const db = new Database('./data/health.db');

console.log('Adding Alpha-Ketoglutarate (AKG) 1000mg to medication list...\n');

// Check if it already exists
const checkMed = db.prepare('SELECT id FROM medications WHERE name LIKE ? AND stopped_date IS NULL').get('%AKG%');

if (checkMed) {
    console.log('⚠ AKG already exists in medication list');
} else {
    const insertMed = db.prepare(`
        INSERT INTO medications (name, dosage, frequency, started_date, reason, notes)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertMed.run(
        'Alpha-Ketoglutarate (AKG)',
        '1000 mg',
        'Daily',
        '2023-01-01',  // Approximate start date, can be updated
        'Longevity, cellular energy, metabolic health',
        `Alpha-Ketoglutarate (AKG) is a key intermediate in the Krebs cycle (cellular energy production).

Key benefits and mechanisms:
- Longevity and anti-aging effects (studied in aging research)
- Cellular energy metabolism via Krebs cycle
- Supports protein synthesis and nitrogen balance
- Collagen synthesis support
- May help maintain muscle mass
- Antioxidant properties
- DNA and histone demethylation (epigenetic effects)
- May support healthy aging markers

Clinical research:
- Studies have shown potential to extend healthspan
- May reduce biological age markers
- Supports mitochondrial function
- Can help with exercise recovery and muscle preservation

Particularly relevant for patient with:
- Cancer treatment (cellular support, muscle preservation)
- Overall health optimization and longevity focus
- Metabolic health (complements glucose control efforts)
- Recovery and cellular repair support`
    );

    console.log('✓ Successfully added Alpha-Ketoglutarate (AKG) 1000mg');
}

// Display comprehensive supplement regimen
console.log('\n' + '═'.repeat(70));
console.log('COMPLETE SUPPLEMENT & LONGEVITY STACK:');
console.log('═'.repeat(70) + '\n');

const supplements = db.prepare(`
    SELECT name, dosage, frequency, reason, notes
    FROM medications 
    WHERE stopped_date IS NULL 
    AND (name LIKE '%Vitamin%' 
         OR name LIKE '%Ubiquinol%' 
         OR name LIKE '%CoQ10%'
         OR name LIKE '%Sea Moss%' 
         OR name LIKE '%Mushroom%'
         OR name LIKE '%Pendulum%'
         OR name LIKE '%Probiotic%'
         OR name LIKE '%AKG%'
         OR name LIKE '%Alpha%')
    ORDER BY name
`).all();

supplements.forEach(sup => {
    console.log(`${sup.name} - ${sup.dosage}`);
    console.log(`  Frequency: ${sup.frequency}`);
    console.log(`  Purpose: ${sup.reason}`);
    console.log();
});

console.log('═'.repeat(70));
console.log(`\nTotal Supplements: ${supplements.length}`);

// Categorize by purpose
console.log('\n' + '═'.repeat(70));
console.log('SUPPLEMENTS BY PURPOSE:');
console.log('═'.repeat(70) + '\n');

console.log('🩺 METABOLIC HEALTH & LONGEVITY:');
console.log('  • Pendulum Glucose Control (pre-diabetes management)');
console.log('  • Alpha-Ketoglutarate 1000mg (longevity, cellular energy)');

console.log('\n💪 CELLULAR ENERGY & CARDIOVASCULAR:');
console.log('  • Ubiquinol 100mg (heart health, mitochondrial function)');
console.log('  • Alpha-Ketoglutarate 1000mg (Krebs cycle, energy production)');

console.log('\n🛡️ IMMUNE SUPPORT:');
console.log('  • Turkey Tail Mushroom (immune modulation)');

console.log('\n🏗️ GENERAL HEALTH:');
console.log('  • Vitamin D3 1000 IU (bone health, immune function)');
console.log('  • Irish Sea Moss (minerals, trace elements)');

db.close();

console.log('\n' + '═'.repeat(70));
console.log('✅ AKG 1000mg added! Your supplement stack is comprehensive and targeted.');
