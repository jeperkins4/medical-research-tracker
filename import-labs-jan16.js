// Import lab results from 01/16/2026
const API_BASE = 'http://localhost:3000/api';

const labDate = '2026-01-16';
const provider = 'Dr. Tien Phuc Do MD - Florida Cancer Specialists';

// CBC PLT AUTODIFF results
const cbcResults = [
  { test_name: 'WBC', result: '4.8 x10^3/UL (Normal: 4.2-10.0)', date: labDate, provider },
  { test_name: 'RBC', result: '4.76 x10^6/UL (Normal: 4.30-6.30)', date: labDate, provider },
  { test_name: 'Hemoglobin (Hgb)', result: '13.2 g/dL (LOW - Normal: 14.0-18.0)', date: labDate, provider, notes: 'Below normal range - continuing trend of low hemoglobin' },
  { test_name: 'Hematocrit (HCT)', result: '42.0% (Normal: 41.0-51.0)', date: labDate, provider },
  { test_name: 'MCV', result: '88.2 fL (Normal: 80.0-95.0)', date: labDate, provider },
  { test_name: 'MCH', result: '27.7 PG (Normal: 27.0-34.0)', date: labDate, provider },
  { test_name: 'MCHC', result: '31.4 g/dL (LOW - Normal: 32.0-35.9)', date: labDate, provider, notes: 'Below normal range - persistent low MCHC' },
  { test_name: 'RDW', result: '13.0% (Normal: 11.5-15.0)', date: labDate, provider },
  { test_name: 'Platelets (Plat)', result: '182 x10^3/UL (Normal: 140-440)', date: labDate, provider },
  { test_name: 'MPV', result: '10.9 fL (Normal: 7.5-11.5)', date: labDate, provider },
  { test_name: 'Granulocytes %', result: '56.8% (Normal: 39.0-78.0)', date: labDate, provider },
  { test_name: 'Lymphocytes %', result: '24.4% (Normal: 15.0-40.0)', date: labDate, provider },
  { test_name: 'Monocytes %', result: '10.2% (HIGH - Normal: <=10.0)', date: labDate, provider, notes: 'Above normal range' },
  { test_name: 'Eosinophils %', result: '6.5% (HIGH - Normal: <=6.0)', date: labDate, provider, notes: 'Above normal range - persistent elevation' },
  { test_name: 'Basophils %', result: '1.5% (Normal: <=2.0)', date: labDate, provider },
  { test_name: 'Immature Granulocytes %', result: '0.6% (HIGH - Normal: <=0.5)', date: labDate, provider, notes: 'Above normal range - ongoing immune activity' },
  { test_name: 'ANC', result: '2.73 x10^3/UL (Normal: 1.50-6.50)', date: labDate, provider },
  { test_name: 'Granulocytes #', result: '2.73 x10^3/UL (Normal: 1.50-6.50)', date: labDate, provider },
  { test_name: 'Lymphocytes #', result: '1.17 x10^3/UL (LOW - Normal: 1.20-3.40)', date: labDate, provider, notes: 'Below normal range - lymphopenia' },
  { test_name: 'Monocytes #', result: '0.49 x10^3/UL (Normal: <=0.90)', date: labDate, provider },
  { test_name: 'Eosinophils #', result: '0.31 x10^3/UL (Normal: <=0.60)', date: labDate, provider },
  { test_name: 'Basophils #', result: '0.07 x10^3/UL (Normal: <=0.20)', date: labDate, provider },
  { test_name: 'Immature Granulocytes #', result: '0.03 x10^3/UL (Normal: <=0.30)', date: labDate, provider }
];

// CMP results
const cmpResults = [
  { test_name: 'BUN/Creatinine Ratio', result: '17 (Normal: 10-20)', date: labDate, provider },
  { test_name: 'BUN', result: '15 mg/dL (Normal: 6-23)', date: labDate, provider },
  { test_name: 'Creatinine', result: '0.9 mg/dL (Normal: 0.3-1.2)', date: labDate, provider },
  { test_name: 'Sodium', result: '139 mEq/L (Normal: 133-145)', date: labDate, provider },
  { test_name: 'Potassium', result: '4.4 mEq/L (Normal: 3.3-5.1)', date: labDate, provider },
  { test_name: 'Chloride', result: '103 mEq/L (Normal: 98-108)', date: labDate, provider },
  { test_name: 'CO2', result: '25 mEq/L (Normal: 22-33)', date: labDate, provider },
  { test_name: 'Calcium', result: '9.5 mg/dL (Normal: 8.4-10.6)', date: labDate, provider },
  { test_name: 'Albumin', result: '4.6 g/dL (Normal: 3.2-5.2)', date: labDate, provider },
  { test_name: 'AST', result: '17 U/L (Normal: 0-40)', date: labDate, provider },
  { test_name: 'ALT', result: '19 U/L (Normal: 0-40)', date: labDate, provider },
  { test_name: 'Alkaline Phosphatase', result: '140 U/L (Normal: 39-147)', date: labDate, provider },
  { test_name: 'Total Bilirubin', result: '0.80 mg/dL (Normal: 0.00-1.00)', date: labDate, provider },
  { test_name: 'Glucose', result: '110 mg/dL (HIGH - Normal: 70-105)', date: labDate, provider, notes: 'Above normal range - persistent elevated glucose' },
  { test_name: 'A/G Ratio', result: '1.8 (Normal: 1.1-2.5)', date: labDate, provider },
  { test_name: 'Total Protein', result: '7.2 g/dL (Normal: 5.9-8.4)', date: labDate, provider },
  { test_name: 'GFR', result: '99.62 mL/min (Normal: 60.00-200.00)', date: labDate, provider },
  { test_name: 'Globulin', result: '2.6 g/dL (Normal: 2.0-3.5)', date: labDate, provider }
];

// Other tests
const otherResults = [
  { test_name: 'Cortisol', result: '9.0 ug/dL', date: labDate, provider, notes: 'Interpretation: See Comment' },
  { test_name: 'HgbA1C', result: '5.8% (HIGH - Normal: 0.0-5.7)', date: labDate, provider, notes: 'Pre-diabetic range - action needed' },
  { test_name: 'Magnesium', result: '1.7 mg/dL (Normal: 1.6-2.6)', date: labDate, provider },
  { test_name: 'POC Glucose', result: '118 mg/L (HIGH - Normal: 70-105)', date: labDate, provider, notes: 'Point-of-care glucose elevated' },
  { test_name: 'TSH (Thyroid Stimulating Hormone)', result: '0.43 uIU/mL (LOW - Normal: 0.55-3.89)', date: labDate, provider, notes: 'Below normal - possible hyperthyroidism, warrants follow-up' }
];

const allResults = [...cbcResults, ...cmpResults, ...otherResults];

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
