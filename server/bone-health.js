/**
 * Bone Health API - Track Alkaline Phosphatase and bone metastases risk
 * Provides data for BoneHealthTracker component
 */

import { query } from './db-secure.js';
import { getProtectiveSupplements } from './supplement-organs.js';
import { getRadiologyFindingsForOrgan, getCriticalFindingsByKeyword } from './radiology-triggers.js';

/**
 * Check if bone health monitoring is warranted based on clinical indicators
 * Returns true if any of these conditions are met:
 * - Bone metastases or osseous lesions in conditions
 * - Elevated alkaline phosphatase (>147 U/L)
 * - Elevated calcium (>10.2 mg/dL)
 * - Abnormal bone scan or imaging results
 */
export function shouldMonitorBoneHealth() {
  try {
    // Check for bone metastases or osseous lesions in conditions
    const boneConditions = query(`
      SELECT COUNT(*) as count
      FROM conditions
      WHERE status = 'active'
        AND (
          name LIKE '%bone%metast%' OR
          name LIKE '%osseous%' OR
          name LIKE '%skeletal%metast%' OR
          notes LIKE '%bone%metast%' OR
          notes LIKE '%osseous%lesion%' OR
          notes LIKE '%skeletal%involvement%'
        )
    `);

    if (boneConditions[0].count > 0) {
      return { 
        shouldMonitor: true, 
        reason: 'bone_metastases',
        message: 'Bone metastases or osseous lesions detected in conditions'
      };
    }

    // Check for elevated alkaline phosphatase
    const recentAlkPhos = query(`
      SELECT result 
      FROM test_results 
      WHERE (test_name LIKE '%Alk%Phos%' OR test_name LIKE '%Alkaline%Phosphatase%')
      ORDER BY date DESC
      LIMIT 1
    `);

    if (recentAlkPhos.length > 0) {
      const match = recentAlkPhos[0].result.match(/([\d.]+)/);
      if (match) {
        const value = parseFloat(match[1]);
        if (value > 147) {
          return { 
            shouldMonitor: true, 
            reason: 'elevated_alk_phos',
            message: `Elevated Alkaline Phosphatase: ${value} U/L (normal: 39-147)`
          };
        }
      }
    }

    // Check for elevated LDH (tissue breakdown / tumor burden)
    try {
      const recentLDH = query(
        `SELECT result FROM test_results WHERE (test_name LIKE '%LDH%' OR test_name LIKE '%Lactate Dehydrogenase%') ORDER BY date DESC LIMIT 1`, []
      );
      if (recentLDH.length > 0) {
        const match = recentLDH[0].result?.match(/([\d.]+)/);
        if (match && parseFloat(match[1]) > 246) {
          return { shouldMonitor: true, reason: 'elevated_ldh', message: `Elevated LDH: ${parseFloat(match[1])} U/L — tissue breakdown / tumor burden indicator` };
        }
      }
    } catch (_) {}

    // Check for elevated calcium
    const recentCalcium = query(`
      SELECT result 
      FROM test_results 
      WHERE test_name LIKE '%Calcium%' AND test_name NOT LIKE '%Ionized%'
      ORDER BY date DESC
      LIMIT 1
    `);

    if (recentCalcium.length > 0) {
      const match = recentCalcium[0].result.match(/([\d.]+)/);
      if (match) {
        const value = parseFloat(match[1]);
        if (value > 10.2) {
          return { 
            shouldMonitor: true, 
            reason: 'elevated_calcium',
            message: `Elevated Calcium: ${value} mg/dL (normal: 8.5-10.2)`
          };
        }
      }
    }

    // Check for abnormal bone-related imaging (if table exists)
    try {
      const boneImaging = query(`
        SELECT COUNT(*) as count
        FROM imaging_results
        WHERE (
          name LIKE '%bone%scan%' OR
          name LIKE '%skeletal%' OR
          name LIKE '%spine%' OR
          name LIKE '%pelvis%'
        ) AND (
          findings LIKE '%metast%' OR
          findings LIKE '%lesion%' OR
          findings LIKE '%abnormal%'
        )
      `);

      if (boneImaging[0]?.count > 0) {
        return { 
          shouldMonitor: true, 
          reason: 'abnormal_imaging',
          message: 'Abnormal findings on bone imaging'
        };
      }
    } catch (err) {
      // Table might not exist - ignore silently
    }

    // Check uploaded radiology reports for bone findings
    try {
      const boneFindings = getRadiologyFindingsForOrgan('bone');
      if (boneFindings.length > 0) {
        const f = boneFindings[0];
        return {
          shouldMonitor: true,
          reason: 'radiology_finding',
          message: `Imaging finding: ${f.type} in ${f.region} (${f.docDate || f.docTitle})`,
          imagingFindings: boneFindings,
        };
      }
      // Also check critical_findings text
      const criticalHits = getCriticalFindingsByKeyword([
        'bone', 'osseous', 'skeletal', 'vertebra', 'spine', 'metastas', 'lesion', 'lytic', 'sclerotic',
      ]);
      if (criticalHits.length > 0) {
        return {
          shouldMonitor: true,
          reason: 'radiology_keyword',
          message: `Radiology report mentions bone findings (${criticalHits[0].docDate || criticalHits[0].docTitle})`,
          imagingFindings: criticalHits,
        };
      }
    } catch (err) { /* ignore */ }

    // No bone health concerns detected
    return { 
      shouldMonitor: false, 
      reason: 'no_indicators',
      message: 'No clinical indicators for bone health monitoring'
    };

  } catch (error) {
    console.error('Error checking bone health indicators:', error);
    // Default to false if error
    return { 
      shouldMonitor: false, 
      reason: 'error',
      message: error.message
    };
  }
}

