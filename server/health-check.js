/**
 * Server Health Check & Resilience Layer
 * 
 * Prevents server crashes from non-critical module failures
 */

import { query } from './db-secure.js';

/**
 * Check database connectivity
 */
export function checkDatabase() {
  try {
    const result = query('SELECT 1 as test');
    return { 
      status: 'healthy', 
      message: 'Database connected',
      test: result[0]?.test === 1
    };
  } catch (error) {
    return { 
      status: 'unhealthy', 
      message: error.message,
      error: error.toString()
    };
  }
}

/**
 * Check if analytics tables exist
 */
export function checkAnalyticsTables() {
  try {
    const tables = query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name LIKE 'analytics_%'
    `);
    return {
      status: tables.length > 0 ? 'healthy' : 'missing',
      message: tables.length > 0 
        ? `${tables.length} analytics tables found` 
        : 'Analytics tables not created yet',
      tableCount: tables.length,
      tables: tables.map(t => t.name)
    };
  } catch (error) {
    return {
      status: 'error',
      message: error.message,
      error: error.toString()
    };
  }
}

/**
 * Check if required tables exist
 */
export function checkCoreTables() {
  const requiredTables = [
    'users',
    'conditions',
    'medications',
    'test_results',
    'genomic_mutations',
    'papers',
    'audit_log'
  ];
  
  try {
    const existingTables = query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name IN (${requiredTables.map(() => '?').join(',')})
    `, requiredTables);
    
    const existing = existingTables.map(t => t.name);
    const missing = requiredTables.filter(t => !existing.includes(t));
    
    return {
      status: missing.length === 0 ? 'healthy' : 'incomplete',
      message: missing.length === 0 
        ? 'All core tables exist' 
        : `Missing tables: ${missing.join(', ')}`,
      existing: existing.length,
      missing: missing.length,
      missingTables: missing
    };
  } catch (error) {
    return {
      status: 'error',
      message: error.message,
      error: error.toString()
    };
  }
}

/**
 * Comprehensive health check
 */
export function getHealthStatus() {
  const db = checkDatabase();
  const coreTables = checkCoreTables();
  const analyticsTables = checkAnalyticsTables();
  
  const overallStatus = 
    db.status === 'unhealthy' ? 'critical' :
    coreTables.status === 'incomplete' ? 'degraded' :
    analyticsTables.status === 'missing' ? 'partial' :
    'healthy';
  
  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks: {
      database: db,
      coreTables,
      analyticsTables
    },
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    node: process.version
  };
}
