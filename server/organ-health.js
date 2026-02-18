/**
 * Organ Health Monitoring System
 * 
 * Conditional monitoring for liver, lung, kidneys, bone
 * Only activates when clinical indicators are present
 */

import { query } from './db-secure.js';

/**
 * Check if liver health monitoring is warranted
 */
export function shouldMonitorLiver() {
  try {
    // Check for liver metastases
    const liverMets = query(`
      SELECT COUNT(*) as count
      FROM conditions
      WHERE active = 1
        AND (
          name LIKE '%liver%metast%' OR
          name LIKE '%hepatic%metast%' OR
          notes LIKE '%liver%metast%' OR
          notes LIKE '%hepatic%lesion%'
        )
    `);

    if (liverMets[0].count > 0) {
      return {
        shouldMonitor: true,
        reason: 'liver_metastases',
        message: 'Liver metastases detected in conditions'
      };
    }

    // Check for elevated AST (normal: 10-40 U/L)
    const ast = query(`
      SELECT result FROM test_results 
      WHERE (test_name LIKE '%AST%' OR test_name LIKE '%SGOT%')
        AND test_name NOT LIKE '%Cystatin%'
      ORDER BY date DESC LIMIT 1
    `);

    if (ast.length > 0) {
      const match = ast[0].result.match(/([\d.]+)/);
      if (match && parseFloat(match[1]) > 40) {
        return {
          shouldMonitor: true,
          reason: 'elevated_ast',
          message: `Elevated AST: ${match[1]} U/L (normal: 10-40)`
        };
      }
    }

    // Check for elevated ALT (normal: 7-56 U/L)
    const alt = query(`
      SELECT result FROM test_results 
      WHERE (test_name LIKE '%ALT%' OR test_name LIKE '%SGPT%')
      ORDER BY date DESC LIMIT 1
    `);

    if (alt.length > 0) {
      const match = alt[0].result.match(/([\d.]+)/);
      if (match && parseFloat(match[1]) > 56) {
        return {
          shouldMonitor: true,
          reason: 'elevated_alt',
          message: `Elevated ALT: ${match[1]} U/L (normal: 7-56)`
        };
      }
    }

    // Check for elevated bilirubin (normal: 0.1-1.2 mg/dL)
    const bilirubin = query(`
      SELECT result FROM test_results 
      WHERE test_name LIKE '%Bilirubin%Total%'
      ORDER BY date DESC LIMIT 1
    `);

    if (bilirubin.length > 0) {
      const match = bilirubin[0].result.match(/([\d.]+)/);
      if (match && parseFloat(match[1]) > 1.2) {
        return {
          shouldMonitor: true,
          reason: 'elevated_bilirubin',
          message: `Elevated Bilirubin: ${match[1]} mg/dL (normal: 0.1-1.2)`
        };
      }
    }

    // Check for abnormal liver imaging
    try {
      const liverImaging = query(`
        SELECT COUNT(*) as count
        FROM imaging_results
        WHERE (
          name LIKE '%liver%' OR
          name LIKE '%hepatic%' OR
          name LIKE '%abdomen%'
        ) AND (
          findings LIKE '%metast%' OR
          findings LIKE '%lesion%' OR
          findings LIKE '%mass%' OR
          findings LIKE '%abnormal%'
        )
      `);

      if (liverImaging[0]?.count > 0) {
        return {
          shouldMonitor: true,
          reason: 'abnormal_liver_imaging',
          message: 'Abnormal findings on liver imaging'
        };
      }
    } catch (err) {
      // imaging_results table might not exist
    }

    return {
      shouldMonitor: false,
      reason: 'no_indicators',
      message: 'No clinical indicators for liver health monitoring'
    };

  } catch (error) {
    console.error('Error checking liver health indicators:', error);
    return {
      shouldMonitor: false,
      reason: 'error',
      message: error.message
    };
  }
}

/**
 * Check if lung health monitoring is warranted
 */
