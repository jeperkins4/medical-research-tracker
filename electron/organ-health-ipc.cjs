/**
 * Organ Health IPC — Kidney, Liver, Lung, Bone
 * CJS port of server/organ-health-trackers.js and server/bone-health.js
 * Used in packaged Electron app (no HTTP server available).
 */

'use strict';

// ── helpers ──────────────────────────────────────────────────────────────────

function parseNumeric(result) {
  if (!result) return null;
  const m = String(result).match(/([\d.]+)/);
  return m ? parseFloat(m[1]) : null;
}

function dedup(rows) {
  const seen = {};
  for (const r of rows) {
    if (!seen[r.date] || (r.value !== null && r.value > seen[r.date].value)) {
      seen[r.date] = r;
    }
  }
  return Object.values(seen).sort((a, b) => a.date.localeCompare(b.date));
}

function fetchSeries(run, patterns) {
  const allRows = [];
  for (const pat of patterns) {
    try {
      const rows = run(
        `SELECT test_name, result, value_numeric, unit, flag, date
         FROM test_results
         WHERE test_name LIKE ?
         ORDER BY date ASC`,
        [pat]
      );
      for (const r of rows) {
        allRows.push({
          test_name: r.test_name,
          result: r.result,
          value: r.value_numeric ?? parseNumeric(r.result),
          unit: r.unit,
          flag: r.flag,
          date: r.date
        });
      }
    } catch (e) {
      // table or column might not exist yet
    }
  }
  return allRows.filter(r => r.value !== null);
}

function trend(rows) {
  if (rows.length < 2) return null;
  const change = ((rows.at(-1).value - rows[0].value) / rows[0].value) * 100;
  return { change: +change.toFixed(1), direction: change > 0 ? 'up' : 'down' };
}

function getProtectiveSupplements(run, organ) {
  try {
    const meds = run(
      `SELECT name, dosage, notes FROM medications WHERE status='active' OR status IS NULL`,
      []
    );
    // Simple keyword match per organ
    const keywords = {
      kidney: ['NAC', 'N-acetyl', 'astragalus', 'cordyceps', 'magnesium', 'vitamin d', 'omega'],
      liver: ['milk thistle', 'silymarin', 'NAC', 'N-acetyl', 'alpha lipoic', 'B complex', 'B12', 'folate'],
      lung: ['NAC', 'N-acetyl', 'quercetin', 'vitamin C', 'vitamin D', 'omega', 'astragalus'],
      bone: ['calcium', 'vitamin D', 'vitamin K', 'magnesium', 'boron', 'strontium', 'collagen', 'zinc']
    };
    const kw = keywords[organ] || [];
    return meds.filter(m => kw.some(k => m.name && m.name.toLowerCase().includes(k.toLowerCase())));
  } catch (_) {
    return [];
  }
}

// ── Kidney ────────────────────────────────────────────────────────────────────

