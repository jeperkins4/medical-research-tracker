/**
 * Radiology API - Manage imaging studies and 3D viewer data
 * Provides data for RadiologyViewer component
 */

import { query, run } from './db.js';

/**
 * Get all radiology studies, most recent first
 */
export function getStudies() {
  return query(`
    SELECT s.*,
      (SELECT COUNT(*) FROM radiology_series WHERE study_id = s.id) as series_count,
      (SELECT COUNT(*) FROM radiology_annotations WHERE study_id = s.id) as annotation_count
    FROM radiology_studies s
    ORDER BY s.study_date DESC
  `);
}

/**
 * Get a single study with its series and annotations
 */
export function getStudy(id) {
  const studies = query('SELECT * FROM radiology_studies WHERE id = ?', [id]);
  if (studies.length === 0) return null;

  const study = studies[0];
  study.series = query(
    'SELECT * FROM radiology_series WHERE study_id = ? ORDER BY series_number',
    [id]
  );
  study.annotations = query(
    'SELECT * FROM radiology_annotations WHERE study_id = ? ORDER BY created_at',
    [id]
  );
  return study;
}

/**
 * Create a new radiology study
 */
export function createStudy({ study_date, modality, body_region, description, facility, ordering_physician, findings, impression }) {
  const result = run(
    `INSERT INTO radiology_studies (study_date, modality, body_region, description, facility, ordering_physician, findings, impression)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [study_date, modality, body_region, description || null, facility || null, ordering_physician || null, findings || null, impression || null]
  );
  return getStudy(result.lastInsertRowid);
}

/**
 * Update a radiology study
 */
export function updateStudy(id, fields) {
  const allowed = ['study_date', 'modality', 'body_region', 'description', 'facility', 'ordering_physician', 'status', 'findings', 'impression', 'comparison_notes'];
  const updates = [];
  const values = [];

  for (const key of allowed) {
    if (key in fields) {
      updates.push(`${key} = ?`);
      values.push(fields[key]);
    }
  }

  if (updates.length === 0) return getStudy(id);

  values.push(id);
  run(`UPDATE radiology_studies SET ${updates.join(', ')} WHERE id = ?`, values);
  return getStudy(id);
}

/**
 * Delete a radiology study
 */
export function deleteStudy(id) {
  return run('DELETE FROM radiology_studies WHERE id = ?', [id]);
}

/**
 * Add an annotation to a study
 */
export function addAnnotation(study_id, { label, description, position_x, position_y, position_z, slice_index, plane, color }) {
  const result = run(
    `INSERT INTO radiology_annotations (study_id, label, description, position_x, position_y, position_z, slice_index, plane, color)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [study_id, label, description || null, position_x || 0, position_y || 0, position_z || 0, slice_index || 0, plane || 'axial', color || '#ff6b6b']
  );
  return query('SELECT * FROM radiology_annotations WHERE id = ?', [result.lastInsertRowid])[0];
}

/**
 * Delete an annotation
 */
export function deleteAnnotation(id) {
  return run('DELETE FROM radiology_annotations WHERE id = ?', [id]);
}

/**
 * Get study timeline for comparison view
 */
export function getStudyTimeline(body_region) {
  const params = body_region ? [body_region] : [];
  const where = body_region ? 'WHERE body_region = ?' : '';
  return query(`
    SELECT id, study_date, modality, body_region, description, findings, impression
    FROM radiology_studies
    ${where}
    ORDER BY study_date ASC
  `, params);
}

/**
 * Get available modalities and body regions for filtering
 */
export function getFilterOptions() {
  const modalities = query('SELECT DISTINCT modality FROM radiology_studies ORDER BY modality');
  const bodyRegions = query('SELECT DISTINCT body_region FROM radiology_studies ORDER BY body_region');
  return {
    modalities: modalities.map(r => r.modality),
    bodyRegions: bodyRegions.map(r => r.body_region)
  };
}

/**
 * Generate demo volume data for 3D viewer
 * Returns a 3D array representing a synthetic CT-like volume
 * This is used when no actual DICOM data is available
 */
export function generateDemoVolume(studyId) {
  const study = getStudy(studyId);
  if (!study) return null;

  // Generate a synthetic volume based on study metadata
  const size = 64; // 64x64x64 voxel grid
  const volume = [];

  for (let z = 0; z < size; z++) {
    const slice = [];
    for (let y = 0; y < size; y++) {
      const row = [];
      for (let x = 0; x < size; x++) {
        // Normalized coordinates [-1, 1]
        const nx = (x / size) * 2 - 1;
        const ny = (y / size) * 2 - 1;
        const nz = (z / size) * 2 - 1;

        // Base body ellipsoid
        const bodyDist = Math.sqrt(nx * nx * 1.2 + ny * ny + nz * nz * 0.8);
        let value = bodyDist < 0.85 ? 0.3 : 0;

        // Spine (bright, central column)
        const spineDist = Math.sqrt(nx * nx + (nz - 0.1) * (nz - 0.1));
        if (spineDist < 0.08 && Math.abs(ny) < 0.7) {
          value = 0.9;
        }

        // Ribs (curved structures)
        if (Math.abs(ny) < 0.35 && Math.abs(ny) > 0.05) {
          const ribRadius = 0.35 - Math.abs(ny) * 0.3;
          const ribDist = Math.sqrt(nx * nx + nz * nz) - ribRadius;
          if (Math.abs(ribDist) < 0.03) {
            value = 0.85;
          }
        }

        // Organs (soft tissue)
        // Left kidney
        const lkDist = Math.sqrt((nx + 0.3) * (nx + 0.3) + (ny + 0.1) * (ny + 0.1) * 4 + nz * nz * 2);
        if (lkDist < 0.2) value = 0.45;

        // Right kidney
        const rkDist = Math.sqrt((nx - 0.3) * (nx - 0.3) + (ny + 0.1) * (ny + 0.1) * 4 + nz * nz * 2);
        if (rkDist < 0.2) value = 0.45;

        // Simulated lesion based on study type
        if (study.body_region === 'Pelvis' || study.body_region === 'Abdomen/Pelvis') {
          const lesionDist = Math.sqrt((nx - 0.15) * (nx - 0.15) + (ny + 0.3) * (ny + 0.3) + nz * nz);
          if (lesionDist < 0.12) {
            value = 0.65;
          }
        }

        row.push(Math.min(1, Math.max(0, value)));
      }
      slice.push(row);
    }
    volume.push(slice);
  }

  return {
    size: [size, size, size],
    spacing: [1, 1, 1],
    data: volume
  };
}
