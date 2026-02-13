import Database from 'better-sqlite3';
const db = new Database('./data/health.db');

console.log('Adding integrative and repurposed medications...\n');

const insertMed = db.prepare(`
    INSERT INTO medications (name, dosage, frequency, started_date, reason, notes)
    VALUES (?, ?, ?, ?, ?, ?)
`);

const medications = [
    {
        name: 'Angiostop',
        dosage: 'Standard dose',
        frequency: 'Daily',
        started_date: '2024-01-01',
        reason: 'Anti-angiogenesis support',
        notes: `Angiostop is a dietary supplement formulated to support healthy angiogenesis (blood vessel formation).

Contains ingredients that may help:
- Inhibit tumor angiogenesis (blood supply to tumors)
- Support vascular health
- Provide anti-inflammatory effects

Common ingredients may include:
- Green tea extract (EGCG)
- Grape seed extract
- Modified citrus pectin
- Other botanical extracts

Used as part of integrative cancer care approach to potentially limit tumor blood supply development.`
    },
    {
        name: 'Revivin',
        dosage: 'Standard dose',
        frequency: 'Daily',
        started_date: '2024-01-01',
        reason: 'Metabolic support, cellular health',
        notes: `Revivin is a supplement that may support cellular health and metabolic function.

Typically contains ingredients for:
- Mitochondrial support
- Cellular energy production
- Metabolic optimization
- Overall vitality

Used as part of comprehensive supplement regimen for metabolic and cellular health support during cancer treatment.`
    },
    {
        name: 'Ivermectin',
        dosage: 'Dosage varies',
        frequency: 'As directed',
        started_date: '2024-01-01',
        reason: 'Repurposed drug - integrative cancer protocol',
        notes: `Ivermectin is an FDA-approved antiparasitic drug being studied for potential anti-cancer properties.

Mechanism of interest in cancer:
- May inhibit tumor growth through multiple pathways
- Potential immunomodulatory effects
- May enhance chemotherapy efficacy
- Affects various cellular signaling pathways

Research status:
- Primarily in vitro and animal studies
- Some clinical case reports
- Mechanism studies ongoing
- Not FDA-approved for cancer treatment

Safety profile:
- Well-established safety profile for approved uses
- Generally well-tolerated at appropriate doses
- Should be coordinated with oncology team

Patient using as part of repurposed drug protocol under medical supervision for Stage IV bladder cancer.`
    },
    {
        name: 'Fenbendazole',
        dosage: 'Dosage varies',
        frequency: 'As directed',
        started_date: '2024-01-01',
        reason: 'Repurposed drug - integrative cancer protocol',
        notes: `Fenbendazole is a veterinary antiparasitic drug that has gained attention for potential anti-cancer properties.

Mechanism of interest in cancer:
- May disrupt microtubules (similar to some chemotherapy drugs)
- Potential to inhibit glucose uptake by cancer cells
- May induce apoptosis in cancer cells
- Possible immunomodulatory effects

Research status:
- Primarily preclinical research (cell studies, animal models)
- Anecdotal reports from cancer patients
- Some scientific publications on mechanisms
- Not FDA-approved for human use or cancer treatment

Important notes:
- Veterinary drug (not approved for humans)
- Used off-label by some cancer patients
- Safety and efficacy in humans not fully established
- Should be discussed with healthcare providers

Patient using as part of repurposed drug protocol for Stage IV bladder cancer. Use should be coordinated with oncology team.`
    },
    {
        name: 'Low Dose Naltrexone (LDN)',
        dosage: 'Low dose (typically 1.5-4.5mg)',
        frequency: 'Daily (usually at night)',
        started_date: '2023-01-01',
        reason: 'Immune modulation, pain management, anti-cancer effects',
        notes: `Low Dose Naltrexone (LDN) is naltrexone used at doses much lower than standard (which is 50mg for addiction treatment).

Mechanism at low doses:
- Temporarily blocks opioid receptors, causing rebound increase in endorphins
- May boost immune system function
- Potential anti-inflammatory effects
- May inhibit cancer cell growth through opioid growth factor receptor pathway
- Can help with pain management

Common uses in integrative oncology:
- Immune system support
- Quality of life improvement
- Pain reduction
- Potential anti-tumor effects
- Reducing treatment side effects

Research:
- Growing body of clinical research
- Used by many integrative oncologists
- Generally well-tolerated
- Low risk profile

Safety:
- Should not be used with standard-dose opioid pain medications
- Generally well-tolerated with minimal side effects
- Most common side effect: sleep disturbances (usually temporary)
- Requires compounding pharmacy for low doses

Patient using LDN as part of integrative cancer care protocol for immune support and potential anti-cancer effects.`
    },
    {
        name: 'THC (Indica) - Medical Cannabis',
        dosage: '2.5 mg',
        frequency: 'Nightly before bed',
        started_date: '2023-01-01',
        reason: 'Sleep support, pain management, anxiety relief',
        notes: `Medical cannabis (THC) used for symptom management and sleep support.

Strain type: Indica
- Known for relaxing, sedating effects
- Better for nighttime use and sleep
- May help with pain and muscle relaxation

Benefits for cancer patients:
- Improved sleep quality
- Pain relief
- Anxiety reduction
- Appetite stimulation
- Nausea control (especially from chemotherapy)
- Overall quality of life improvement

Dosing:
- 2.5mg is a low, controlled dose
- Taken at bedtime for sleep support
- Lower doses reduce psychoactive effects while maintaining therapeutic benefits

Safety considerations:
- Legal status varies by state (patient presumably in legal state)
- Low dose minimizes side effects
- Used in conjunction with melatonin for sleep support
- Should be disclosed to all healthcare providers

Patient uses nightly for sleep support, working synergistically with melatonin. Reports helps with sleep issues and early morning awakening (3 AM wake-ups related to cortisol disruption).`
    }
];