export function shouldMonitorLungs() {
  try {
    // Check for lung metastases or nodules
    const lungMets = query(`
      SELECT COUNT(*) as count
      FROM conditions
      WHERE active = 1
        AND (
          name LIKE '%lung%metast%' OR
          name LIKE '%pulmonary%metast%' OR
          name LIKE '%lung%nodule%' OR
          notes LIKE '%lung%metast%' OR
          notes LIKE '%pulmonary%nodule%'
        )
    `);

    if (lungMets[0].count > 0) {
      return {
        shouldMonitor: true,
        reason: 'lung_metastases',
        message: 'Lung metastases or nodules detected in conditions'
      };
    }

    // Check for low oxygen saturation (<92%)
    const o2sat = query(`
      SELECT value FROM vitals 
      WHERE vital_type = 'oxygen_saturation'
      ORDER BY date DESC LIMIT 1
    `);

    if (o2sat.length > 0 && o2sat[0].value < 92) {
      return {
        shouldMonitor: true,
        reason: 'low_oxygen',
        message: `Low oxygen saturation: ${o2sat[0].value}% (normal: ≥92%)`
      };
    }

    // Check for abnormal chest imaging
    try {
      const chestImaging = query(`
        SELECT COUNT(*) as count
        FROM imaging_results
        WHERE (
          name LIKE '%chest%' OR
          name LIKE '%lung%' OR
          name LIKE '%pulmonary%' OR
          name LIKE '%thorax%'
        ) AND (
          findings LIKE '%metast%' OR
          findings LIKE '%nodule%' OR
          findings LIKE '%mass%' OR
          findings LIKE '%abnormal%' OR
          findings LIKE '%opacity%'
        )
      `);

      if (chestImaging[0]?.count > 0) {
        return {
          shouldMonitor: true,
          reason: 'abnormal_chest_imaging',
          message: 'Abnormal findings on chest imaging'
        };
      }
    } catch (err) {
      // imaging_results table might not exist
    }

    return {
      shouldMonitor: false,
      reason: 'no_indicators',
      message: 'No clinical indicators for lung health monitoring'
    };

  } catch (error) {
    console.error('Error checking lung health indicators:', error);
    return {
      shouldMonitor: false,
      reason: 'error',
      message: error.message
    };
  }
}

/**
 * Check if kidney health monitoring is warranted
 */
export function shouldMonitorKidneys() {
  try {
    // Check for kidney metastases
    const kidneyMets = query(`
      SELECT COUNT(*) as count
      FROM conditions
      WHERE active = 1
        AND (
          name LIKE '%kidney%metast%' OR
          name LIKE '%renal%metast%' OR
          notes LIKE '%kidney%metast%' OR
          notes LIKE '%renal%lesion%'
        )
    `);

    if (kidneyMets[0].count > 0) {
      return {
        shouldMonitor: true,
        reason: 'kidney_metastases',
        message: 'Kidney metastases detected in conditions'
      };
    }

    // Check for elevated creatinine (normal: 0.6-1.2 mg/dL)
    const creatinine = query(`
      SELECT result FROM test_results 
      WHERE test_name LIKE '%Creatinine%' AND test_name NOT LIKE '%Clearance%'
      ORDER BY date DESC LIMIT 1
    `);

    if (creatinine.length > 0) {
      const match = creatinine[0].result.match(/([\d.]+)/);
      if (match && parseFloat(match[1]) > 1.2) {
        return {
          shouldMonitor: true,
          reason: 'elevated_creatinine',
          message: `Elevated Creatinine: ${match[1]} mg/dL (normal: 0.6-1.2)`
        };
      }
    }

    // Check for low GFR/eGFR (normal: >60 mL/min/1.73m²)
    const gfr = query(`
      SELECT result FROM test_results 
      WHERE (test_name LIKE '%GFR%' OR test_name LIKE '%eGFR%')
      ORDER BY date DESC LIMIT 1
    `);

    if (gfr.length > 0) {
      const match = gfr[0].result.match(/([\d.]+)/);
      if (match && parseFloat(match[1]) < 60) {
        return {
          shouldMonitor: true,
          reason: 'low_gfr',
          message: `Low GFR: ${match[1]} mL/min/1.73m² (normal: >60)`
        };
      }
    }

    // Check for elevated BUN (normal: 7-20 mg/dL)
    const bun = query(`
      SELECT result FROM test_results 
      WHERE test_name LIKE '%BUN%' OR test_name LIKE '%Blood Urea Nitrogen%'
      ORDER BY date DESC LIMIT 1
    `);

    if (bun.length > 0) {
      const match = bun[0].result.match(/([\d.]+)/);
      if (match && parseFloat(match[1]) > 20) {
        return {
          shouldMonitor: true,
          reason: 'elevated_bun',
          message: `Elevated BUN: ${match[1]} mg/dL (normal: 7-20)`
        };
      }
    }

    // Check for abnormal renal imaging
    try {
      const renalImaging = query(`
        SELECT COUNT(*) as count
        FROM imaging_results
        WHERE (
          name LIKE '%kidney%' OR
          name LIKE '%renal%' OR
          name LIKE '%abdomen%'
        ) AND (
          findings LIKE '%metast%' OR
          findings LIKE '%lesion%' OR
          findings LIKE '%mass%' OR
          findings LIKE '%abnormal%'
        )
      `);

      if (renalImaging[0]?.count > 0) {
        return {
          shouldMonitor: true,
          reason: 'abnormal_renal_imaging',
          message: 'Abnormal findings on renal imaging'
        };
      }
    } catch (err) {
      // imaging_results table might not exist
    }

    return {
      shouldMonitor: false,
      reason: 'no_indicators',
      message: 'No clinical indicators for kidney health monitoring'
    };

  } catch (error) {
    console.error('Error checking kidney health indicators:', error);
    return {
      shouldMonitor: false,
      reason: 'error',
      message: error.message
    };
  }
}

