// Import lab results from 01/23/2026
const API_BASE = 'http://localhost:3000/api';

const labDate = '2026-01-23';
const provider = 'Dr. Tien Phuc Do MD - Florida Cancer Specialists';

// CBC PLT AUTODIFF results
const cbcResults = [
  { test_name: 'WBC', result: '5.5 x10^3/UL (Normal: 4.2-10.0)', date: labDate, provider },
  { test_name: 'RBC', result: '4.96 x10^6/UL (Normal: 4.30-6.30)', date: labDate, provider },
  { test_name: 'Hemoglobin (Hgb)', result: '13.8 g/dL (LOW - Normal: 14.0-18.0)', date: labDate, provider, notes: 'Below normal range' },
  { test_name: 'Hematocrit (HCT)', result: '43.3% (Normal: 41.0-51.0)', date: labDate, provider },
  { test_name: 'MCV', result: '87.3 fL (Normal: 80.0-95.0)', date: labDate, provider },
  { test_name: 'MCH', result: '27.8 PG (Normal: 27.0-34.0)', date: labDate, provider },
  { test_name: 'MCHC', result: '31.9 g/dL (LOW - Normal: 32.0-35.9)', date: labDate, provider, notes: 'Below normal range' },
  { test_name: 'RDW', result: '12.6% (Normal: 11.5-15.0)', date: labDate, provider },
  { test_name: 'Platelets (Plat)', result: '208 x10^3/UL (Normal: 140-440)', date: labDate, provider },
  { test_name: 'MPV', result: '10.4 fL (Normal: 7.5-11.5)', date: labDate, provider },
  { test_name: 'Granulocytes %', result: '56.5% (Normal: 39.0-78.0)', date: labDate, provider },
  { test_name: 'Lymphocytes %', result: '25.1% (Normal: 15.0-40.0)', date: labDate, provider },
  { test_name: 'Monocytes %', result: '10.3% (HIGH - Normal: <=10.0)', date: labDate, provider, notes: 'Above normal range' },
  { test_name: 'Eosinophils %', result: '6.1% (HIGH - Normal: <=6.0)', date: labDate, provider, notes: 'Above normal range - possible allergic response or parasitic infection' },
  { test_name: 'Basophils %', result: '1.1% (Normal: <=2.0)', date: labDate, provider },
  { test_name: 'Immature Granulocytes %', result: '0.9% (HIGH - Normal: <=0.5)', date: labDate, provider, notes: 'Above normal range - indicates active immune response' },
  { test_name: 'ANC', result: '3.11 x10^3/UL (Normal: 1.50-6.50)', date: labDate, provider },
  { test_name: 'Granulocytes #', result: '3.13 x10^3/UL (Normal: 1.50-6.50)', date: labDate, provider },
  { test_name: 'Lymphocytes #', result: '1.39 x10^3/UL (Normal: 1.20-3.40)', date: labDate, provider },
  { test_name: 'Monocytes #', result: '0.57 x10^3/UL (Normal: <=0.90)', date: labDate, provider },
  { test_name: 'Eosinophils #', result: '0.34 x10^3/UL (Normal: <=0.60)', date: labDate, provider },
  { test_name: 'Basophils #', result: '0.06 x10^3/UL (Normal: <=0.20)', date: labDate, provider },
  { test_name: 'Immature Granulocytes #', result: '0.05 x10^3/UL (Normal: <=0.30)', date: labDate, provider }
];

// POC Glucose
const glucoseResults = [
  { test_name: 'Glucose', result: '110 mg/L (HIGH - Normal: 70-105)', date: labDate, provider, notes: 'Above normal range - fasting glucose elevated' }
];

const allResults = [...cbcResults, ...glucoseResults];

async function importLabs() {
  console.log(`Importing ${allResults.length} lab results from ${labDate}...`);
  
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
