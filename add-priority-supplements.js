import Database from 'better-sqlite3-multiple-ciphers';
import dotenv from 'dotenv';

dotenv.config();

const db = new Database('data/health-secure.db');
db.pragma(`key='${process.env.DB_ENCRYPTION_KEY}'`);
db.pragma('cipher_compatibility = 4');

console.log('Adding 3 high-priority supplements to medications table...\n');

const supplements = [
  {
    name: 'Curcumin',
    dosage: '1000-2000mg with BioPerine',
    frequency: 'Daily with meals',
    notes: `Targeting ARID1A mutation → HIF-1α pathway → cancer stem cells.

DOSING PROTOCOL:
- Week 1: Start 1000mg daily with meals
- Week 2+: Increase to 2000mg if well-tolerated

MECHANISM:
Inhibits HIF-1α by degrading ARNT, directly counteracting ARID1A loss. Suppresses bladder cancer stem cells via Sonic Hedgehog pathway.

EVIDENCE:
- Nature 2017: ARID1A mutations drive bladder cancer stem cells
- PubMed 2017: Curcumin inhibits bladder cancer stem cells
- ScienceDirect 2021: Curcumin inhibits HIF-1 in cancer stem cells
- PubMed 2015: Curcumin inhibits mTOR/HIF-1α signaling

PRODUCT: Look for "Curcumin 95% Curcuminoids with BioPerine (Black Pepper Extract)" for 20x better absorption.

PRECAUTIONS: Mild blood-thinner effect (monitor with Eliquis). Take with fat-containing meals for optimal absorption.`,
    started_date: new Date().toISOString().split('T')[0]
  },
  {
    name: 'Green Tea Extract (EGCG)',
    dosage: '400-800mg (45-60% EGCG)',
    frequency: 'Daily between meals',
    notes: `Targeting PIK3CA mutation → PI3K/AKT/mTOR pathway → tumor proliferation.

DOSING PROTOCOL:
- Week 1: Start 400mg daily between meals
- Week 2+: Increase to 800mg if well-tolerated

MECHANISM:
Dual PI3K/mTOR inhibitor (Ki ~300nM). Directly counteracts PIK3CA mutation that drives constitutive PI3K/AKT/mTOR activation. Promotes apoptosis in bladder cancer cells via Bcl-2 modulation.

EVIDENCE:
- ScienceDirect 2011: EGCG is genuine PI3K/mTOR inhibitor
- Oncotarget 2018: EGCG inhibits bladder cancer T24/5637 cells via PI3K/AKT
- PubMed 2007: EGCG promotes apoptosis in T24 bladder cancer cells
- PMC 2018: EGCG inhibits bladder cancer proliferation and migration

PRODUCT: Look for "Green Tea Extract standardized to 45-60% EGCG". Choose decaffeinated formula if caffeine-sensitive.

PRECAUTIONS: Contains caffeine unless decaf. Take 2+ hours apart from iron supplements (EGCG binds iron). Monitor liver function at high doses.`,
    started_date: new Date().toISOString().split('T')[0]
  },
  {
    name: 'Berberine',
    dosage: '500mg 2-3x daily',
    frequency: 'With meals (morning, noon, evening)',
    notes: `Reversing multi-drug resistance (MDR) → enhancing Padcev effectiveness.

DOSING PROTOCOL:
- Week 1: Start 500mg 2x daily (morning, evening) with meals
- Week 2+: Increase to 500mg 3x daily (morning, noon, evening) if well-tolerated

MECHANISM:
Inhibits P-glycoprotein (MDR1/ABCB1) expression and efflux activity. Your PIK3CA mutation → PI3K/AKT activation → P-gp upregulation → chemotherapy drugs pumped out of cells. Berberine blocks this, keeping Padcev INSIDE cancer cells.

BONUS: Glucose control (synergy with Pendulum). May lower HbA1c further.

EVIDENCE:
- PMC 2023: Berberine inhibits P-gp to reverse tumor MDR
- ACS Omega 2021: Berberine reverses breast cancer multidrug resistance
- PMC 2017: Berberine enhances chemosensitivity via P-gp inhibition
- Spandidos 2023: Mechanism of MDR reversal by natural compounds

PRODUCT: Look for "Berberine 500mg" (pure berberine HCl).

PRECAUTIONS: May enhance glucose-lowering (monitor blood sugar with Pendulum). Can cause GI upset (diarrhea, cramping) - start low dose with meals. Monitor liver function.`,
    started_date: new Date().toISOString().split('T')[0]
  }
];

try {
  const stmt = db.prepare(`
    INSERT INTO medications (name, dosage, frequency, notes, started_date)
    VALUES (?, ?, ?, ?, ?)
  `);

  supplements.forEach(supp => {
    const result = stmt.run(
      supp.name,
      supp.dosage,
      supp.frequency,
      supp.notes,
      supp.started_date
    );
    console.log(`✅ Added: ${supp.name} (ID: ${result.lastInsertRowid})`);
  });

  console.log('\n✨ SUCCESS! All 3 high-priority supplements added to database.\n');
  console.log('📱 Refresh the Medical Research Tracker app to see them.');
  console.log('📚 Click "Evidence" button next to each supplement to view research.\n');

  // Verify
  const allMeds = db.prepare('SELECT name FROM medications WHERE stopped_date IS NULL ORDER BY name').all();
  console.log(`Total active medications: ${allMeds.length}`);
  console.log('Active supplements/medications:');
  allMeds.forEach(m => console.log(`  - ${m.name}`));

} catch (error) {
  console.error('❌ Error adding supplements:', error.message);
} finally {
  db.close();
}