/**
 * Check if lymphatic system monitoring is warranted
 */
export function shouldMonitorLymphatic() {
  try {
    // Check for lymph node metastases or lymphadenopathy
    const lymphMets = query(`
      SELECT COUNT(*) as count
      FROM conditions
      WHERE active = 1
        AND (
          name LIKE '%lymph%node%metast%' OR
          name LIKE '%lymphadenopathy%' OR
          name LIKE '%lymphedema%' OR
          notes LIKE '%lymph%node%metast%' OR
          notes LIKE '%lymphadenopathy%' OR
          notes LIKE '%lymphedema%'
        )
    `);

    if (lymphMets[0].count > 0) {
      return {
        shouldMonitor: true,
        reason: 'lymph_node_involvement',
        message: 'Lymph node metastases or lymphadenopathy detected in conditions'
      };
    }

    // Check for low lymphocyte count (lymphopenia) - normal: 1.0-4.8 K/μL
    const lymphocyteAbs = query(`
      SELECT result FROM test_results 
      WHERE (test_name LIKE '%Lymphocyte%Absolute%' OR test_name LIKE '%Lymphocytes%Absolute%')
        AND test_name NOT LIKE '%Large%'
      ORDER BY date DESC LIMIT 1
    `);

    if (lymphocyteAbs.length > 0) {
      const match = lymphocyteAbs[0].result.match(/([\d.]+)/);
      if (match) {
        const value = parseFloat(match[1]);
        if (value < 1.0) {
          return {
            shouldMonitor: true,
            reason: 'lymphopenia',
            message: `Low Lymphocyte Count: ${value} K/μL (normal: 1.0-4.8) - Lymphopenia`
          };
        }
        if (value > 4.8) {
          return {
            shouldMonitor: true,
            reason: 'lymphocytosis',
            message: `Elevated Lymphocyte Count: ${value} K/μL (normal: 1.0-4.8) - Lymphocytosis`
          };
        }
      }
    }

    // Check for abnormal lymph node imaging
    try {
      const lymphImaging = query(`
        SELECT COUNT(*) as count
        FROM imaging_results
        WHERE (
          name LIKE '%lymph%node%' OR
          name LIKE '%neck%' OR
          name LIKE '%axilla%' OR
          name LIKE '%groin%' OR
          name LIKE '%mediastin%' OR
          findings LIKE '%lymphadenopathy%'
        ) AND (
          findings LIKE '%enlarged%' OR
          findings LIKE '%metast%' OR
          findings LIKE '%lymphadenopathy%' OR
          findings LIKE '%suspicious%'
        )
      `);

      if (lymphImaging[0]?.count > 0) {
        return {
          shouldMonitor: true,
          reason: 'abnormal_lymph_imaging',
          message: 'Enlarged or abnormal lymph nodes on imaging'
        };
      }
    } catch (err) {
      // imaging_results table might not exist
    }

    // Check for severely low WBC (often accompanies lymphopenia during chemo)
    const wbc = query(`
      SELECT result FROM test_results 
      WHERE test_name LIKE '%WBC%' OR test_name LIKE '%White Blood%'
      ORDER BY date DESC LIMIT 1
    `);

    if (wbc.length > 0) {
      const match = wbc[0].result.match(/([\d.]+)/);
      if (match && parseFloat(match[1]) < 3.5) {
        return {
          shouldMonitor: true,
          reason: 'leukopenia',
          message: `Low WBC: ${match[1]} K/μL (normal: 3.5-10.5) - Increased infection risk`
        };
      }
    }

    return {
      shouldMonitor: false,
      reason: 'no_indicators',
      message: 'No clinical indicators for lymphatic system monitoring'
    };

  } catch (error) {
    console.error('Error checking lymphatic system indicators:', error);
    return {
      shouldMonitor: false,
      reason: 'error',
      message: error.message
    };
  }
}