function getKidneyHealthData(run) {
  try {
    const creatRows = dedup(fetchSeries(run, ['Creatinine', '%CREAT%']));
    const gfrRows   = dedup(fetchSeries(run, ['GFR', '%eGFR%']));
    const bunRows   = dedup(fetchSeries(run, ['BUN', '%Blood Urea%']));
    const ratioRows = dedup(fetchSeries(run, ['%BUN%Creat%', '%BUN%Ratio%']));

    const latestGFR = gfrRows.at(-1)?.value ?? null;
    const latestCr  = creatRows.at(-1)?.value ?? null;
    const latestBUN = bunRows.at(-1)?.value ?? null;

    const triggers = [];
    if (latestGFR !== null && latestGFR < 60)  triggers.push(`eGFR ${latestGFR.toFixed(1)} — below CKD threshold (cisplatin eligibility at risk)`);
    if (latestGFR !== null && latestGFR < 90)  triggers.push(`eGFR ${latestGFR.toFixed(1)} — mildly decreased (monitor closely)`);
    if (latestCr  !== null && latestCr  > 1.2) triggers.push(`Creatinine ${latestCr} mg/dL — elevated`);
    if (latestBUN !== null && latestBUN > 23)   triggers.push(`BUN ${latestBUN} mg/dL — elevated`);

    try {
      const conditions = run(
        `SELECT COUNT(*) as count FROM conditions WHERE status='active'
         AND (name LIKE '%hydronephrosis%' OR name LIKE '%ureteral%obstruct%'
           OR name LIKE '%kidney%' OR notes LIKE '%renal%impairment%')`, []
      );
      if (conditions[0]?.count > 0) triggers.push('Kidney-related condition active (hydronephrosis / obstruction)');
    } catch (_) {}

    const ckdStage = (gfr) => {
      if (gfr === null) return 'Unknown';
      if (gfr >= 90) return 'G1 — Normal (≥90)';
      if (gfr >= 60) return 'G2 — Mildly Decreased (60–89)';
      if (gfr >= 45) return 'G3a — Mildly-Moderately Decreased (45–59)';
      if (gfr >= 30) return 'G3b — Moderately-Severely Decreased (30–44)';
      if (gfr >= 15) return 'G4 — Severely Decreased (15–29)';
      return 'G5 — Kidney Failure (<15)';
    };

    const enabled = triggers.length > 0 || gfrRows.length > 0;
    const allNormal = triggers.filter(t => t.includes('below CKD') || t.includes('elevated')).length === 0 && gfrRows.length > 0;
    const protectiveSupplements = getProtectiveSupplements(run, 'kidney');

    return {
      enabled,
      allNormal,
      triggers,
      protectiveSupplements,
      latestGFR,
      latestCreatinine: latestCr,
      ckdStage: ckdStage(latestGFR),
      gfrNormal: latestGFR === null || latestGFR >= 60,
      creatinineNormal: latestCr === null || (latestCr >= 0.3 && latestCr <= 1.2),
      series: { creatinine: creatRows, gfr: gfrRows, bun: bunRows, bunCreatRatio: ratioRows },
      trends: { creatinine: trend(creatRows), gfr: trend(gfrRows) },
      normalRanges: {
        creatinine: '0.3–1.2 mg/dL',
        gfr: '>60 mL/min/1.73m²',
        bun: '6–23 mg/dL',
        bunCreatRatio: '10–20'
      }
    };
  } catch (err) {
    return { enabled: false, error: err.message };
  }
}

// ── Liver ─────────────────────────────────────────────────────────────────────

