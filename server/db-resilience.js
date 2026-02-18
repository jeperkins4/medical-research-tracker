/**
 * Database Resilience Layer
 * 
 * Handles SQLite locking, connection retries, and query timeouts
 */

import { query as dbQuery, run as dbRun } from './db-secure.js';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 100;

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry wrapper for database operations
 */
async function retryOperation(operation, maxRetries = MAX_RETRIES) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return operation();
    } catch (error) {
      lastError = error;
      
      // Retry on SQLite busy/locked errors
      if (error.code === 'SQLITE_BUSY' || error.code === 'SQLITE_LOCKED') {
        if (attempt < maxRetries) {
          const delay = RETRY_DELAY_MS * attempt;
          console.warn(`⚠️  Database busy, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
          await sleep(delay);
          continue;
        }
      }
      
      // Don't retry other errors
      throw error;
    }
  }
  
  throw lastError;
}

/**
 * Resilient query wrapper
 */
export function resilientQuery(sql, params = []) {
  return retryOperation(() => dbQuery(sql, params));
}

/**
 * Resilient run wrapper
 */
export function resilientRun(sql, params = []) {
  return retryOperation(() => dbRun(sql, params));
}

/**
 * Transaction wrapper with automatic retry
 */
export async function resilientTransaction(operations) {
  return retryOperation(() => {
    // Begin transaction
    dbRun('BEGIN IMMEDIATE');
    
    try {
      // Execute all operations
      const results = operations.map(op => {
        if (op.type === 'query') {
          return dbQuery(op.sql, op.params);
        } else if (op.type === 'run') {
          return dbRun(op.sql, op.params);
        }
        throw new Error(`Unknown operation type: ${op.type}`);
      });
      
      // Commit transaction
      dbRun('COMMIT');
      
      return results;
    } catch (error) {
      // Rollback on error
      try {
        dbRun('ROLLBACK');
      } catch (rollbackError) {
        console.error('Failed to rollback transaction:', rollbackError.message);
      }
      throw error;
    }
  });
}

/**
 * Query with timeout
 */
export async function queryWithTimeout(sql, params = [], timeoutMs = 5000) {
  return Promise.race([
    Promise.resolve(resilientQuery(sql, params)),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Query timeout after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

/**
 * Check database health with retry
 */
export async function checkDatabaseHealth() {
  try {
    await resilientQuery('SELECT 1 as test');
    return { healthy: true, message: 'Database connection OK' };
  } catch (error) {
    return { 
      healthy: false, 
      message: 'Database connection failed',
      error: error.message 
    };
  }
}

/**
 * WAL checkpoint (optimize database file)
 */
export function optimizeDatabase() {
  try {
    console.log('🔄 Running WAL checkpoint...');
    dbRun('PRAGMA wal_checkpoint(TRUNCATE)');
    console.log('✅ Database optimized');
    return true;
  } catch (error) {
    console.error('❌ Database optimization failed:', error.message);
    return false;
  }
}

/**
 * Vacuum database (reclaim space)
 */
export function vacuumDatabase() {
  try {
    console.log('🔄 Running VACUUM...');
    dbRun('VACUUM');
    console.log('✅ Database vacuumed');
    return true;
  } catch (error) {
    console.error('❌ VACUUM failed:', error.message);
    return false;
  }
}

/**
 * Analyze database (update query planner statistics)
 */
export function analyzeDatabase() {
  try {
    console.log('🔄 Running ANALYZE...');
    dbRun('ANALYZE');
    console.log('✅ Database analyzed');
    return true;
  } catch (error) {
    console.error('❌ ANALYZE failed:', error.message);
    return false;
  }
}
