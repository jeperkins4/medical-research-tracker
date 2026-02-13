import Database from 'better-sqlite3';
const db = new Database('./data/health.db');

console.log('Importing Dr. Do oncology note data from 1/23/2026...\n');

// 1. Update patient profile with new weight and primary physician
console.log('1. Updating patient profile...');
const updateProfile = db.prepare(`
    UPDATE patient_profile 
    SET weight_lbs = ?,
        primary_physician = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
`);
updateProfile.run(209.8, 'Dr. Tien Phuc Do MD - Florida Cancer Specialists');
console.log('   ✓ Updated weight to 209.8 lbs');
console.log('   ✓ Updated primary physician');

// 2. Check and update/insert conditions
console.log('\n2. Managing conditions...');

// Stage IV Bladder Cancer
const checkCondition = db.prepare('SELECT id, status FROM conditions WHERE name = ?');
const insertCondition = db.prepare(`
    INSERT INTO conditions (name, diagnosed_date, status, notes)
    VALUES (?, ?, ?, ?)
`);
const updateCondition = db.prepare(`
    UPDATE conditions 
    SET status = ?, notes = ?, diagnosed_date = ?
    WHERE id = ?
`);

const conditions = [
    {
        name: 'Stage IV Bladder Cancer',
        diagnosed_date: '2023-12-01',
        status: 'active - stable',
        notes: 'High-grade stage IIIB at cystectomy 5/3/2022. Progressed to Stage IV 12/2023 with bony metastases. Current treatment: Keytruda + Padcev (started 6/2025). Recent PET/CT 12/10/2025 shows stable disease. Next scan 3/2026.'
    },
    {
        name: 'Pre-diabetes',
        diagnosed_date: '2026-01-23',
        status: 'active - improving',
        notes: 'HgbA1C 5.8% (down from 5.9). Patient making lifestyle changes: cutting sugar, increasing exercise.'
    },
    {
        name: 'Peripheral Neuropathy',
        diagnosed_date: '2024-04-01',
        status: 'active - stable',
        notes: 'Secondary to Padcev chemotherapy. Primarily affects fingertips. Patient manages with hand activities (guitar playing). Declines medication.'
    },
    {
        name: 'Profound Hypothyroidism',
        diagnosed_date: '2022-01-01',
        status: 'active - managed',
        notes: 'Stable on Synthroid 200 mcg daily. TSH 0.43 (1/23/2026). Early morning awakening at 3 AM when missing doses due to cortisol disruption.'
    },
    {
        name: 'History of DVT',
        diagnosed_date: '2023-04-01',
        status: 'resolved - on prophylaxis',
        notes: 'Right upper extremity DVT associated with port (April 2023). Dr. Umana performed intervention. Remains on Eliquis indefinitely.'
    },
    {
        name: 'Autoimmune Colitis',
        diagnosed_date: '2023-09-01',
        status: 'resolved',
        notes: 'Occurred several months after stopping Opdivo (9/2023). Required prolonged steroids. Followed by Dr. Muniyappa for GI issues.'
    },
    {
        name: 'Ocular Toxicity',
        diagnosed_date: '2024-04-01',
        status: 'active - monitored',
        notes: 'Eye dryness from cancer treatment. Follows with Dr. Bell every 6 months for corneal monitoring. Uses tear drops and oily nighttime drops.'
    }
];

conditions.forEach(condition => {
    const existing = checkCondition.get(condition.name);
    if (existing) {
        updateCondition.run(condition.status, condition.notes, condition.diagnosed_date, existing.id);
        console.log(`   ✓ Updated: ${condition.name}`);
    } else {
        insertCondition.run(condition.name, condition.diagnosed_date, condition.status, condition.notes);
        console.log(`   ✓ Added: ${condition.name}`);
    }
});

