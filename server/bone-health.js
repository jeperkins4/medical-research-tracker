/**
 * Bone Health API - Track Alkaline Phosphatase and bone metastases risk
 * Provides data for BoneHealthTracker component
 */

import { query } from './db-secure.js';

/**
 * Get bone health data including Alk Phos trend, current supplements, and recommendations
 */
export function getBoneHealthData() {
  try {
    // Get Alkaline Phosphatase trend data
    const alkPhosData = query(`
      SELECT date, result 
      FROM test_results 
      WHERE test_name LIKE '%Alk%Phos%' OR test_name LIKE '%Alkaline%Phosphatase%'
      ORDER BY date ASC
    `);

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

    // Current supplements/medications the user is actually taking
    const currentSupplements = query(`
      SELECT name, dosage, frequency, reason, notes
      FROM medications
      WHERE stopped_date IS NULL OR stopped_date = ''
      ORDER BY name ASC
    `).map(row => ({
      name: row.name,
      dosage: [row.dosage, row.frequency].filter(Boolean).join(' — '),
      benefit: row.reason || row.notes || ''
    }));

    // Missing supplements - CRITICAL GAPS
    const missingSupplements = [
      {
        name: 'Bisphosphonates (Zoledronic acid) or Denosumab',
        dosage: 'IV monthly (Zometa) or SubQ monthly (Xgeva)',
        reason: 'Evidence-based for cancer bone metastases. TUGAMO study shows efficacy. Reduces bone resorption and SRE.',
        urgency: 'urgent',
        category: 'Prescription'
      },
      {
        name: 'Vitamin K2 (MK-7)',
        dosage: '100-200 mcg daily',
        reason: 'Activates osteocalcin - directs calcium TO BONES (not arteries). Important consideration for patients on anticoagulants. Anti-cancer effects.',
        urgency: 'urgent',
        category: 'Supplement'
      },
      {
        name: 'Vitamin D3',
        dosage: '4,000-10,000 IU daily',
        reason: 'General-population dosing is often insufficient for cancer patients. 4,000-10,000 IU is typically discussed for bone protection plus anti-cancer effects.',
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
      alkPhosData: formattedAlkPhos,
      currentSupplements,
      missingSupplements,
      trend,
      riskLevel,
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
      action: 'Schedule appointment with your oncologist to discuss rising Alk Phos',
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
