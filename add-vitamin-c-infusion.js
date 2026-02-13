import Database from 'better-sqlite3';
const db = new Database('./data/health.db');

console.log('Adding Vitamin C IV Infusions to medication list...\n');

// Check if it already exists
const checkMed = db.prepare('SELECT id FROM medications WHERE name LIKE ? AND stopped_date IS NULL').get('%Vitamin C%infusion%');

if (checkMed) {
    console.log('⚠ Vitamin C infusion already exists in medication list');
} else {
    const insertMed = db.prepare(`
        INSERT INTO medications (name, dosage, frequency, started_date, reason, notes)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertMed.run(
        'Vitamin C IV Infusion (High-Dose)',
        'High-dose IV (dosage varies)',
        'Every other week (bi-weekly)',
        '2024-01-01',  // Approximate start date, can be updated
        'Integrative cancer therapy, immune support, antioxidant',
        `High-dose intravenous Vitamin C is an integrative therapy used alongside conventional cancer treatment.

Mechanism of action:
- At high doses (IV only), Vitamin C can act as a pro-oxidant in cancer cells
- Generates hydrogen peroxide which may be selectively toxic to cancer cells
- Acts as antioxidant in normal cells
- Supports immune system function
- May enhance effects of conventional chemotherapy
- Helps reduce oxidative stress from cancer treatment

Benefits for cancer patients:
- May improve quality of life
- Can help reduce chemotherapy side effects
- Supports overall immune function
- Provides antioxidant support during treatment
- Some evidence for tumor growth inhibition

Clinical use:
- Requires IV administration (oral Vitamin C cannot achieve therapeutic blood levels)
- Typically dosed at 25-100 grams per infusion
- Usually administered 1-3 times per week, or bi-weekly
- Must be given by qualified healthcare provider
- Requires monitoring of kidney function and G6PD status

Safety considerations:
- Generally well-tolerated
- Contraindicated in patients with G6PD deficiency
- Requires adequate kidney function
- Should be coordinated with oncology team

Patient receiving bi-weekly infusions as complementary therapy to Keytruda/Padcev regimen for Stage IV bladder cancer.`
    );

    console.log('✓ Successfully added Vitamin C IV Infusion');
}

// Display complete treatment regimen
console.log('\n' + '═'.repeat(70));
console.log('COMPLETE CANCER TREATMENT REGIMEN:');
console.log('═'.repeat(70) + '\n');

console.log('🎯 PRIMARY CANCER TREATMENT:');
const cancerMeds = db.prepare(`
    SELECT name, dosage, frequency
    FROM medications 
    WHERE stopped_date IS NULL 
    AND (name LIKE '%Keytruda%' OR name LIKE '%Padcev%')
    ORDER BY name
`).all();

cancerMeds.forEach(med => {
    console.log(`  • ${med.name} - ${med.dosage}`);
    console.log(`    Frequency: ${med.frequency}`);
});

console.log('\n💉 INTEGRATIVE THERAPY:');
const integrative = db.prepare(`
    SELECT name, dosage, frequency
    FROM medications 
    WHERE stopped_date IS NULL 
    AND name LIKE '%Vitamin C%Infusion%'
`).all();

integrative.forEach(med => {
    console.log(`  • ${med.name}`);
    console.log(`    Frequency: ${med.frequency}`);
});

console.log('\n💊 SUPPORTIVE MEDICATIONS:');
const supportive = db.prepare(`
    SELECT name, dosage, frequency, reason
    FROM medications 
    WHERE stopped_date IS NULL 
    AND name IN ('Eliquis', 'Synthroid', 'Ativan', 'Melatonin')
    ORDER BY name
`).all();

supportive.forEach(med => {
    console.log(`  • ${med.name} - ${med.dosage} (${med.reason})`);
});

console.log('\n🌿 SUPPLEMENT STACK:');
const supplements = db.prepare(`
    SELECT name, dosage
    FROM medications 
    WHERE stopped_date IS NULL 
    AND (name LIKE '%Pendulum%' 
         OR name LIKE '%AKG%'
         OR name LIKE '%Ubiquinol%' 
         OR name LIKE '%Turkey%'
         OR name LIKE '%Sea Moss%'
         OR name LIKE '%Vitamin D%')
    ORDER BY name
`).all();

supplements.forEach(sup => {
    console.log(`  • ${sup.name} - ${sup.dosage}`);
});

db.close();

console.log('\n' + '═'.repeat(70));
console.log('✅ Vitamin C IV infusions added to your treatment protocol!');
console.log('\nYour complete integrative cancer care approach is now documented.');
