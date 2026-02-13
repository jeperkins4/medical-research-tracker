// Import lab results from 01/30/2026
const API_BASE = 'http://localhost:3000/api';

const labDate = '2026-01-30';
const provider = 'Dr. Tien Phuc Do MD - Florida Cancer Specialists';

// CBC PLT AUTODIFF results
const cbcResults = [
  { test_name: 'WBC', result: '5.0 x10^3/UL (Normal: 4.2-10.0)', date: labDate, provider },
  { test_name: 'RBC', result: '5.06 x10^6/UL (Normal: 4.30-6.30)', date: labDate, provider },
  { test_name: 'Hemoglobin (Hgb)', result: '14.0 g/dL (Normal: 14.0-18.0)', date: labDate, provider },
  { test_name: 'Hematocrit (HCT)', result: '44.3% (Normal: 41.0-51.0)', date: labDate, provider },
  { test_name: 'MCV', result: '87.5 fL (Normal: 80.0-95.0)', date: labDate, provider },
  { test_name: 'MCH', result: '27.7 PG (Normal: 27.0-34.0)', date: labDate, provider },
  { test_name: 'MCHC', result: '31.6 g/dL (LOW - Normal: 32.0-35.9)', date: labDate, provider, notes: 'Below normal range' },
  { test_name: 'RDW', result: '12.4% (Normal: 11.5-15.0)', date: labDate, provider },
  { test_name: 'Platelets (Plat)', result: '212 x10^3/UL (Normal: 140-440)', date: labDate, provider },
  { test_name: 'MPV', result: '10.4 fL (Normal: 7.5-11.5)', date: labDate, provider },
  { test_name: 'Granulocytes %', result: '50.5% (Normal: 39.0-78.0)', date: labDate, provider },
  { test_name: 'Lymphocytes %', result: '28.9% (Normal: 15.0-40.0)', date: labDate, provider },
  { test_name: 'Monocytes %', result: '10.0% (Normal: <=10.0)', date: labDate, provider },
  { test_name: 'Eosinophils %', result: '8.6% (HIGH - Normal: <=6.0)', date: labDate, provider, notes: 'Above normal range - possible allergic response or parasitic infection' },
  { test_name: 'Basophils %', result: '1.0% (Normal: <=2.0)', date: labDate, provider },
  { test_name: 'Immature Granulocytes %', result: '1.0% (HIGH - Normal: <=0.5)', date: labDate, provider, notes: 'Above normal range - indicates active immune response' },
  { test_name: 'ANC', result: '2.53 x10^3/UL (Normal: 1.50-6.50)', date: labDate, provider },
  { test_name: 'Granulocytes #', result: '2.54 x10^3/UL (Normal: 1.50-6.50)', date: labDate, provider },
  { test_name: 'Lymphocytes #', result: '1.45 x10^3/UL (Normal: 1.20-3.40)', date: labDate, provider },
  { test_name: 'Monocytes #', result: '0.50 x10^3/UL (Normal: <=0.90)', date: labDate, provider },
  { test_name: 'Eosinophils #', result: '0.43 x10^3/UL (Normal: <=0.60)', date: labDate, provider },
  { test_name: 'Basophils #', result: '0.05 x10^3/UL (Normal: <=0.20)', date: labDate, provider },
  { test_name: 'Immature Granulocytes #', result: '0.05 x10^3/UL (Normal: <=0.30)', date: labDate, provider }
];

// CMP results
const cmpResults = [
  { test_name: 'BUN/Creatinine Ratio', result: '18 (Normal: 10-20)', date: labDate, provider },
  { test_name: 'BUN', result: '16 mg/dL (Normal: 6-23)', date: labDate, provider },
  { test_name: 'Creatinine', result: '0.9 mg/dL (Normal: 0.3-1.2)', date: labDate, provider },
  { test_name: 'Sodium', result: '140 mEq/L (Normal: 133-145)', date: labDate, provider },
  { test_name: 'Potassium', result: '4.2 mEq/L (Normal: 3.3-5.1)', date: labDate, provider },
  { test_name: 'Chloride', result: '103 mEq/L (Normal: 98-108)', date: labDate, provider },
  { test_name: 'CO2', result: '26 mEq/L (Normal: 22-33)', date: labDate, provider },
  { test_name: 'Calcium', result: '9.5 mg/dL (Normal: 8.4-10.6)', date: labDate, provider },
  { test_name: 'Albumin', result: '4.5 g/dL (Normal: 3.2-5.2)', date: labDate, provider },
  { test_name: 'AST', result: '15 U/L (Normal: 0-40)', date: labDate, provider },
  { test_name: 'ALT', result: '21 U/L (Normal: 0-40)', date: labDate, provider },
  { test_name: 'Alkaline Phosphatase', result: '165 U/L (HIGH - Normal: 39-147)', date: labDate, provider, notes: 'Above normal range - possible bone/liver activity' },
  { test_name: 'Total Bilirubin', result: '0.60 mg/dL (Normal: 0.00-1.00)', date: labDate, provider },
  { test_name: 'Glucose', result: '108 mg/dL (HIGH - Normal: 70-105)', date: labDate, provider, notes: 'Above normal range - fasting glucose elevated' },
  { test_name: 'A/G Ratio', result: '1.6 (Normal: 1.1-2.5)', date: labDate, provider },
  { test_name: 'Total Protein', result: '7.3 g/dL (Normal: 5.9-8.4)', date: labDate, provider },
  { test_name: 'GFR', result: '99.62 mL/min (Normal: 60.00-200.00)', date: labDate, provider },
  { test_name: 'Globulin', result: '2.8 g/dL (Normal: 2.0-3.5)', date: labDate, provider }
];

const allResults = [...cbcResults, ...cmpResults];

async function importLabs() {
  console.log(`Importing ${allResults.length} lab results...`);
  
  for (const lab of allResults) {
    try {
      const response = await fetch(`${API_BASE}/tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lab)
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✓ Added: ${lab.test_name} (ID: ${data.id})`);
      } else {
        console.error(`✗ Failed: ${lab.test_name}`, await response.text());
      }
    } catch (err) {
      console.error(`✗ Error adding ${lab.test_name}:`, err.message);
    }
  }
  
  console.log('\n✅ Import complete!');
}

importLabs();
