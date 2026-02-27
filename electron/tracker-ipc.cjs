'use strict';

/**
 * tracker-ipc.cjs — Exercise & Pain tracker IPC handlers
 * Follows the same pattern as db-ipc.cjs / organ-health-ipc.cjs
 */

const path = require('path');
const Database = require('better-sqlite3');

let _db = null;

function getDb(app) {
  if (_db) return _db;
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'data', 'health-secure.db');
  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  return _db;
}

// ─── Exercise ─────────────────────────────────────────────────────────────────

function getExerciseLogs(app, { limit = 100, offset = 0 } = {}) {
  const db = getDb(app);
  return db.prepare(`
    SELECT * FROM exercise_logs
    ORDER BY date DESC, time DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
}

function addExerciseLog(app, data) {
  const db = getDb(app);
  const {
    date, time, type, duration_min, intensity,
    distance_miles, calories, heart_rate_avg, heart_rate_max,
    steps, sets, reps, weight_lbs, notes
  } = data;
  const result = db.prepare(`
    INSERT INTO exercise_logs
      (date, time, type, duration_min, intensity, distance_miles, calories,
       heart_rate_avg, heart_rate_max, steps, sets, reps, weight_lbs, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    date, time || null, type, duration_min || null, intensity || null,
    distance_miles || null, calories || null, heart_rate_avg || null,
    heart_rate_max || null, steps || null, sets || null, reps || null,
    weight_lbs || null, notes || null
  );
  return { id: result.lastInsertRowid, ...data };
}

function updateExerciseLog(app, id, data) {
  const db = getDb(app);
  const fields = Object.entries(data)
    .filter(([k]) => k !== 'id')
    .map(([k]) => `${k} = ?`).join(', ');
  const values = Object.entries(data)
    .filter(([k]) => k !== 'id')
    .map(([, v]) => v);
  db.prepare(`UPDATE exercise_logs SET ${fields} WHERE id = ?`).run(...values, id);
  return { id, ...data };
}

function deleteExerciseLog(app, id) {
  const db = getDb(app);
  db.prepare('DELETE FROM exercise_logs WHERE id = ?').run(id);
  return { deleted: id };
}

function getExerciseStats(app) {
  const db = getDb(app);
  const last30 = db.prepare(`
    SELECT
      COUNT(*) as sessions,
      ROUND(AVG(duration_min), 1) as avg_duration,
      SUM(duration_min) as total_minutes,
      SUM(calories) as total_calories,
      SUM(steps) as total_steps,
      SUM(distance_miles) as total_miles
    FROM exercise_logs
    WHERE date >= date('now', '-30 days')
  `).get();

  const byType = db.prepare(`
    SELECT type, COUNT(*) as count
    FROM exercise_logs
    WHERE date >= date('now', '-30 days')
    GROUP BY type
    ORDER BY count DESC
  `).all();

  const weekly = db.prepare(`
    SELECT
      strftime('%Y-W%W', date) as week,
      COUNT(*) as sessions,
      SUM(duration_min) as total_minutes
    FROM exercise_logs
    WHERE date >= date('now', '-90 days')
    GROUP BY week
    ORDER BY week DESC
    LIMIT 12
  `).all();

  return { last30, byType, weekly };
}

// ─── Pain ─────────────────────────────────────────────────────────────────────

function getPainLogs(app, { limit = 100, offset = 0 } = {}) {
  const db = getDb(app);
  return db.prepare(`
    SELECT * FROM pain_logs
    ORDER BY date DESC, time DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
}

function addPainLog(app, data) {
  const db = getDb(app);
  const { date, time, pain_level, location, type, triggers, relieved_by, duration_min, notes } = data;
  const result = db.prepare(`
    INSERT INTO pain_logs
      (date, time, pain_level, location, type, triggers, relieved_by, duration_min, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    date, time || null, pain_level, location || null, type || null,
    triggers || null, relieved_by || null, duration_min || null, notes || null
  );
  return { id: result.lastInsertRowid, ...data };
}

function updatePainLog(app, id, data) {
  const db = getDb(app);
  const fields = Object.entries(data)
    .filter(([k]) => k !== 'id')
    .map(([k]) => `${k} = ?`).join(', ');
  const values = Object.entries(data)
    .filter(([k]) => k !== 'id')
    .map(([, v]) => v);
  db.prepare(`UPDATE pain_logs SET ${fields} WHERE id = ?`).run(...values, id);
  return { id, ...data };
}

function deletePainLog(app, id) {
  const db = getDb(app);
  db.prepare('DELETE FROM pain_logs WHERE id = ?').run(id);
  return { deleted: id };
}

function getPainStats(app) {
  const db = getDb(app);
  const last30 = db.prepare(`
    SELECT
      COUNT(*) as entries,
      ROUND(AVG(pain_level), 1) as avg_pain,
      MAX(pain_level) as max_pain,
      MIN(pain_level) as min_pain
    FROM pain_logs
    WHERE date >= date('now', '-30 days')
  `).get();

  const byLocation = db.prepare(`
    SELECT location, COUNT(*) as count, ROUND(AVG(pain_level), 1) as avg_pain
    FROM pain_logs
    WHERE date >= date('now', '-30 days') AND location IS NOT NULL
    GROUP BY location
    ORDER BY count DESC
  `).all();

  const trend = db.prepare(`
    SELECT date, ROUND(AVG(pain_level), 1) as avg_pain
    FROM pain_logs
    WHERE date >= date('now', '-30 days')
    GROUP BY date
    ORDER BY date ASC
  `).all();

  return { last30, byLocation, trend };
}

module.exports = {
  getExerciseLogs,
  addExerciseLog,
  updateExerciseLog,
  deleteExerciseLog,
  getExerciseStats,
  getPainLogs,
  addPainLog,
  updatePainLog,
  deletePainLog,
  getPainStats,
};