/**
 * Get bone health data including Alk Phos trend, current supplements, and recommendations
 * Only returns data if bone health monitoring is warranted
 */
export function getBoneHealthData() {
  // Check if bone health monitoring is needed
  const monitorCheck = shouldMonitorBoneHealth();
  
  if (!monitorCheck.shouldMonitor) {
    return {
      enabled: false,
      reason: monitorCheck.reason,
      message: monitorCheck.message
    };
  }
  try {
    // ── Helper: fetch a test series and parse numeric values ──────────────────
    const fetchSeries = (patterns) => {
      const whereClause = patterns.map(() => 'test_name LIKE ?').join(' OR ');
      const params = patterns.map(p => p.includes('%') ? p : `%${p}%`);
      const rows = query(
        `SELECT date, test_name, result FROM test_results WHERE (${whereClause}) ORDER BY date ASC`,
        params
      );
      return rows.map(row => {
        const match = row.result?.match(/([\d.]+)/);
        const value = match ? parseFloat(match[1]) : null;
        return { date: row.date, test_name: row.test_name, result: row.result, value };
      }).filter(r => r.value !== null);
    };

    const latest = (series) => series.at(-1) ?? null;
    const trendCalc = (series) => {
      if (series.length < 2) return null;
      const change = ((series.at(-1).value - series[0].value) / series[0].value) * 100;
      return { change: +change.toFixed(1), direction: change > 0 ? 'up' : 'down', latestValue: series.at(-1).value, latestDate: series.at(-1).date };
    };

    // ── Bone markers ──────────────────────────────────────────────────────────
    const alkPhosData  = fetchSeries(['%Alk%Phos%', '%Alkaline%Phosphatase%']);
    const calciumData  = fetchSeries(['%Calcium%']);
    const phosphData   = fetchSeries(['%Phosphorus%', '%Phosphate%']);
    const vitDData     = fetchSeries(['%Vitamin D%', '%25-OH%', '%25 OH%', '%Calcidiol%']);
    const ldhData      = fetchSeries(['%LDH%', '%Lactate Dehydrogenase%']);

    // ── Soft tissue / tumor burden markers ────────────────────────────────────
    const albuminData  = fetchSeries(['%Albumin%']);
    const crpData      = fetchSeries(['%CRP%', '%C-Reactive%']);
    const ferritinData = fetchSeries(['%Ferritin%']);
    const uricAcidData = fetchSeries(['%Uric Acid%']);

    // ── Tumor markers ─────────────────────────────────────────────────────────
    const ceaData      = fetchSeries(['%CEA%', '%Carcinoembryonic%']);
    const ca125Data    = fetchSeries(['%CA 125%', '%CA-125%']);
    const ca199Data    = fetchSeries(['%CA 19-9%', '%CA19-9%']);

    // ── Lab-driven clinical flags ─────────────────────────────────────────────
    const labFlags = [];
    const latestAlkPhos = latest(alkPhosData)?.value ?? null;
    const latestCalcium = latest(calciumData)?.value ?? null;
    const latestLDH     = latest(ldhData)?.value ?? null;
    const latestVitD    = latest(vitDData)?.value ?? null;
    const latestPhosph  = latest(phosphData)?.value ?? null;
    const latestAlbumin = latest(albuminData)?.value ?? null;
    const latestCRP     = latest(crpData)?.value ?? null;
    const latestUric    = latest(uricAcidData)?.value ?? null;

    if (latestAlkPhos !== null && latestAlkPhos > 147) labFlags.push({ marker: 'Alk Phos', value: `${latestAlkPhos} U/L`, status: 'HIGH', note: 'Bone resorption / hepatic marker — monitor for bone metastases', severity: latestAlkPhos > 200 ? 'critical' : 'warning' });
    if (latestCalcium !== null && latestCalcium > 10.2) labFlags.push({ marker: 'Calcium', value: `${latestCalcium} mg/dL`, status: 'HIGH', note: 'Hypercalcemia — possible osteolytic activity', severity: latestCalcium > 12 ? 'critical' : 'warning' });
    if (latestLDH     !== null && latestLDH > 246)  labFlags.push({ marker: 'LDH', value: `${latestLDH} U/L`, status: 'HIGH', note: 'Elevated — tissue breakdown / tumor burden indicator', severity: latestLDH > 400 ? 'critical' : 'warning' });
    if (latestVitD    !== null && latestVitD < 30)  labFlags.push({ marker: 'Vitamin D', value: `${latestVitD} ng/mL`, status: latestVitD < 20 ? 'DEFICIENT' : 'LOW', note: 'Insufficient for bone protection — cancer patients need 50–80 ng/mL', severity: latestVitD < 20 ? 'warning' : 'info' });
    if (latestPhosph  !== null && (latestPhosph < 2.5 || latestPhosph > 4.5)) labFlags.push({ marker: 'Phosphorus', value: `${latestPhosph} mg/dL`, status: latestPhosph < 2.5 ? 'LOW' : 'HIGH', note: 'Abnormal — may reflect bone metabolism changes', severity: 'warning' });
    if (latestAlbumin !== null && latestAlbumin < 3.5) labFlags.push({ marker: 'Albumin', value: `${latestAlbumin} g/dL`, status: 'LOW', note: 'Low albumin — soft tissue / nutritional status concern', severity: 'warning' });
    if (latestCRP     !== null && latestCRP > 1.0)  labFlags.push({ marker: 'CRP', value: `${latestCRP} mg/L`, status: 'ELEVATED', note: 'Systemic inflammation — soft tissue involvement', severity: latestCRP > 10 ? 'warning' : 'info' });
    if (latestUric    !== null && latestUric > 7.0) labFlags.push({ marker: 'Uric Acid', value: `${latestUric} mg/dL`, status: 'HIGH', note: 'Elevated — possible cell turnover / bone breakdown', severity: 'info' });

    // ── Tumor marker flags ────────────────────────────────────────────────────
    const tumorFlags = [];
    const latestCEA  = latest(ceaData)?.value ?? null;
    const latestCA125 = latest(ca125Data)?.value ?? null;
    const latestCA199 = latest(ca199Data)?.value ?? null;
    if (latestCEA   !== null && latestCEA > 3.0)  tumorFlags.push({ marker: 'CEA',    value: `${latestCEA} ng/mL`,  status: 'ELEVATED', note: 'Carcinoembryonic antigen — tumor burden indicator' });
    if (latestCA125 !== null && latestCA125 > 35)  tumorFlags.push({ marker: 'CA-125', value: `${latestCA125} U/mL`, status: 'ELEVATED', note: 'CA-125 elevated — monitor' });
    if (latestCA199 !== null && latestCA199 > 37)  tumorFlags.push({ marker: 'CA 19-9', value: `${latestCA199} U/mL`, status: 'ELEVATED', note: 'CA 19-9 elevated — monitor' });

    // ── Get Alkaline Phosphatase trend data (legacy format for chart) ─────────
    const formattedAlkPhos = alkPhosData;

    // Parse values and format for chart
    const formattedAlkPhos = alkPhosData.map(row => {
      // Extract numeric value from result (e.g., "165 U/L HIGH" → 165)
      const match = row.result.match(/([\d.]+)/);
      const value = match ? parseFloat(match[1]) : null;
      
      return {
        date: row.date,
        value: value,
        result: row.result
      };
    }).filter(row => row.value !== null);

    // Get current supplements that support bone health
    const currentSupplements = [
      {
        name: 'Alpha-Ketoglutarate (AKG)',
        dosage: '1000 mg daily',
        benefit: 'Collagen synthesis (bone matrix), longevity, cellular energy'
      },
      {
        name: 'Fenbendazole',
        dosage: '222 mg, 4 days/week',
        benefit: 'Anti-cancer effects may slow tumor spread to bones'
      },
      {
        name: 'Ivermectin',
        dosage: '36 mg daily',
        benefit: 'Anti-cancer, anti-angiogenic - may inhibit metastasis'
      },
      {
        name: 'Vitamin C IV',
        dosage: 'Bi-weekly infusions',
        benefit: 'High-dose pro-oxidant effect on cancer cells, immune support'
      },
      {
        name: 'Low Dose Naltrexone (LDN)',
        dosage: '1.5-4.5 mg nightly',
        benefit: 'Immune modulation, may inhibit cancer cell growth'
      },
      {
        name: 'Methylene Blue',
        dosage: 'Daily (0.5-4 mg/kg)',
        benefit: 'Mitochondrial support, potential anti-cancer effects'
      },
      {
        name: 'Vitamin D3',
        dosage: '1000 IU daily (INSUFFICIENT - see gaps)',
        benefit: 'Bone health, immune modulation, anti-cancer effects'
      },
      {
        name: 'Carrot Juice (Morning)',
        dosage: 'Organic with ginger & turmeric',
        benefit: 'Beta-carotene (antioxidant), curcumin (anti-inflammatory), bone-protective'
      },
      {
        name: 'Low-Sugar Diet',
        dosage: 'Daily philosophy',
        benefit: 'Metabolic approach - cancer cells prefer glucose, anti-inflammatory'
      }
    ];

    // Missing supplements - CRITICAL GAPS
    const missingSupplements = [
      {
        name: 'Bisphosphonates (Zoledronic acid) or Denosumab',
        dosage: 'IV monthly (Zometa) or SubQ monthly (Xgeva)',
        reason: 'Evidence-based for cancer bone metastases. Reduces bone resorption and skeletal-related events (SRE).',
        urgency: 'urgent',
        category: 'Prescription'
      },
      {
        name: 'Vitamin K2 (MK-7)',
        dosage: '100-200 mcg daily',
        reason: 'Activates osteocalcin - directs calcium TO BONES (not arteries). Critical with Eliquis. Anti-cancer effects.',
        urgency: 'urgent',
        category: 'Supplement'
      },
      {
        name: 'Vitamin D3 (Increase)',
        dosage: 'Increase from 1,000 IU to 5,000 IU daily',
        reason: 'Current dose insufficient for cancer patients. Need 4,000-10,000 IU for bone protection + anti-cancer effects.',
        urgency: 'urgent',
        category: 'Supplement'
      },
      {
        name: 'Calcium Citrate',
        dosage: '1200 mg daily (600mg x2)',
        reason: 'Essential for bone density. MUST pair with K2 to prevent arterial calcification. Reduces bone resorption.',
        urgency: 'high',
        category: 'Supplement'
      },
      {
        name: 'Magnesium Glycinate',
        dosage: '400 mg daily (200mg x2)',
        reason: 'Required for Vitamin D activation. Critical for bone formation. Works with calcium (1:2 ratio).',
        urgency: 'high',
        category: 'Supplement'
      },
      {
        name: 'Boron',
        dosage: '3 mg daily',
        reason: 'Improves calcium/magnesium metabolism. Increases Vitamin D activation. Anti-inflammatory.',
        urgency: 'medium',
        category: 'Supplement'
      },
      {
        name: 'Strontium Citrate',
        dosage: '680 mg daily (consider)',
        reason: 'Increases bone formation, decreases resorption. Used in osteoporosis. Limited cancer data but promising.',
        urgency: 'low',
        category: 'Supplement (Research)'
      }
    ];

    // Calculate trend and risk
    let trend = null;
    let riskLevel = 'unknown';
    
    if (formattedAlkPhos.length >= 2) {
      const latest = formattedAlkPhos[formattedAlkPhos.length - 1];
      const earliest = formattedAlkPhos[0];
      const change = ((latest.value - earliest.value) / earliest.value) * 100;
      
      trend = {
        change: change.toFixed(1),
        direction: change > 0 ? 'up' : 'down',
        latestValue: latest.value,
        latestDate: latest.date,
        isAbnormal: latest.value > 147
      };

      // Determine risk level
      if (latest.value > 147 && change > 20) {
        riskLevel = 'high';
      } else if (latest.value > 147 || (change > 10 && change <= 20)) {
        riskLevel = 'medium';
      } else {
        riskLevel = 'low';
      }
    }

    return {
      enabled: true,
      reason: monitorCheck.reason,
      message: monitorCheck.message,

      // ── Primary bone marker trends ────────────────────────────────────────
      alkPhosData: formattedAlkPhos,
      trend,
      riskLevel,

      // ── Extended panel trends ─────────────────────────────────────────────
      panelData: {
        calcium:   { series: calciumData,  trend: trendCalc(calciumData),  latest: latestCalcium, normal: { min: 8.5,  max: 10.2 }, unit: 'mg/dL', label: 'Calcium' },
        phosphorus:{ series: phosphData,   trend: trendCalc(phosphData),   latest: latestPhosph,  normal: { min: 2.5,  max: 4.5  }, unit: 'mg/dL', label: 'Phosphorus' },
        vitaminD:  { series: vitDData,     trend: trendCalc(vitDData),     latest: latestVitD,    normal: { min: 30,   max: 80   }, unit: 'ng/mL', label: 'Vitamin D (25-OH)' },
        ldh:       { series: ldhData,      trend: trendCalc(ldhData),      latest: latestLDH,     normal: { min: 100,  max: 246  }, unit: 'U/L',   label: 'LDH' },
      },

      // ── Soft tissue / inflammatory markers ───────────────────────────────
      softTissueData: {
        albumin:   { series: albuminData,  trend: trendCalc(albuminData),  latest: latestAlbumin, normal: { min: 3.5,  max: 5.0  }, unit: 'g/dL',  label: 'Albumin' },
        crp:       { series: crpData,      trend: trendCalc(crpData),      latest: latestCRP,     normal: { min: 0,    max: 1.0  }, unit: 'mg/L',  label: 'CRP' },
        ferritin:  { series: ferritinData, trend: trendCalc(ferritinData), latest: latest(ferritinData)?.value ?? null, normal: { min: 12, max: 300 }, unit: 'ng/mL', label: 'Ferritin' },
        uricAcid:  { series: uricAcidData, trend: trendCalc(uricAcidData), latest: latestUric,    normal: { min: 2.4,  max: 7.0  }, unit: 'mg/dL', label: 'Uric Acid' },
      },

      // ── Tumor markers ─────────────────────────────────────────────────────
      tumorMarkerData: {
        cea:  { series: ceaData,   trend: trendCalc(ceaData),   latest: latestCEA,   normal: { max: 3.0 },  unit: 'ng/mL',  label: 'CEA' },
        ca125:{ series: ca125Data, trend: trendCalc(ca125Data), latest: latestCA125, normal: { max: 35 },   unit: 'U/mL',   label: 'CA-125' },
        ca199:{ series: ca199Data, trend: trendCalc(ca199Data), latest: latestCA199, normal: { max: 37 },   unit: 'U/mL',   label: 'CA 19-9' },
      },

      // ── Clinical flags (all abnormal values) ──────────────────────────────
      labFlags,
      tumorFlags,

      // ── Existing data ─────────────────────────────────────────────────────
      currentSupplements,
      missingSupplements,
      protectiveSupplements: getProtectiveSupplements('bone'),
      imagingFindings: monitorCheck.imagingFindings || [],
      lastUpdated: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error fetching bone health data:', error);
    throw error;
  }
}

/**
 * Get detailed bone health metrics for dashboard
 */
export function getBoneHealthMetrics() {
  try {
    const data = getBoneHealthData();
    
    // Calculate metrics
    const latestAlkPhos = data.alkPhosData.length > 0 
      ? data.alkPhosData[data.alkPhosData.length - 1] 
      : null;

    const metrics = {
      currentAlkPhos: latestAlkPhos ? latestAlkPhos.value : null,
      isAbnormal: latestAlkPhos && latestAlkPhos.value > 147,
      normalRange: '39-147 U/L',
      trend: data.trend,
      riskLevel: data.riskLevel,
      supplementsActive: data.currentSupplements.length,
      supplementsMissing: data.missingSupplements.filter(s => s.urgency === 'urgent' || s.urgency === 'high').length,
      urgentActions: data.missingSupplements.filter(s => s.urgency === 'urgent').length,
      lastMeasurement: latestAlkPhos ? latestAlkPhos.date : null
    };

    return metrics;
  } catch (error) {
    console.error('Error calculating bone health metrics:', error);
    throw error;
  }
}

/**
 * Get bone health action items with priorities
 */
export function getBoneHealthActions() {
  const actions = [
    {
      priority: 'urgent',
      action: 'Schedule appointment with Dr. Do to discuss rising Alk Phos',
      status: 'pending',
      dueDate: 'ASAP',
      category: 'Medical'
    },
    {
      priority: 'urgent',
      action: 'Request bone scan to rule out metastases',
      status: 'pending',
      dueDate: 'This week',
      category: 'Diagnostic'
    },
    {
      priority: 'urgent',
      action: 'Discuss Zoledronic acid or Denosumab with oncology',
      status: 'pending',
      dueDate: 'Next appointment',
      category: 'Treatment'
    },
    {
      priority: 'high',
      action: 'Labs: Alk Phos, Calcium, 25-OH Vitamin D, PTH, CTX',
      status: 'pending',
      dueDate: 'This week',
      category: 'Labs'
    },
    {
      priority: 'high',
      action: 'Order Vitamin K2-MK7 200mcg supplement',
      status: 'pending',
      dueDate: 'This week',
      category: 'Supplement'
    },
    {
      priority: 'high',
      action: 'Increase Vitamin D3 from 1,000 IU to 5,000 IU daily',
      status: 'ready',
      dueDate: 'Start immediately',
      category: 'Supplement'
    },
    {
      priority: 'medium',
      action: 'Add Calcium Citrate 1200mg/day (split doses)',
      status: 'pending',
      dueDate: 'Within 2 weeks',
      category: 'Supplement'
    },
    {
      priority: 'medium',
      action: 'Add Magnesium Glycinate 400mg/day',
      status: 'pending',
      dueDate: 'Within 2 weeks',
      category: 'Supplement'
    },
    {
      priority: 'medium',
      action: 'Add Boron 3mg/day',
      status: 'pending',
      dueDate: 'Within 2 weeks',
      category: 'Supplement'
    },
    {
      priority: 'low',
      action: 'Research Strontium Citrate - discuss with team',
      status: 'research',
      dueDate: 'Future',
      category: 'Supplement'
    }
  ];

  return actions;
}