function getLiverHealthData(run) {
  try {
    const altRows  = dedup(fetchSeries(run, ['ALT', '%Alanine%Aminotransferase%']));
    const astRows  = dedup(fetchSeries(run, ['AST', '%Aspartate%Aminotransferase%']));
    const albRows  = dedup(fetchSeries(run, ['Albumin']));
    const biliRows = dedup(fetchSeries(run, ['%Total%Bilirubin%', 'Bilirubin%']));
    const protRows = dedup(fetchSeries(run, ['Total Protein']));
    const alkRows  = dedup(fetchSeries(run, ['%Alk%Phos%', '%Alkaline%Phosphatase%']));

    const latestALT  = altRows.at(-1)?.value ?? null;
    const latestAST  = astRows.at(-1)?.value ?? null;
    const latestAlb  = albRows.at(-1)?.value ?? null;
    const latestBili = biliRows.at(-1)?.value ?? null;
    const latestAlk  = alkRows.at(-1)?.value ?? null;
    const astAltRatio = (latestAST && latestALT) ? +(latestAST / latestALT).toFixed(2) : null;

    const flags = [];
    if (latestALT  !== null && latestALT  > 40)  flags.push({ label: 'ALT Elevated', severity: latestALT > 120 ? 'high' : 'medium' });
    if (latestAST  !== null && latestAST  > 40)  flags.push({ label: 'AST Elevated', severity: latestAST > 120 ? 'high' : 'medium' });
    if (latestAlb  !== null && latestAlb  < 3.2) flags.push({ label: 'Albumin Low — hepatic synthetic dysfunction', severity: 'high' });
    if (latestBili !== null && latestBili > 1.2) flags.push({ label: 'Bilirubin Elevated — possible cholestasis or hemolysis', severity: 'medium' });
    if (latestAlk  !== null && latestAlk  > 147) flags.push({ label: 'Alk Phos Elevated (hepatic or bone origin)', severity: 'medium' });

    try {
      const livCond = run(
        `SELECT COUNT(*) as count FROM conditions WHERE status='active'
         AND (name LIKE '%liver%metast%' OR name LIKE '%hepatic%' OR name LIKE '%jaundice%'
           OR notes LIKE '%hepatotoxic%')`, []
      );
      if (livCond[0]?.count > 0) flags.push({ label: 'Liver-related condition active', severity: 'high' });
    } catch (_) {}

    const hasData   = altRows.length > 0 || astRows.length > 0;
    const allNormal = flags.length === 0 && hasData;
    const enabled   = hasData || flags.length > 0;
    const protectiveSupplements = getProtectiveSupplements(run, 'liver');

    return {
      enabled,
      allNormal,
      triggers: flags.map(f => f.label),
      protectiveSupplements,
      latestALT,
      latestAST,
      latestAlbumin: latestAlb,
      latestBilirubin: latestBili,
      latestAlkPhos: latestAlk,
      astAltRatio,
      flags,
      series: { alt: altRows, ast: astRows, albumin: albRows, bilirubin: biliRows, totalProtein: protRows, alkPhos: alkRows },
      trends: { alt: trend(altRows), ast: trend(astRows), albumin: trend(albRows) },
      normalRanges: {
        alt: '0–40 U/L',
        ast: '0–40 U/L',
        albumin: '3.2–5.2 g/dL',
        bilirubin: '0–1.2 mg/dL',
        alkPhos: '39–147 U/L'
      }
    };
  } catch (err) {
    return { enabled: false, error: err.message };
  }
}

// ── Lung ──────────────────────────────────────────────────────────────────────

function getLungHealthData(run) {
  try {
    const co2Rows  = dedup(fetchSeries(run, ['CO2', 'Carbon Dioxide', '%Bicarbonate%']));
    const spo2Rows = dedup(fetchSeries(run, ['SpO2', '%Oxygen%Saturation%', '%O2 Sat%']));
    const wbcRows  = dedup(fetchSeries(run, ['WBC', '%White Blood%']));

    const latestCO2  = co2Rows.at(-1)?.value ?? null;
    const latestSpO2 = spo2Rows.at(-1)?.value ?? null;

    const flags = [];
    if (latestCO2  !== null && latestCO2  < 22) flags.push({ label: 'CO2 Low — possible metabolic acidosis or hyperventilation', severity: 'medium' });
    if (latestCO2  !== null && latestCO2  > 29) flags.push({ label: 'CO2 High — possible respiratory compensation', severity: 'medium' });
    if (latestSpO2 !== null && latestSpO2 < 95) flags.push({ label: 'SpO2 Below Normal — discuss with Dr. Do', severity: 'high' });

    try {
      const lungCond = run(
        `SELECT COUNT(*) as count FROM conditions WHERE status='active'
         AND (name LIKE '%lung%metast%' OR name LIKE '%pulmonary%' OR name LIKE '%pneumonitis%'
           OR notes LIKE '%lung%lesion%' OR notes LIKE '%pleural%effusion%')`, []
      );
      if (lungCond[0]?.count > 0) flags.push({ label: 'Lung-related condition active', severity: 'high' });
    } catch (_) {}

    const noData    = co2Rows.length === 0 && spo2Rows.length === 0;
    const allNormal = flags.length === 0 && !noData;
    const protectiveSupplements = getProtectiveSupplements(run, 'lung');

    return {
      enabled: true,
      allNormal,
      triggers: flags.map(f => f.label),
      protectiveSupplements,
      noDirectMarkers: noData,
      latestCO2,
      latestSpO2,
      flags,
      series: { co2: co2Rows, spo2: spo2Rows, wbc: wbcRows },
      normalRanges: { co2: '22–29 mEq/L', spo2: '95–100%', wbc: '4.5–11.0 K/μL' },
      note: noData
        ? 'No direct pulmonary lab markers found in your results. CO2 and SpO2 not yet in record. Consider requesting a chest X-ray or pulmonary function test if symptoms present.'
        : null
    };
  } catch (err) {
    return { enabled: false, error: err.message };
  }
}