// 3. Add vitals from 1/23/2026 visit
console.log('\n3. Adding vitals from 1/23/2026 visit...');
const insertVitals = db.prepare(`
    INSERT INTO vitals (
        date, time, systolic, diastolic, heart_rate, temperature_f,
        respiratory_rate, oxygen_saturation, weight_lbs, height_inches,
        pain_level, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

insertVitals.run(
    '2026-01-23',
    '08:54:00',
    116,  // systolic
    81,   // diastolic
    65,   // heart_rate
    97.7, // temperature
    18,   // respiratory_rate
    97,   // oxygen_saturation
    209.8, // weight
    73,    // height
    0,     // pain_level (0-1 per note)
    'Dr. Do oncology visit. Patient doing well. ECOG 0 (fully active). Hip achiness noted in mornings.'
);
console.log('   ✓ Added vitals: BP 116/81, HR 65, Temp 97.7°F, O2 Sat 97%, Weight 209.8 lbs');

// 4. Add lab test results from 1/23/2026
console.log('\n4. Adding lab results from 1/23/2026...');
const insertTest = db.prepare(`
    INSERT INTO test_results (test_name, result, date, provider, notes)
    VALUES (?, ?, ?, ?, ?)
`);

const labs = [
    {
        test_name: 'Hemoglobin A1C',
        result: '5.8%',
        notes: 'Pre-diabetic range (normal <5.7%). Down from previous 5.9%. Patient making lifestyle changes to improve.'
    },
    {
        test_name: 'TSH (Thyroid Stimulating Hormone)',
        result: '0.43',
        notes: 'LOW - indicates hyperthyroidism or over-treatment. Patient on Synthroid 200 mcg daily. Reports cortisol disruption and early morning awakening when missing doses.'
    },
    {
        test_name: 'Hemoglobin',
        result: '13.8 g/dL',
        notes: 'Increased 0.2 from prior. Patient trying beef liver tablets to increase RBC count.'
    },
    {
        test_name: 'WBC (White Blood Cell Count)',
        result: '5.5 K/uL',
        notes: 'Normal range'
    },
    {
        test_name: 'ANC (Absolute Neutrophil Count)',
        result: '3.11 K/uL',
        notes: 'Normal range'
    },
    {
        test_name: 'Hematocrit',
        result: '43.3%',
        notes: 'Normal range'
    },
    {
        test_name: 'MCV (Mean Corpuscular Volume)',
        result: '87.3 fL',
        notes: 'Normal range'
    },
    {
        test_name: 'Platelet Count',
        result: '208 K/uL',
        notes: 'Normal range'
    },
    {
        test_name: 'Magnesium',
        result: '1.7 mg/dL',
        notes: 'Normal range'
    },
    {
        test_name: 'Creatinine',
        result: '0.9 mg/dL',
        notes: 'Normal kidney function'
    },
    {
        test_name: 'Potassium',
        result: '4.4 mEq/L',
        notes: 'Normal range'
    }
];

labs.forEach(lab => {
    insertTest.run(
        lab.test_name,
        lab.result,
        '2026-01-23',
        'Florida Cancer Specialists - Dr. Tien Phuc Do MD',
        lab.notes
    );
    console.log(`   ✓ Added: ${lab.test_name} = ${lab.result}`);
});

// 5. Add medications from the note
console.log('\n5. Adding/updating medications...');
const checkMed = db.prepare('SELECT id FROM medications WHERE name = ? AND stopped_date IS NULL');
const insertMed = db.prepare(`
    INSERT INTO medications (name, dosage, frequency, started_date, reason, notes)
    VALUES (?, ?, ?, ?, ?, ?)
`);

const medications = [
    { name: 'Keytruda', dosage: 'Standard dose', frequency: 'Day 1, 8 schedule', started_date: '2025-06-20', reason: 'Stage IV bladder cancer', notes: 'Immunotherapy. Monitoring for colitis recurrence.' },
    { name: 'Padcev', dosage: '50 mg', frequency: 'Day 1, 8 schedule', started_date: '2024-04-01', reason: 'Stage IV bladder cancer', notes: 'Personalized dose. On/off since April 2024. Causes peripheral neuropathy.' },
    { name: 'Ativan', dosage: '0.5 mg', frequency: 'PRN', started_date: '2022-05-03', reason: 'Anxiety', notes: '' },
    { name: 'Synthroid', dosage: '200 mcg', frequency: 'Daily', started_date: '2022-01-01', reason: 'Profound hypothyroidism', notes: 'TSH 0.43. Missing doses causes early morning awakening at 3 AM.' },
    { name: 'Eliquis', dosage: '5 mg', frequency: 'Twice daily', started_date: '2023-04-01', reason: 'History of DVT', notes: 'Indefinite duration for DVT prophylaxis' },
    { name: 'Melatonin', dosage: 'Powder form', frequency: 'Nightly', started_date: '2023-01-01', reason: 'Sleep issues', notes: 'Used with medical marijuana' },
    { name: 'Vitamin D3', dosage: '1000 IU (25 mcg)', frequency: 'Daily', started_date: '2022-01-01', reason: 'Supplementation', notes: '' },
    { name: 'Probiotic blend', dosage: '50 billion', frequency: 'Daily', started_date: '2023-09-01', reason: 'GI health post-colitis', notes: '' },
    { name: 'Irish Sea Moss', dosage: 'Supplement', frequency: 'Daily', started_date: '2024-01-01', reason: 'General health', notes: 'Patient preference' },
    { name: 'Turkey Tail Mushroom Powder', dosage: 'Supplement', frequency: 'Daily', started_date: '2024-01-01', reason: 'Immune support', notes: 'Patient preference' }
];

medications.forEach(med => {
    const existing = checkMed.get(med.name);
    if (!existing) {
        insertMed.run(med.name, med.dosage, med.frequency, med.started_date, med.reason, med.notes);
        console.log(`   ✓ Added: ${med.name} ${med.dosage}`);
    } else {
        console.log(`   - Already exists: ${med.name}`);
    }
});

db.close();

console.log('\n✅ Import complete! Dr. Do\'s oncology note from 1/23/2026 has been imported.');
console.log('\nSummary:');
console.log('- Patient profile updated with new weight (209.8 lbs)');
console.log('- 7 conditions tracked (including Stage IV bladder cancer - stable)');
console.log('- Vitals recorded from office visit');
console.log('- 11 lab results imported');
console.log('- 10 medications documented');
