/**
 * radiology-triggers.js
 * Queries medical_documents (radiology reports + doctor's notes) for organ-specific findings.
 * Used by all organ health trackers to incorporate imaging data alongside lab results.
 */

import { query } from './db-secure.js';

// Which body_regions_affected regions map to each organ system
const ORGAN_REGION_MAP = {
  bone: [
    'spine', 'left-hip', 'right-hip', 'left-shoulder', 'right-shoulder',
    'left-arm', 'right-arm', 'left-leg', 'right-leg', 'pelvis', 'soft-tissue',
  ],
  kidney: ['left-kidney', 'right-kidney', 'left-adrenal', 'right-adrenal'],
  liver: ['liver', 'spleen'],
  lung:  ['left-lung', 'right-lung', 'heart'],
  lymph: ['left-lymph-node', 'right-lymph-node', 'abdominal-lymph-nodes'],
  bladder: ['bladder', 'pelvis', 'peritoneum'],
};

// Finding types that should trigger monitoring
const CONCERNING_TYPES = new Set([
  'metastasis', 'primary-tumor', 'mass', 'lymphadenopathy', 'suspicious', 'other',
]);

/**
 * Get imaging findings from uploaded radiology reports for a given organ system.
 * Returns array of { docDate, docTitle, region, finding, type, size_mm, docId }
 */
export function getRadiologyFindingsForOrgan(organKey) {
  const regionList = ORGAN_REGION_MAP[organKey] || [];
  if (!regionList.length) return [];

  try {
    // Pull all radiology reports that have body_regions_affected data
    const docs = query(`
      SELECT id, title, date, provider, body_regions_affected, critical_findings
      FROM medical_documents
      WHERE document_type = 'radiology'
        AND body_regions_affected IS NOT NULL
        AND body_regions_affected != '[]'
      ORDER BY date DESC
    `, []);

    const findings = [];

    for (const doc of docs) {
      let regions = [];
      try { regions = JSON.parse(doc.body_regions_affected); } catch { continue; }

      for (const r of regions) {
        if (regionList.includes(r.region) && CONCERNING_TYPES.has(r.type)) {
          findings.push({
            docId:    doc.id,
            docDate:  doc.date,
            docTitle: doc.title || 'Radiology Report',
            provider: doc.provider,
            region:   r.region,
            finding:  r.finding,
            type:     r.type,
            size_mm:  r.size_mm || null,
          });
        }
      }
    }

    return findings;
  } catch (err) {
    console.error('[RadiologyTriggers] Query failed:', err.message);
    return [];
  }
}

/**
 * Check critical_findings text from radiology reports for organ-specific keywords.
 * Catches cases where the AI didn't map to a specific region but described it in text.
 */
export function getCriticalFindingsByKeyword(keywords = []) {
  if (!keywords.length) return [];
  try {
    const docs = query(`
      SELECT id, title, date, provider, critical_findings, impression, summary
      FROM medical_documents
      WHERE document_type = 'radiology'
        AND (critical_findings IS NOT NULL OR impression IS NOT NULL)
      ORDER BY date DESC
      LIMIT 20
    `, []);

    const hits = [];
    for (const doc of docs) {
      const text = [
        doc.critical_findings || '',
        doc.impression || '',
        doc.summary || '',
      ].join(' ').toLowerCase();

      const matched = keywords.filter(kw => text.includes(kw.toLowerCase()));
      if (matched.length) {
        hits.push({
          docId:    doc.id,
          docDate:  doc.date,
          docTitle: doc.title || 'Radiology Report',
          provider: doc.provider,
          keywords: matched,
          snippet:  doc.summary || doc.impression?.slice(0, 200),
        });
      }
    }
    return hits;
  } catch (err) {
    console.error('[RadiologyTriggers] Keyword search failed:', err.message);
    return [];
  }
}

/**
 * Get a summary of ALL recent radiology findings across all organ systems.
 * Used for the dashboard overview.
 */
export function getAllRecentRadiologyFindings(limitDays = 365) {
  try {
    const cutoff = new Date(Date.now() - limitDays * 86400000).toISOString().split('T')[0];
    const docs = query(`
      SELECT id, title, date, provider, modality, body_region,
             body_regions_affected, critical_findings, summary, impression
      FROM medical_documents
      WHERE document_type = 'radiology'
        AND (date >= ? OR date IS NULL)
      ORDER BY date DESC
    `, [cutoff]);

    return docs.map(doc => {
      let regions = [];
      try { regions = JSON.parse(doc.body_regions_affected || '[]'); } catch {}
      return { ...doc, body_regions_affected: regions };
    });
  } catch (err) {
    console.error('[RadiologyTriggers] getAllRecent failed:', err.message);
    return [];
  }
}
