/**
 * Organ Health API — Kidney, Liver, Lung monitoring
 * Pulls from test_results and returns trend data + clinical commentary
 */

import { query } from './db-secure.js';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Extract the first numeric value from a result string like "99.62 mL/min (Normal: ...)" */
function parseNumeric(result) {
  if (!result) return null;
  const m = String(result).match(/([\d.]+)/);
  return m ? parseFloat(m[1]) : null;
}

/** Deduplicate rows by date (keep highest value per date for trending) */
function dedup(rows) {
  const seen = {};
  for (const r of rows) {
    if (!seen[r.date] || (r.value !== null && r.value > seen[r.date].value)) {
      seen[r.date] = r;
    }
  }
  return Object.values(seen).sort((a, b) => a.date.localeCompare(b.date));
}

/** Fetch rows for a list of test_name patterns and parse value_numeric */
function fetchSeries(patterns) {
  const allRows = [];
  for (const pat of patterns) {
    try {
      const rows = query(
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
      console.warn(`[organ-health] fetchSeries error for "${pat}":`, e.message);
    }
  }
  return allRows.filter(r => r.value !== null);
}

// ── Kidney ────────────────────────────────────────────────────────────────────

export function getKidneyHealthData() {
  try {
    const creatRows  = dedup(fetchSeries(['Creatinine', '%CREAT%']));
    const gfrRows    = dedup(fetchSeries(['GFR', '%eGFR%']));
    const bunRows    = dedup(fetchSeries(['BUN', '%Blood Urea%']));
    const ratioRows  = dedup(fetchSeries(['%BUN%Creat%', '%BUN%Ratio%']));

    const latestGFR  = gfrRows.at(-1)?.value ?? null;
    const latestCr   = creatRows.at(-1)?.value ?? null;
    const latestBUN  = bunRows.at(-1)?.value ?? null;

    // Determine if monitoring is clinically indicated
    const triggers = [];
    if (latestGFR !== null && latestGFR < 60)   triggers.push(`eGFR ${latestGFR.toFixed(1)} — below CKD threshold (cisplatin eligibility at risk)`);
    if (latestGFR !== null && latestGFR < 90)   triggers.push(`eGFR ${latestGFR.toFixed(1)} — mildly decreased (monitor closely)`);
    if (latestCr  !== null && latestCr  > 1.2)  triggers.push(`Creatinine ${latestCr} mg/dL — elevated`);
    if (latestBUN !== null && latestBUN > 23)    triggers.push(`BUN ${latestBUN} mg/dL — elevated`);

    // Also check conditions for hydronephrosis / ureteral obstruction
    try {
      const conditions = query(
        `SELECT COUNT(*) as count FROM conditions WHERE status='active'
         AND (name LIKE '%hydronephrosis%' OR name LIKE '%ureteral%obstruct%'
           OR name LIKE '%kidney%' OR notes LIKE '%renal%impairment%')`,
        []
      );
      if (conditions[0].count > 0) triggers.push('Kidney-related condition active (hydronephrosis / obstruction)');
    } catch (_) {}

    const enabled = triggers.length > 0 || gfrRows.length > 0; // always show if we have data

    // CKD staging by GFR (simplified)
    const ckdStage = (gfr) => {
      if (gfr === null) return 'Unknown';
      if (gfr >= 90) return 'G1 — Normal (≥90)';
      if (gfr >= 60) return 'G2 — Mildly Decreased (60–89)';
      if (gfr >= 45) return 'G3a — Mildly-Moderately Decreased (45–59)';
      if (gfr >= 30) return 'G3b — Moderately-Severely Decreased (30–44)';
      if (gfr >= 15) return 'G4 — Severely Decreased (15–29)';
      return 'G5 — Kidney Failure (<15)';
    };

    const trend = (rows) => {
      if (rows.length < 2) return null;
      const change = ((rows.at(-1).value - rows[0].value) / rows[0].value) * 100;
      return { change: +change.toFixed(1), direction: change > 0 ? 'up' : 'down' };
    };

    const allNormal = triggers.length === 0 && gfrRows.length > 0;

    return {
      enabled,
      allNormal,
      triggers,
      latestGFR,
      latestCreatinine: latestCr,
      ckdStage: ckdStage(latestGFR),
      gfrNormal: latestGFR === null || latestGFR >= 60,
      creatinineNormal: latestCr === null || (latestCr >= 0.3 && latestCr <= 1.2),
      series: {
        creatinine: creatRows,
        gfr: gfrRows,
        bun: bunRows,
        bunCreatRatio: ratioRows
      },
      trends: {
        creatinine: trend(creatRows),
        gfr: trend(gfrRows)
      },
      normalRanges: {
        creatinine: '0.3–1.2 mg/dL',
        gfr: '>60 mL/min/1.73m²',
        bun: '6–23 mg/dL',
        bunCreatRatio: '10–20'
      }
    };
  } catch (err) {
    console.error('[organ-health] kidney error:', err);
    return { enabled: false, error: err.message };
  }
}

// ── Liver ─────────────────────────────────────────────────────────────────────

export function getLiverHealthData() {
  try {
    const altRows   = dedup(fetchSeries(['ALT', '%Alanine%Aminotransferase%']));
    const astRows   = dedup(fetchSeries(['AST', '%Aspartate%Aminotransferase%']));
    const albRows   = dedup(fetchSeries(['Albumin']));
    const biliRows  = dedup(fetchSeries(['%Total%Bilirubin%', 'Bilirubin%']));
    const protRows  = dedup(fetchSeries(['Total Protein']));
    const alkRows   = dedup(fetchSeries(['%Alk%Phos%', '%Alkaline%Phosphatase%']));

    const latestALT  = altRows.at(-1)?.value ?? null;
    const latestAST  = astRows.at(-1)?.value ?? null;
    const latestAlb  = albRows.at(-1)?.value ?? null;
    const latestBili = biliRows.at(-1)?.value ?? null;
    const latestAlk  = alkRows.at(-1)?.value ?? null;

    // AST/ALT ratio (helpful for distinguishing liver injury pattern)
    const astAltRatio = (latestAST && latestALT) ? +(latestAST / latestALT).toFixed(2) : null;

    const trend = (rows) => {
      if (rows.length < 2) return null;
      const change = ((rows.at(-1).value - rows[0].value) / rows[0].value) * 100;
      return { change: +change.toFixed(1), direction: change > 0 ? 'up' : 'down' };
    };

    const flags = [];
    if (latestALT !== null && latestALT > 40) flags.push({ label: 'ALT Elevated', severity: latestALT > 120 ? 'high' : 'medium' });
    if (latestAST !== null && latestAST > 40) flags.push({ label: 'AST Elevated', severity: latestAST > 120 ? 'high' : 'medium' });
    if (latestAlb !== null && latestAlb < 3.2) flags.push({ label: 'Albumin Low — hepatic synthetic dysfunction', severity: 'high' });
    if (latestBili !== null && latestBili > 1.2) flags.push({ label: 'Bilirubin Elevated — possible cholestasis or hemolysis', severity: 'medium' });
    if (latestAlk !== null && latestAlk > 147) flags.push({ label: 'Alk Phos Elevated (hepatic or bone origin)', severity: 'medium' });

    // Also check conditions
    try {
      const livCond = query(
        `SELECT COUNT(*) as count FROM conditions WHERE status='active'
         AND (name LIKE '%liver%metast%' OR name LIKE '%hepatic%' OR name LIKE '%jaundice%'
           OR notes LIKE '%hepatotoxic%')`, []
      );
      if (livCond[0].count > 0) flags.push({ label: 'Liver-related condition active', severity: 'high' });
    } catch (_) {}

    const hasData = altRows.length > 0 || astRows.length > 0;
    const allNormal = flags.length === 0 && hasData;
    const enabled   = hasData; // always show if we have labs

    return {
      enabled,
      allNormal,
      triggers: flags.map(f => f.label),
      latestALT,
      latestAST,
      latestAlbumin: latestAlb,
      latestBilirubin: latestBili,
      latestAlkPhos: latestAlk,
      astAltRatio,
      flags,
      series: {
        alt: altRows,
        ast: astRows,
        albumin: albRows,
        bilirubin: biliRows,
        totalProtein: protRows,
        alkPhos: alkRows
      },
      trends: {
        alt: trend(altRows),
        ast: trend(astRows),
        albumin: trend(albRows)
      },
      normalRanges: {
        alt: '0–40 U/L',
        ast: '0–40 U/L',
        albumin: '3.2–5.2 g/dL',
        bilirubin: '0–1.2 mg/dL',
        alkPhos: '39–147 U/L'
      }
    };
  } catch (err) {
    console.error('[organ-health] liver error:', err);
    return { enabled: false, error: err.message };
  }
}

// ── Lung ──────────────────────────────────────────────────────────────────────

export function getLungHealthData() {
  try {
    const co2Rows  = dedup(fetchSeries(['CO2', 'Carbon Dioxide', '%Bicarbonate%']));
    const spo2Rows = dedup(fetchSeries(['SpO2', '%Oxygen%Saturation%', '%O2 Sat%']));
    const wbcRows  = dedup(fetchSeries(['WBC', '%White Blood%']));   // infection/inflammation proxy

    const latestCO2  = co2Rows.at(-1)?.value ?? null;
    const latestSpO2 = spo2Rows.at(-1)?.value ?? null;

    const flags = [];
    if (latestCO2 !== null && latestCO2 < 22) flags.push({ label: 'CO2 Low — possible metabolic acidosis or hyperventilation', severity: 'medium' });
    if (latestCO2 !== null && latestCO2 > 29) flags.push({ label: 'CO2 High — possible respiratory compensation', severity: 'medium' });
    if (latestSpO2 !== null && latestSpO2 < 95) flags.push({ label: 'SpO2 Below Normal — discuss with Dr. Do', severity: 'high' });

    // Check conditions for lung involvement
    try {
      const lungCond = query(
        `SELECT COUNT(*) as count FROM conditions WHERE status='active'
         AND (name LIKE '%lung%metast%' OR name LIKE '%pulmonary%' OR name LIKE '%pneumonitis%'
           OR notes LIKE '%lung%lesion%' OR notes LIKE '%pleural%effusion%')`, []
      );
      if (lungCond[0].count > 0) flags.push({ label: 'Lung-related condition active', severity: 'high' });
    } catch (_) {}

    const noData  = co2Rows.length === 0 && spo2Rows.length === 0;
    const allNormal = flags.length === 0 && !noData;
    const enabled   = true; // always show — important for cancer patients even without direct markers

    return {
      enabled,
      allNormal,
      triggers: flags.map(f => f.label),
      noDirectMarkers: noData,
      latestCO2,
      latestSpO2,
      flags,
      series: {
        co2: co2Rows,
        spo2: spo2Rows,
        wbc: wbcRows
      },
      normalRanges: {
        co2: '22–29 mEq/L',
        spo2: '95–100%',
        wbc: '4.5–11.0 K/μL'
      },
      note: noData
        ? 'No direct pulmonary lab markers found in your results. CO2 and SpO2 not yet in record. Consider requesting a chest X-ray or pulmonary function test if symptoms present.'
        : null
    };
  } catch (err) {
    console.error('[organ-health] lung error:', err);
    return { enabled: false, error: err.message };
  }
}