/**
 * Get all organ health statuses at once
 */
export function getAllOrganStatuses() {
  return {
    bone: shouldMonitorBone(),
    liver: shouldMonitorLiver(),
    lungs: shouldMonitorLungs(),
    kidneys: shouldMonitorKidneys(),
    lymphatic: shouldMonitorLymphatic()
  };
}

/**
 * Check if bone health monitoring is warranted (imported from bone-health.js logic)
 */
function shouldMonitorBone() {
  try {
    const boneMets = query(`
      SELECT COUNT(*) as count
      FROM conditions
      WHERE active = 1
        AND (
          name LIKE '%bone%metast%' OR
          name LIKE '%osseous%' OR
          name LIKE '%skeletal%metast%' OR
          notes LIKE '%bone%metast%' OR
          notes LIKE '%osseous%lesion%'
        )
    `);

    if (boneMets[0].count > 0) {
      return {
        shouldMonitor: true,
        reason: 'bone_metastases',
        message: 'Bone metastases or osseous lesions detected'
      };
    }

    const alkPhos = query(`
      SELECT result FROM test_results 
      WHERE (test_name LIKE '%Alk%Phos%' OR test_name LIKE '%Alkaline%Phosphatase%')
      ORDER BY date DESC LIMIT 1
    `);

    if (alkPhos.length > 0) {
      const match = alkPhos[0].result.match(/([\d.]+)/);
      if (match && parseFloat(match[1]) > 147) {
        return {
          shouldMonitor: true,
          reason: 'elevated_alk_phos',
          message: `Elevated Alkaline Phosphatase: ${match[1]} U/L (normal: 39-147)`
        };
      }
    }

    return {
      shouldMonitor: false,
      reason: 'no_indicators',
      message: 'No clinical indicators for bone health monitoring'
    };

  } catch (error) {
    return {
      shouldMonitor: false,
      reason: 'error',
      message: error.message
    };
  }
}

/**
 * Get summary of which organs need monitoring
 */
export function getMonitoringSummary() {
  const statuses = getAllOrganStatuses();
  
  const needsMonitoring = Object.entries(statuses)
    .filter(([_, status]) => status.shouldMonitor)
    .map(([organ, status]) => ({
      organ,
      reason: status.reason,
      message: status.message
    }));

  return {
    totalOrgans: Object.keys(statuses).length,
    organsNeedingMonitoring: needsMonitoring.length,
    organs: needsMonitoring,
    allStatuses: statuses
  };
}
