import Database from 'better-sqlite3';
const db = new Database('./data/health.db');

console.log('Adding Methylene Blue to medication list...\n');

const checkMed = db.prepare('SELECT id FROM medications WHERE name LIKE ? AND stopped_date IS NULL').get('%Methylene%');

if (checkMed) {
    console.log('⚠ Methylene Blue already exists in medication list');
} else {
    const insertMed = db.prepare(`
        INSERT INTO medications (name, dosage, frequency, started_date, reason, notes)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertMed.run(
        'Methylene Blue',
        'Dosage varies (typically 0.5-4 mg/kg)',
        'Daily',
        '2023-01-01',
        'Mitochondrial support, cognitive enhancement, potential anti-cancer effects',
        `Methylene Blue (MB) is a synthetic compound with diverse biological activities, used therapeutically for over a century.

Primary mechanisms of action:
- Mitochondrial electron transfer enhancer (improves cellular energy production)
- Potent antioxidant at low doses
- Enhances oxygen delivery to tissues
- Neuroprotective effects
- Antimicrobial properties

Benefits for cancer patients:
- Mitochondrial function support (complementary to Ubiquinol and AKG)
- May enhance cellular energy production during treatment
- Potential direct anti-cancer effects through multiple pathways:
  * Inhibition of monoamine oxidase
  * Interference with autophagy in cancer cells
  * Potential to sensitize cancer cells to treatment
  * Inhibition of certain cancer cell signaling pathways
- Cognitive enhancement (may help with "chemo brain")
- Neuroprotection during chemotherapy

Clinical research:
- FDA-approved for methemoglobinemia treatment
- Studied for cognitive decline and neuroprotection
- Emerging research on anti-cancer properties
- Used in integrative oncology protocols
- Studies on mitochondrial dysfunction

Dosing considerations:
- Low doses (0.5-2 mg/kg) act as antioxidant and mitochondrial enhancer
- Therapeutic window important (very high doses can be pro-oxidant)
- Typically taken orally in capsule form
- Can also be given IV in clinical settings

Safety and interactions:
- Generally well-tolerated at appropriate doses
- Contraindicated with serotonergic drugs (SSRIs) - risk of serotonin syndrome
- Can cause blue/green discoloration of urine (harmless)
- Should not be used by people with G6PD deficiency
- Monitor for interactions with MAOIs

Synergistic effects:
- Works synergistically with other mitochondrial supporters (Ubiquinol, AKG)
- May enhance effects of metabolic therapies
- Complements glucose-lowering strategies (Pendulum)

Patient using Methylene Blue as part of comprehensive metabolic and mitochondrial support protocol alongside cancer treatment. Fits within multi-modal approach targeting cellular energy, oxidative stress, and potential direct anti-cancer mechanisms.`
    );

    console.log('✓ Successfully added Methylene Blue');
}

// Display mitochondrial/metabolic support stack
console.log('\n' + '═'.repeat(70));
console.log('MITOCHONDRIAL & METABOLIC SUPPORT STACK:');
console.log('═'.repeat(70) + '\n');

const mitoSupport = db.prepare(`
    SELECT name, dosage, reason
    FROM medications 
    WHERE stopped_date IS NULL 
    AND (name LIKE '%Methylene%'
         OR name LIKE '%Ubiquinol%'
         OR name LIKE '%AKG%'
         OR name LIKE '%Pendulum%'
         OR name LIKE '%Revivin%')
    ORDER BY name
`).all();

mitoSupport.forEach(med => {
    console.log(`${med.name} - ${med.dosage}`);
    console.log(`  Purpose: ${med.reason}`);
    console.log();
});

console.log('═'.repeat(70));
console.log('\nThese compounds work synergistically to support:');
console.log('  • Mitochondrial function and cellular energy (ATP production)');
console.log('  • Metabolic health and glucose regulation');
console.log('  • Oxidative stress management');
console.log('  • Cellular repair and longevity pathways');

// Update total count
const totalMeds = db.prepare(`
    SELECT COUNT(*) as count FROM medications WHERE stopped_date IS NULL
`).get();

console.log('\n' + '═'.repeat(70));
console.log(`TOTAL ACTIVE MEDICATIONS/SUPPLEMENTS: ${totalMeds.count}`);
console.log('═'.repeat(70));

db.close();

console.log('\n✅ Methylene Blue added to your integrative protocol!');
console.log('\nYour mitochondrial support stack is now very comprehensive, targeting');
console.log('cellular energy production through multiple complementary pathways.');