// ── Bone ──────────────────────────────────────────────────────────────────────

function getBoneHealthData(run) {
  try {
    const calcRows  = dedup(fetchSeries(run, ['Calcium', '%Calcium%']));
    const phosRows  = dedup(fetchSeries(run, ['Phosphorus', '%Phosphate%']));
    const alkRows   = dedup(fetchSeries(run, ['%Alk%Phos%', '%Alkaline%Phosphatase%']));
    const vitDRows  = dedup(fetchSeries(run, ['%Vitamin D%', '%25-OH%', '%25 OH%']));
    const pthRows   = dedup(fetchSeries(run, ['PTH', '%Parathyroid%']));

    const latestCalc = calcRows.at(-1)?.value ?? null;
    const latestPhos = phosRows.at(-1)?.value ?? null;
    const latestAlk  = alkRows.at(-1)?.value ?? null;
    const latestVitD = vitDRows.at(-1)?.value ?? null;

    const flags = [];
    if (latestCalc !== null && latestCalc > 10.5) flags.push({ label: `Calcium Elevated ${latestCalc} mg/dL — hypercalcemia (bone mets?)`, severity: 'high' });
    if (latestCalc !== null && latestCalc < 8.5)  flags.push({ label: `Calcium Low ${latestCalc} mg/dL`, severity: 'medium' });
    if (latestAlk  !== null && latestAlk  > 147)  flags.push({ label: `Alk Phos Elevated ${latestAlk} U/L — bone or liver origin`, severity: 'medium' });
    if (latestVitD !== null && latestVitD < 30)   flags.push({ label: `Vitamin D Low ${latestVitD} ng/mL (optimal: 40–60)`, severity: 'medium' });
    if (latestVitD !== null && latestVitD < 20)   flags.push({ label: `Vitamin D Deficient ${latestVitD} ng/mL`, severity: 'high' });

    // Check for bone mets in conditions
    try {
      const boneMets = run(
        `SELECT COUNT(*) as count FROM conditions WHERE status='active'
         AND (name LIKE '%bone%metast%' OR name LIKE '%skeletal%metast%'
           OR notes LIKE '%bone%lesion%' OR notes LIKE '%osteolytic%')`, []
      );
      if (boneMets[0]?.count > 0) flags.push({ label: 'Bone metastases documented in conditions', severity: 'high' });
    } catch (_) {}

    const hasData   = calcRows.length > 0 || vitDRows.length > 0 || alkRows.length > 0;
    const allNormal = flags.length === 0 && hasData;
    const enabled   = hasData || flags.length > 0;
    const protectiveSupplements = getProtectiveSupplements(run, 'bone');

    return {
      enabled,
      allNormal,
      triggers: flags.map(f => f.label),
      protectiveSupplements,
      latestCalcium: latestCalc,
      latestPhosphorus: latestPhos,
      latestAlkPhos: latestAlk,
      latestVitaminD: latestVitD,
      flags,
      series: { calcium: calcRows, phosphorus: phosRows, alkPhos: alkRows, vitaminD: vitDRows, pth: pthRows },
      trends: { calcium: trend(calcRows), vitaminD: trend(vitDRows), alkPhos: trend(alkRows) },
      normalRanges: {
        calcium: '8.5–10.5 mg/dL',
        phosphorus: '2.5–4.5 mg/dL',
        alkPhos: '39–147 U/L',
        vitaminD: '30–100 ng/mL (optimal 40–60)'
      }
    };
  } catch (err) {
    return { enabled: false, error: err.message };
  }
}

module.exports = { getKidneyHealthData, getLiverHealthData, getLungHealthData, getBoneHealthData };
