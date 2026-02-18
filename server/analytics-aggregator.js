/**
 * HIPAA-Compliant Analytics Aggregator
 * 
 * This service generates de-identified, aggregated analytics from encrypted patient data.
 * It runs nightly via cron to update analytics tables.
 * 
 * HIPAA Compliance:
 * - Safe Harbor de-identification (§164.514(b)(2))
 * - Minimum cell size: 11 (suppress smaller groups to prevent re-identification)
 * - No individual identifiers
 * - No dates except year
 * - No geographic data smaller than state
 * - Audit trail for all operations
 */

import { getDb, init as initDb, run, query } from './db-secure.js';

// Minimum cell size for HIPAA compliance (prevent re-identification)
export const MIN_CELL_SIZE = 11;

/**
 * Generate all analytics aggregates
 */
export async function generateAllAnalytics() {
  console.log('🔒 Starting HIPAA-compliant analytics aggregation...');
  
  try {
    // Ensure database is initialized
    const db = getDb();
    if (!db) {
      console.log('⏳ Initializing database...');
      await initDb();
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    // 1. User metrics (counts only)
    await generateUserMetrics(today);
    
    // 2. Diagnosis aggregates
    await generateDiagnosisAggregates();
    
    // 3. Mutation aggregates
    await generateMutationAggregates();
    
    // 4. Treatment aggregates
    await generateTreatmentAggregates();
    
    // 5. Demographics (HIPAA-compliant ranges)
    await generateDemographics();
    
    console.log('✅ Analytics aggregation complete (HIPAA-compliant)');
  } catch (error) {
    console.error('❌ Analytics aggregation failed:', error);
    throw error;
  }
}

/**
 * Generate user metrics (total users, new users, active users)
 */
function generateUserMetrics(date) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    // Total users
    db.get('SELECT COUNT(*) as total FROM users', (err, totalResult) => {
      if (err) return reject(err);
      
      // New users today (using created_at if available)
      db.get(
        `SELECT COUNT(*) as new_today 
         FROM users 
         WHERE DATE(created_at) = ?`,
        [date],
        (err, newResult) => {
          if (err) return reject(err);
          
          // Active users in last 30 days (using last_login if available)
          db.get(
            `SELECT COUNT(*) as active_30d 
             FROM users 
             WHERE last_login >= DATE('now', '-30 days')`,
            (err, activeResult) => {
              if (err) {
                // If last_login column doesn't exist, skip this metric
                activeResult = { active_30d: null };
              }
              
              // Insert/update metrics
              db.run(
                `INSERT OR REPLACE INTO analytics_user_metrics 
                 (metric_date, total_users, new_users_today, active_users_30d) 
                 VALUES (?, ?, ?, ?)`,
                [date, totalResult.total, newResult?.new_today || 0, activeResult?.active_30d],
                (err) => {
                  if (err) return reject(err);
                  console.log(`  ✓ User metrics: ${totalResult.total} total users`);
                  resolve();
                }
              );
            }
          );
        }
      );
    });
  });
}

/**
 * Generate diagnosis aggregates (cancer type, stage)
 * HIPAA: Suppress counts < 11
 */
function generateDiagnosisAggregates() {
  return new Promise((resolve, reject) => {
    const db = getDb();
    // Get diagnosis counts grouped by type/stage
    db.all(
      `SELECT 
        name as diagnosis_type,
        name as cancer_type,
        status as stage,
        COUNT(*) as patient_count
       FROM conditions
       WHERE name IS NOT NULL
       GROUP BY name, status
       HAVING COUNT(*) >= ?`, // HIPAA: Minimum cell size
      [MIN_CELL_SIZE],
      (err, rows) => {
        if (err) return reject(err);
        
        // Clear old aggregates
        db.run('DELETE FROM analytics_diagnosis_aggregates', (err) => {
          if (err) return reject(err);
          
          // Insert new aggregates
          const stmt = db.prepare(
            `INSERT INTO analytics_diagnosis_aggregates 
             (diagnosis_type, cancer_type, stage, patient_count) 
             VALUES (?, ?, ?, ?)`
          );
          
          rows.forEach(row => {
            stmt.run(
              row.diagnosis_type,
              row.cancer_type,
              row.stage,
              row.patient_count
            );
          });
          
          stmt.finalize((err) => {
            if (err) return reject(err);
            console.log(`  ✓ Diagnosis aggregates: ${rows.length} groups (min ${MIN_CELL_SIZE} patients each)`);
            resolve();
          });
        });
      }
    );
  });
}

