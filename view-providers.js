import Database from 'better-sqlite3';
const db = new Database('./data/health.db', { readonly: true });

console.log('═══════════════════════════════════════════════════════════════════\n');
console.log('           HEALTHCARE TEAM & CONSULTATION SUMMARY');
console.log('\n═══════════════════════════════════════════════════════════════════\n');

// Primary Care Team
console.log('PRIMARY CARE TEAM\n' + '─'.repeat(67));
const primaryTeam = db.prepare(`
    SELECT name, specialty, institution, phone, notes
    FROM healthcare_providers
    WHERE role = 'primary' AND active = 1
    ORDER BY specialty
`).all();

primaryTeam.forEach(p => {
    console.log(`\n${p.name} - ${p.specialty}`);
    if (p.institution) console.log(`  Institution: ${p.institution}`);
    if (p.phone) console.log(`  Phone: ${p.phone}`);
    if (p.notes) console.log(`  Notes: ${p.notes}`);
});

// Consulting Oncologists (Second/Third Opinions)
console.log('\n\n' + '═'.repeat(67));
console.log('\nSECOND OPINION CONSULTATIONS\n' + '─'.repeat(67));
const secondOpinions = db.prepare(`
    SELECT 
        hp.name, 
        hp.specialty,
        hp.institution,
        so.requested_date,
        so.reason,
        so.diagnosis_opinion,
        so.treatment_opinion,
        so.notes
    FROM healthcare_providers hp
    JOIN second_opinions so ON hp.id = so.provider_id
    ORDER BY so.requested_date DESC
`).all();

if (secondOpinions.length === 0) {
    console.log('\nNo second opinion consultations recorded yet.');
} else {
    secondOpinions.forEach(so => {
        console.log(`\n${so.name} - ${so.institution}`);
        console.log(`  Date: ${so.requested_date}`);
        console.log(`  Reason: ${so.reason}`);
        if (so.diagnosis_opinion) console.log(`  Diagnosis: ${so.diagnosis_opinion}`);
        if (so.treatment_opinion) console.log(`  Treatment Opinion: ${so.treatment_opinion}`);
        if (so.notes) console.log(`  Notes: ${so.notes}`);
    });
}

// All Specialists
console.log('\n\n' + '═'.repeat(67));
console.log('\nSPECIALIST TEAM\n' + '─'.repeat(67));
const specialists = db.prepare(`
    SELECT name, specialty, institution, notes
    FROM healthcare_providers
    WHERE role IN ('specialist', 'consulting') AND active = 1
    ORDER BY specialty, name
`).all();

const specialtyGroups = {};
specialists.forEach(s => {
    if (!specialtyGroups[s.specialty]) {
        specialtyGroups[s.specialty] = [];
    }
    specialtyGroups[s.specialty].push(s);
});

Object.keys(specialtyGroups).sort().forEach(specialty => {
    console.log(`\n${specialty}:`);
    specialtyGroups[specialty].forEach(s => {
        console.log(`  • ${s.name}${s.institution ? ' - ' + s.institution : ''}`);
        if (s.notes) console.log(`    ${s.notes}`);
    });
});

// Recent Consultations
console.log('\n\n' + '═'.repeat(67));
console.log('\nRECENT CONSULTATIONS (Last 6 Months)\n' + '─'.repeat(67));
const recentConsults = db.prepare(`
    SELECT 
        c.consultation_date,
        hp.name,
        hp.specialty,
        c.consultation_type,
        c.reason,
        c.findings,
        c.recommendations
    FROM consultations c
    JOIN healthcare_providers hp ON c.provider_id = hp.id
    WHERE c.consultation_date >= date('now', '-6 months')
    ORDER BY c.consultation_date DESC
`).all();

if (recentConsults.length === 0) {
    console.log('\nNo recent consultations recorded.');
} else {
    recentConsults.forEach(c => {
        console.log(`\n${c.consultation_date} - ${c.name} (${c.specialty})`);
        console.log(`  Type: ${c.consultation_type || 'Standard visit'}`);
        if (c.reason) console.log(`  Reason: ${c.reason}`);
        if (c.findings) console.log(`  Findings: ${c.findings}`);
        if (c.recommendations) console.log(`  Recommendations: ${c.recommendations}`);
    });
}

// Conditions by Provider
console.log('\n\n' + '═'.repeat(67));
console.log('\nCONDITIONS MANAGED BY PROVIDER\n' + '─'.repeat(67));
const conditionProviders = db.prepare(`
    SELECT 
        hp.name,
        hp.specialty,
        c.name as condition_name,
        c.status,
        cp.role,
        cp.notes
    FROM condition_providers cp
    JOIN healthcare_providers hp ON cp.provider_id = hp.id
    JOIN conditions c ON cp.condition_id = c.id
    WHERE cp.ended_date IS NULL
    ORDER BY hp.name, c.name
`).all();

const providerConditions = {};
conditionProviders.forEach(cp => {
    if (!providerConditions[cp.name]) {
        providerConditions[cp.name] = [];
    }
    providerConditions[cp.name].push(cp);
});

Object.keys(providerConditions).sort().forEach(providerName => {
    console.log(`\n${providerName}:`);
    providerConditions[providerName].forEach(cp => {
        console.log(`  • ${cp.condition_name} (${cp.status})`);
        console.log(`    Role: ${cp.role}`);
        if (cp.notes) console.log(`    ${cp.notes}`);
    });
});

console.log('\n' + '═'.repeat(67) + '\n');

db.close();
