/**
 * Medications & Supplements API
 * CRUD operations for medications, supplements, and research articles
 */

import { query, run } from './db-secure.js';

/**
 * Get all medications (with optional filters)
 */
export const getAllMedications = (filters = {}) => {
  let sql = 'SELECT * FROM medications_enhanced WHERE 1=1';
  const params = [];

  if (filters.type) {
    sql += ' AND type = ?';
    params.push(filters.type);
  }

  if (filters.active !== undefined) {
    sql += ' AND active = ?';
    params.push(filters.active ? 1 : 0);
  }

  sql += ' ORDER BY active DESC, started_date DESC, name ASC';

  return query(sql, params);
};

/**
 * Get a single medication by ID
 */
export const getMedicationById = (id) => {
  const results = query('SELECT * FROM medications_enhanced WHERE id = ?', [id]);
  return results.length > 0 ? results[0] : null;
};

/**
 * Create a new medication
 */
export const createMedication = (medicationData) => {
  const {
    name,
    type,
    category,
    dosage,
    frequency,
    route,
    started_date,
    stopped_date,
    active,
    reason,
    prescribed_by,
    mechanism,
    target_pathways,
    genomic_alignment,
    evidence_strength,
    recommended_dosing,
    precautions,
    interactions,
    notes,
    effectiveness_rating
  } = medicationData;

  const sql = `
    INSERT INTO medications_enhanced (
      name, type, category, dosage, frequency, route,
      started_date, stopped_date, active, reason, prescribed_by,
      mechanism, target_pathways, genomic_alignment, evidence_strength,
      recommended_dosing, precautions, interactions, notes, effectiveness_rating
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const result = run(sql, [
    name,
    type || 'supplement',
    category,
    dosage,
    frequency,
    route || 'oral',
    started_date,
    stopped_date,
    active !== undefined ? (active ? 1 : 0) : 1,
    reason,
    prescribed_by,
    mechanism,
    target_pathways,
    genomic_alignment,
    evidence_strength,
    recommended_dosing,
    precautions,
    interactions,
    notes,
    effectiveness_rating
  ]);

  return { id: result.lastInsertRowid };
};

/**
 * Update a medication
 */
export const updateMedication = (id, medicationData) => {
  const {
    name,
    type,
    category,
    dosage,
    frequency,
    route,
    started_date,
    stopped_date,
    active,
    reason,
    prescribed_by,
    mechanism,
    target_pathways,
    genomic_alignment,
    evidence_strength,
    recommended_dosing,
    precautions,
    interactions,
    notes,
    effectiveness_rating
  } = medicationData;

  const sql = `
    UPDATE medications_enhanced SET
      name = ?,
      type = ?,
      category = ?,
      dosage = ?,
      frequency = ?,
      route = ?,
      started_date = ?,
      stopped_date = ?,
      active = ?,
      reason = ?,
      prescribed_by = ?,
      mechanism = ?,
      target_pathways = ?,
      genomic_alignment = ?,
      evidence_strength = ?,
      recommended_dosing = ?,
      precautions = ?,
      interactions = ?,
      notes = ?,
      effectiveness_rating = ?
    WHERE id = ?
  `;

  run(sql, [
    name,
    type,
    category,
    dosage,
    frequency,
    route,
    started_date,
    stopped_date,
    active !== undefined ? (active ? 1 : 0) : 1,
    reason,
    prescribed_by,
    mechanism,
    target_pathways,
    genomic_alignment,
    evidence_strength,
    recommended_dosing,
    precautions,
    interactions,
    notes,
    effectiveness_rating,
    id
  ]);

  return { id };
};

/**
 * Delete a medication
 */
export const deleteMedication = (id) => {
  run('DELETE FROM medications_enhanced WHERE id = ?', [id]);
  return { id };
};

/**
 * Get research articles for a medication
 */
export const getResearchArticles = (medicationId) => {
  return query(
    'SELECT * FROM medication_research WHERE medication_id = ? ORDER BY publication_year DESC',
    [medicationId]
  );
};

/**
 * Add a research article to a medication
 */
export const addResearchArticle = (articleData) => {
  const {
    medication_id,
    title,
    authors,
    journal,
    publication_year,
    abstract,
    url,
    pubmed_id,
    doi,
    article_type,
    evidence_quality,
    key_findings,
    relevance
  } = articleData;

  const sql = `
    INSERT INTO medication_research (
      medication_id, title, authors, journal, publication_year,
      abstract, url, pubmed_id, doi, article_type, evidence_quality,
      key_findings, relevance
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const result = run(sql, [
    medication_id,
    title,
    authors,
    journal,
    publication_year,
    abstract,
    url,
    pubmed_id,
    doi,
    article_type || 'supporting',
    evidence_quality,
    key_findings,
    relevance
  ]);

  return { id: result.lastInsertRowid };
};

/**
 * Delete a research article
 */
export const deleteResearchArticle = (id) => {
  run('DELETE FROM medication_research WHERE id = ?', [id]);
  return { id };
};

/**
 * Get medication log entries (dosing history)
 */
export const getMedicationLog = (medicationId, limit = 30) => {
  return query(
    `SELECT * FROM medication_log 
     WHERE medication_id = ? 
     ORDER BY taken_date DESC, taken_time DESC 
     LIMIT ?`,
    [medicationId, limit]
  );
};

/**
 * Log a dose taken
 */
export const logDoseTaken = (logData) => {
  const {
    medication_id,
    taken_date,
    taken_time,
    dosage_taken,
    notes,
    missed
  } = logData;

  const sql = `
    INSERT INTO medication_log (
      medication_id, taken_date, taken_time, dosage_taken, notes, missed
    ) VALUES (?, ?, ?, ?, ?, ?)
  `;

  const result = run(sql, [
    medication_id,
    taken_date,
    taken_time,
    dosage_taken,
    notes,
    missed ? 1 : 0
  ]);

  return { id: result.lastInsertRowid };
};

/**
 * Get medication statistics (adherence, effectiveness over time)
 */
export const getMedicationStats = (medicationId) => {
  const medication = getMedicationById(medicationId);
  if (!medication) return null;

  // Get log entries for the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

  const logEntries = query(
    `SELECT * FROM medication_log 
     WHERE medication_id = ? AND taken_date >= ?
     ORDER BY taken_date DESC`,
    [medicationId, dateStr]
  );

  const totalDoses = logEntries.length;
  const missedDoses = logEntries.filter(log => log.missed).length;
  const adherenceRate = totalDoses > 0 
    ? ((totalDoses - missedDoses) / totalDoses * 100).toFixed(1)
    : 0;

  // Get research article count
  const researchCount = query(
    'SELECT COUNT(*) as count FROM medication_research WHERE medication_id = ?',
    [medicationId]
  )[0].count;

  return {
    medication,
    stats: {
      totalDoses,
      missedDoses,
      adherenceRate: parseFloat(adherenceRate),
      researchArticles: researchCount,
      daysActive: logEntries.length > 0 ? 
        new Set(logEntries.map(log => log.taken_date)).size : 0
    },
    recentLog: logEntries.slice(0, 10)
  };
};

/**
 * Search medications by name, type, or category
 */
export const searchMedications = (searchTerm, filters = {}) => {
  let sql = `
    SELECT * FROM medications_enhanced 
    WHERE (
      name LIKE ? OR 
      category LIKE ? OR 
      reason LIKE ? OR
      notes LIKE ?
    )
  `;
  const params = [
    `%${searchTerm}%`,
    `%${searchTerm}%`,
    `%${searchTerm}%`,
    `%${searchTerm}%`
  ];

  if (filters.type) {
    sql += ' AND type = ?';
    params.push(filters.type);
  }

  if (filters.active !== undefined) {
    sql += ' AND active = ?';
    params.push(filters.active ? 1 : 0);
  }

  sql += ' ORDER BY active DESC, name ASC';

  return query(sql, params);
};