/**
 * Generate mutation aggregates (gene name, type)
 * HIPAA: Suppress counts < 11
 */
function generateMutationAggregates() {
  return new Promise((resolve, reject) => {
    const db = getDb();
    // Check if mutations table exists
    db.get(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='mutations'`,
      (err, table) => {
        if (err || !table) {
          console.log('  ⊘ Mutations table not found, skipping');
          return resolve();
        }
        
        db.all(
          `SELECT 
            gene as gene_name,
            alteration as mutation_type,
            COUNT(DISTINCT user_id) as patient_count
           FROM mutations
           WHERE gene IS NOT NULL
           GROUP BY gene, alteration
           HAVING COUNT(DISTINCT user_id) >= ?`, // HIPAA: Minimum cell size
          [MIN_CELL_SIZE],
          (err, rows) => {
            if (err) return reject(err);
            
            // Clear old aggregates
            db.run('DELETE FROM analytics_mutation_aggregates', (err) => {
              if (err) return reject(err);
              
              // Insert new aggregates
              const stmt = db.prepare(
                `INSERT INTO analytics_mutation_aggregates 
                 (gene_name, mutation_type, patient_count) 
                 VALUES (?, ?, ?)`
              );
              
              rows.forEach(row => {
                stmt.run(
                  row.gene_name,
                  row.mutation_type,
                  row.patient_count
                );
              });
              
              stmt.finalize((err) => {
                if (err) return reject(err);
                console.log(`  ✓ Mutation aggregates: ${rows.length} groups (min ${MIN_CELL_SIZE} patients each)`);
                resolve();
              });
            });
          }
        );
      }
    );
  });
}

/**
 * Generate treatment aggregates (medication name, type)
 * HIPAA: Suppress counts < 11
 */
function generateTreatmentAggregates() {
  return new Promise((resolve, reject) => {
    const db = getDb();
    // Check which medications table exists
    db.get(
      `SELECT name FROM sqlite_master WHERE type='table' AND (name='medications' OR name='medications_enhanced')`,
      (err, table) => {
        if (err || !table) {
          console.log('  ⊘ Medications table not found, skipping');
          return resolve();
        }
        
        const tableName = table.name;
        
        db.all(
          `SELECT 
            name as treatment_name,
            type as treatment_type,
            COUNT(DISTINCT user_id) as patient_count
           FROM ${tableName}
           WHERE name IS NOT NULL
           GROUP BY name, type
           HAVING COUNT(DISTINCT user_id) >= ?`, // HIPAA: Minimum cell size
          [MIN_CELL_SIZE],
          (err, rows) => {
            if (err) return reject(err);
            
            // Clear old aggregates
            db.run('DELETE FROM analytics_treatment_aggregates', (err) => {
              if (err) return reject(err);
              
              // Insert new aggregates
              const stmt = db.prepare(
                `INSERT INTO analytics_treatment_aggregates 
                 (treatment_name, treatment_type, patient_count) 
                 VALUES (?, ?, ?)`
              );
              
              rows.forEach(row => {
                stmt.run(
                  row.treatment_name,
                  row.treatment_type,
                  row.patient_count
                );
              });
              
              stmt.finalize((err) => {
                if (err) return reject(err);
                console.log(`  ✓ Treatment aggregates: ${rows.length} groups (min ${MIN_CELL_SIZE} patients each)`);
                resolve();
              });
            });
          }
        );
      }
    );
  });
}

/**
 * Generate demographics (age ranges, gender, state)
 * HIPAA: Age ranges (not exact ages), state-level only, suppress < 11
 */
function generateDemographics() {
  return new Promise((resolve, reject) => {
    const db = getDb();
    // Check if patient_info table exists
    db.get(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='patient_info'`,
      (err, table) => {
        if (err || !table) {
          console.log('  ⊘ Patient info table not found, skipping demographics');
          return resolve();
        }
        
        // Age ranges (HIPAA-compliant bins)
        const ageRangeSql = `
          SELECT 
            CASE
              WHEN age < 18 THEN 'Under 18'
              WHEN age BETWEEN 18 AND 25 THEN '18-25'
              WHEN age BETWEEN 26 AND 35 THEN '26-35'
              WHEN age BETWEEN 36 AND 45 THEN '36-45'
              WHEN age BETWEEN 46 AND 55 THEN '46-55'
              WHEN age BETWEEN 56 AND 65 THEN '56-65'
              WHEN age BETWEEN 66 AND 75 THEN '66-75'
              WHEN age > 75 THEN 'Over 75'
            END as age_range,
            COUNT(*) as patient_count
          FROM patient_info
          WHERE age IS NOT NULL
          GROUP BY age_range
          HAVING COUNT(*) >= ?
        `;
        
        db.all(ageRangeSql, [MIN_CELL_SIZE], (err, ageRows) => {
          if (err) return reject(err);
          
          // Gender counts
          db.all(
            `SELECT gender, COUNT(*) as patient_count 
             FROM patient_info 
             WHERE gender IS NOT NULL 
             GROUP BY gender 
             HAVING COUNT(*) >= ?`,
            [MIN_CELL_SIZE],
            (err, genderRows) => {
              if (err) return reject(err);
              
              // State-level location (HIPAA: NO city/zip)
              db.all(
                `SELECT state, COUNT(*) as patient_count 
                 FROM patient_info 
                 WHERE state IS NOT NULL 
                 GROUP BY state 
                 HAVING COUNT(*) >= ?`,
                [MIN_CELL_SIZE],
                (err, stateRows) => {
                  if (err) return reject(err);
                  
                  // Clear old demographics
                  db.run('DELETE FROM analytics_demographics', (err) => {
                    if (err) return reject(err);
                    
                    // Insert new demographics
                    const stmt = db.prepare(
                      `INSERT INTO analytics_demographics 
                       (demographic_type, demographic_value, patient_count) 
                       VALUES (?, ?, ?)`
                    );
                    
                    // Age ranges
                    ageRows.forEach(row => {
                      stmt.run('age_range', row.age_range, row.patient_count);
                    });
                    
                    // Gender
                    genderRows.forEach(row => {
                      stmt.run('gender', row.gender, row.patient_count);
                    });
                    
                    // State
                    stateRows.forEach(row => {
                      stmt.run('state', row.state, row.patient_count);
                    });
                    
                    stmt.finalize((err) => {
                      if (err) return reject(err);
                      const total = ageRows.length + genderRows.length + stateRows.length;
                      console.log(`  ✓ Demographics: ${total} groups (min ${MIN_CELL_SIZE} patients each)`);
                      resolve();
                    });
                  });
                }
              );
            }
          );
        });
      }
    );
  });
}

/**
 * Log analytics access for audit trail
 */
export function logAnalyticsAccess(userId, action, ipAddress) {
  try {
    run(
      `INSERT INTO analytics_audit_log (user_id, action, ip_address) 
       VALUES (?, ?, ?)`,
      [userId, action, ipAddress]
    );
  } catch (err) {
    console.error('[Analytics] Error logging access:', err.message);
    // Don't fail the request if audit logging fails
  }
}

export default {
  generateAllAnalytics,
  logAnalyticsAccess,
  MIN_CELL_SIZE
};
