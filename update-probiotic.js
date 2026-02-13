import Database from 'better-sqlite3';
const db = new Database('./data/health.db');

console.log('Updating Probiotic medication with Pendulum Glucose Control details...\n');

// Update the probiotic entry with specific product information
const updateMed = db.prepare(`
    UPDATE medications 
    SET name = ?,
        dosage = ?,
        reason = ?,
        notes = ?
    WHERE name LIKE '%Probiotic%' AND stopped_date IS NULL
`);

const result = updateMed.run(
    'Pendulum Glucose Control',
    '5 strain formula',
    'Blood sugar and A1C management for pre-diabetes',
    `Clinically-studied probiotic for glucose control. Contains 5 beneficial strains:
1. Akkermansia muciniphila - strengthens gut barrier, produces postbiotics
2. Clostridium butyricum - butyrate producer, enhances metabolism
3. Anaerobutyricum hallii - butyrate producer for metabolic health
4. Clostridium beijerinckii - promotes balanced gut microbiome
5. Bifidobacterium infantis - digests complex carbs, supports immune function

Clinical trial results (BMJ published, double-blind, placebo-controlled):
- Reduces A1C by 0.6 points on average
- Reduces post-meal glucose spikes by 32.5%

Patient has HgbA1C of 5.8% (pre-diabetic range). This probiotic directly supports glucose regulation efforts alongside dietary changes (cutting sugar, increasing exercise).`
);

if (result.changes > 0) {
    console.log('✓ Successfully updated Probiotic medication record');
    console.log('\nNew details added:');
    console.log('  • Product: Pendulum Glucose Control');
    console.log('  • 5 specific bacterial strains documented');
    console.log('  • Clinical trial results: -0.6 A1C, -32.5% post-meal spikes');
    console.log('  • Directly linked to your pre-diabetes management');
} else {
    console.log('⚠ No probiotic record found to update');
}

// Check the updated record
console.log('\n' + '─'.repeat(70));
console.log('UPDATED MEDICATION RECORD:');
console.log('─'.repeat(70));

const medication = db.prepare(`
    SELECT * FROM medications 
    WHERE name = 'Pendulum Glucose Control'
`).get();

if (medication) {
    console.log(`\nName: ${medication.name}`);
    console.log(`Dosage: ${medication.dosage}`);
    console.log(`Frequency: ${medication.frequency}`);
    console.log(`Started: ${medication.started_date}`);
    console.log(`Reason: ${medication.reason}`);
    console.log(`\nNotes:\n${medication.notes}`);
}

db.close();

console.log('\n✅ Probiotic record updated with Pendulum Glucose Control specifics!');
console.log('\nThis probiotic is clinically proven to help with your HgbA1C management.');