let added = 0;
let skipped = 0;

medications.forEach(med => {
    const exists = db.prepare('SELECT id FROM medications WHERE name LIKE ? AND stopped_date IS NULL').get(`%${med.name.split(' ')[0]}%`);
    
    if (exists) {
        console.log(`  ⊘ Already exists: ${med.name}`);
        skipped++;
    } else {
        insertMed.run(med.name, med.dosage, med.frequency, med.started_date, med.reason, med.notes);
        console.log(`  ✓ Added: ${med.name}`);
        added++;
    }
});

console.log(`\n${added} medications added, ${skipped} already existed.`);

// Display comprehensive treatment overview
console.log('\n' + '═'.repeat(75));
console.log('COMPLETE INTEGRATIVE CANCER TREATMENT PROTOCOL');
console.log('═'.repeat(75) + '\n');

console.log('🎯 PRIMARY CANCER TREATMENT (Conventional):');
console.log('─'.repeat(75));
const primary = db.prepare(`
    SELECT name, dosage, frequency
    FROM medications 
    WHERE stopped_date IS NULL 
    AND (name LIKE '%Keytruda%' OR name LIKE '%Padcev%')
`).all();
primary.forEach(m => console.log(`  • ${m.name} - ${m.dosage} (${m.frequency})`));

console.log('\n💉 IV INTEGRATIVE THERAPY:');
console.log('─'.repeat(75));
const iv = db.prepare(`
    SELECT name, frequency
    FROM medications 
    WHERE stopped_date IS NULL AND name LIKE '%Vitamin C%Infusion%'
`).all();
iv.forEach(m => console.log(`  • ${m.name} (${m.frequency})`));

console.log('\n💊 REPURPOSED DRUGS (Off-Label Integrative Use):');
console.log('─'.repeat(75));
const repurposed = db.prepare(`
    SELECT name, dosage, reason
    FROM medications 
    WHERE stopped_date IS NULL 
    AND (name LIKE '%Ivermectin%' 
         OR name LIKE '%Fenbendazole%' 
         OR name LIKE '%Naltrexone%')
    ORDER BY name
`).all();
repurposed.forEach(m => console.log(`  • ${m.name} - ${m.reason}`));

console.log('\n🌿 TARGETED SUPPLEMENTS (Anti-Cancer/Metabolic):');
console.log('─'.repeat(75));
const targeted = db.prepare(`
    SELECT name, dosage, reason
    FROM medications 
    WHERE stopped_date IS NULL 
    AND (name LIKE '%Angiostop%' 
         OR name LIKE '%Revivin%'
         OR name LIKE '%Pendulum%'
         OR name LIKE '%AKG%'
         OR name LIKE '%Ubiquinol%'
         OR name LIKE '%Turkey%')
    ORDER BY name
`).all();
targeted.forEach(m => console.log(`  • ${m.name} (${m.dosage})`));

console.log('\n💤 SLEEP & SYMPTOM MANAGEMENT:');
console.log('─'.repeat(75));
const sleep = db.prepare(`
    SELECT name, dosage, frequency
    FROM medications 
    WHERE stopped_date IS NULL 
    AND (name LIKE '%Melatonin%' OR name LIKE '%THC%' OR name LIKE '%Ativan%')
    ORDER BY name
`).all();
sleep.forEach(m => console.log(`  • ${m.name} - ${m.dosage} (${m.frequency})`));

console.log('\n💊 SUPPORTIVE MEDICATIONS:');
console.log('─'.repeat(75));
const supportive = db.prepare(`
    SELECT name, dosage, reason
    FROM medications 
    WHERE stopped_date IS NULL 
    AND (name IN ('Eliquis', 'Synthroid'))
    ORDER BY name
`).all();
supportive.forEach(m => console.log(`  • ${m.name} - ${m.dosage} (${m.reason})`));

console.log('\n🏗️ GENERAL HEALTH SUPPLEMENTS:');
console.log('─'.repeat(75));
const general = db.prepare(`
    SELECT name, dosage
    FROM medications 
    WHERE stopped_date IS NULL 
    AND (name LIKE '%Vitamin D%' OR name LIKE '%Sea Moss%')
    ORDER BY name
`).all();
general.forEach(m => console.log(`  • ${m.name} - ${m.dosage}`));

// Count totals
const totalMeds = db.prepare(`
    SELECT COUNT(*) as count FROM medications WHERE stopped_date IS NULL
`).get();

console.log('\n' + '═'.repeat(75));
console.log(`TOTAL MEDICATIONS/SUPPLEMENTS: ${totalMeds.count}`);
console.log('═'.repeat(75));

db.close();

console.log('\n✅ Complete integrative cancer protocol documented!');
console.log('\nThis represents a comprehensive multi-modal approach combining:');
console.log('  • Conventional chemotherapy/immunotherapy');
console.log('  • IV integrative therapy');
console.log('  • Repurposed pharmaceutical drugs');
console.log('  • Targeted supplements');
console.log('  • Medical cannabis');
console.log('  • Supportive care medications');
