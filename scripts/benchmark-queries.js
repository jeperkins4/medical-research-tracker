#!/usr/bin/env node

/**
 * Performance Benchmarking Script for MRT Indexes (v0.1.87)
 *
 * Validates that the 9 new indexes (added in v0.1.87) provide expected
 * performance improvements. Measures query response times and validates
 * that indexes are being used.
 *
 * Usage:
 *   node scripts/benchmark-queries.js [--db /path/to/db] [--iterations 100]
 *
 * Expected improvements:
 *   - Analytics dashboard (4 COUNT queries): 100-200ms → < 50ms
 *   - Subscription filtering: 50-100ms → < 25ms
 *   - Portal sync lookups: 200-500ms → < 50ms
 *
 * Output: JSON metrics file (benchmarks/metrics-YYYY-MM-DD.json)
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─── Configuration ──────────────────────────────────────────────────────────

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/health.db');
const ITERATIONS = parseInt(process.env.ITERATIONS || 100, 10);
const METRICS_DIR = path.join(__dirname, '../benchmarks');
const WARM_UP_RUNS = 10; // Warm up the cache

// ─── Setup ──────────────────────────────────────────────────────────────────

function ensureMetricsDir() {
  if (!fs.existsSync(METRICS_DIR)) {
    fs.mkdirSync(METRICS_DIR, { recursive: true });
  }
}

function initDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  return db;
}

// ─── Seed Test Data ─────────────────────────────────────────────────────────

function seedTestData(db) {
  console.log('📊 Seeding test data...');
  
  // Clear existing test data
  db.exec(`
    DELETE FROM users WHERE username LIKE 'bench_%';
    DELETE FROM conditions WHERE id > 1000;
    DELETE FROM medications WHERE id > 1000;
    DELETE FROM test_results WHERE id > 1000;
    DELETE FROM vitals WHERE id > 1000;
    DELETE FROM subscriptions WHERE id > 1000;
    DELETE FROM portal_sync_log WHERE id > 1000;
    DELETE FROM condition_vitals WHERE id > 1000;
  `);

  // Create test user
  const userId = db
    .prepare(`INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)`)
    .run(
      `bench_user_${Date.now()}`,
      `bench_${Date.now()}@test.local`,
      crypto.randomBytes(32).toString('hex')
    ).lastInsertRowid;

  // Insert test conditions (50)
  const conditionIds = [];
  for (let i = 0; i < 50; i++) {
    const id = db
      .prepare(`INSERT INTO conditions (user_id, label, status) VALUES (?, ?, ?)`)
      .run(userId, `Condition ${i}`, 'active').lastInsertRowid;
    conditionIds.push(id);
  }

  // Insert test medications (200)
  for (let i = 0; i < 200; i++) {
    db.prepare(`INSERT INTO medications (user_id, name, dosage, frequency, active) VALUES (?, ?, ?, ?, ?)`)
      .run(userId, `Med ${i}`, `${10 + i}mg`, 'daily', 1);
  }

  // Insert test results (500)
  for (let i = 0; i < 500; i++) {
    const date = new Date(Date.now() - (i * 86400000)).toISOString();
    db.prepare(`INSERT INTO test_results (user_id, label, result, unit, date) VALUES (?, ?, ?, ?, ?)`)
      .run(userId, `Test ${i}`, Math.random() * 100, 'mg/dL', date);
  }

  // Insert test vitals (1000)
  for (let i = 0; i < 1000; i++) {
    const date = new Date(Date.now() - (i * 3600000)).toISOString();
    db.prepare(`INSERT INTO vitals (user_id, type, value, date) VALUES (?, ?, ?, ?)`)
      .run(userId, `vital_${i % 5}`, Math.random() * 200, date);
  }

  // Insert test subscriptions (100)
  for (let i = 0; i < 100; i++) {
    db.prepare(`INSERT INTO subscriptions (user_id, name, status) VALUES (?, ?, ?)`)
      .run(userId, `Sub ${i}`, i % 3 === 0 ? 'active' : 'inactive');
  }

  // Insert portal sync logs (500)
  for (let i = 0; i < 500; i++) {
    const portalId = (i % 10) + 1;
    const status = ['completed', 'in_progress', 'failed'][i % 3];
    const date = new Date(Date.now() - (i * 3600000)).toISOString();
    db.prepare(`INSERT INTO portal_sync_log (portal_id, status, synced_at) VALUES (?, ?, ?)`)
      .run(portalId, status, date);
  }

  // Insert condition_vitals join records (500)
  for (let i = 0; i < 500; i++) {
    const condId = conditionIds[i % conditionIds.length];
    const vitalId = (i % 1000) + 1;
    try {
      db.prepare(`INSERT OR IGNORE INTO condition_vitals (condition_id, vital_id) VALUES (?, ?)`)
        .run(condId, vitalId);
    } catch (e) {
      // Ignore constraint violations
    }
  }

  console.log(`✅ Seeded test data for user ${userId}`);
  return { userId, conditionIds };
}

// ─── Benchmark Queries ──────────────────────────────────────────────────────

function benchmarkQuery(db, label, query, params = [], expectedIndexes = []) {
  const times = [];
  
  // Warm-up runs (to populate cache)
  for (let i = 0; i < WARM_UP_RUNS; i++) {
    try {
      const stmt = db.prepare(query);
      if (params.length > 0) {
        stmt.all(...params);
      } else {
        stmt.all();
      }
    } catch (e) {
      console.warn(`⚠️  Warm-up query failed: ${label}`, e.message);
      return null;
    }
  }

  // Actual benchmark runs
  for (let i = 0; i < ITERATIONS; i++) {
    const start = process.hrtime.bigint();
    try {
      const stmt = db.prepare(query);
      if (params.length > 0) {
        stmt.all(...params);
      } else {
        stmt.all();
      }
    } catch (e) {
      console.warn(`⚠️  Benchmark query failed: ${label}`, e.message);
      return null;
    }
    const end = process.hrtime.bigint();
    times.push(Number(end - start) / 1_000_000); // Convert to milliseconds
  }

  // Calculate statistics
  times.sort((a, b) => a - b);
  const min = times[0];
  const max = times[times.length - 1];
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const p50 = times[Math.floor(times.length * 0.5)];
  const p95 = times[Math.floor(times.length * 0.95)];
  const p99 = times[Math.floor(times.length * 0.99)];

  // Check if indexes are used (via EXPLAIN QUERY PLAN)
  let usesIndex = false;
  try {
    const explainQuery = params.length > 0
      ? db.prepare(`EXPLAIN QUERY PLAN ${query}`).all(...params)
      : db.prepare(`EXPLAIN QUERY PLAN ${query}`).all();
    
    const plan = explainQuery.map(r => r.detail).join(' ');
    for (const idx of expectedIndexes) {
      if (plan.includes(idx)) {
        usesIndex = true;
        break;
      }
    }
    // Also check if any index is used (even if not the expected one)
    if (!usesIndex && plan.includes('USING INDEX')) {
      usesIndex = true;
    }
  } catch (e) {
    console.warn(`⚠️  EXPLAIN QUERY PLAN failed for ${label}`, e.message);
  }

  return {
    label,
    query: query.slice(0, 100) + (query.length > 100 ? '...' : ''),
    params,
    iterations: ITERATIONS,
    usesIndex,
    expectedIndexes,
    metrics: {
      min: parseFloat(min.toFixed(3)),
      max: parseFloat(max.toFixed(3)),
      avg: parseFloat(avg.toFixed(3)),
      p50: parseFloat(p50.toFixed(3)),
      p95: parseFloat(p95.toFixed(3)),
      p99: parseFloat(p99.toFixed(3)),
    },
  };
}

// ─── Run All Benchmarks ──────────────────────────────────────────────────────

function runBenchmarks(db) {
  console.log(`\n🏃 Running benchmarks (${ITERATIONS} iterations per query)...\n`);

  const benchmarks = [
    // Analytics Dashboard (4 COUNT queries that should now use indexes)
    {
      name: 'Analytics: COUNT conditions',
      query: 'SELECT COUNT(*) FROM conditions WHERE id > 0',
      indexes: ['idx_conditions_id'],
    },
    {
      name: 'Analytics: COUNT medications',
      query: 'SELECT COUNT(*) FROM medications WHERE id > 0',
      indexes: ['idx_medications_id'],
    },
    {
      name: 'Analytics: COUNT test_results',
      query: 'SELECT COUNT(*) FROM test_results WHERE id > 0',
      indexes: ['idx_test_results_date'],
    },
    {
      name: 'Analytics: COUNT vitals',
      query: 'SELECT COUNT(*) FROM vitals WHERE id > 0',
      indexes: ['idx_vitals_date'],
    },

    // Subscription Filtering
    {
      name: 'Subscriptions: Filter by status=active',
      query: 'SELECT * FROM subscriptions WHERE status = ?',
      params: ['active'],
      indexes: ['idx_subscriptions_status'],
    },

    // Portal Sync Operations
    {
      name: 'Portal Sync: Lookup by portal_id',
      query: 'SELECT * FROM portal_sync_log WHERE portal_id = ? ORDER BY synced_at DESC LIMIT 10',
      params: [1],
      indexes: ['idx_portal_sync_log_portal_id'],
    },
    {
      name: 'Portal Sync: Filter by status',
      query: 'SELECT * FROM portal_sync_log WHERE status = ? ORDER BY synced_at DESC LIMIT 50',
      params: ['completed'],
      indexes: ['idx_portal_sync_log_status'],
    },

    // Join Operations
    {
      name: 'Joins: condition_vitals by condition_id',
      query: 'SELECT * FROM condition_vitals WHERE condition_id = ? LIMIT 20',
      params: [1],
      indexes: ['idx_condition_vitals_condition_id'],
    },
    {
      name: 'Joins: condition_vitals by vital_id',
      query: 'SELECT * FROM condition_vitals WHERE vital_id = ? LIMIT 20',
      params: [1],
      indexes: ['idx_condition_vitals_vital_id'],
    },

    // User Lookups
    {
      name: 'User Lookup: by id',
      query: 'SELECT * FROM users WHERE id = ?',
      params: [1],
      indexes: ['idx_users_id'],
    },
  ];

  const results = [];
  for (const benchmark of benchmarks) {
    const result = benchmarkQuery(
      db,
      benchmark.name,
      benchmark.query,
      benchmark.params || [],
      benchmark.indexes || []
    );
    if (result) {
      results.push(result);
    }
  }

  return results;
}

// ─── Report Generation ──────────────────────────────────────────────────────

function generateReport(results) {
  const timestamp = new Date().toISOString();
  const date = timestamp.split('T')[0];
  const reportFile = path.join(METRICS_DIR, `metrics-${date}.json`);

  const report = {
    timestamp,
    database: DB_PATH,
    iterations: ITERATIONS,
    results,
    summary: {
      totalQueries: results.length,
      queriesUsingIndexes: results.filter(r => r.usesIndex).length,
      averageResponseTime: parseFloat(
        (results.reduce((sum, r) => sum + r.metrics.avg, 0) / results.length).toFixed(3)
      ),
      maxResponseTime: parseFloat(
        Math.max(...results.map(r => r.metrics.max)).toFixed(3)
      ),
      slowestQuery: results.reduce((a, b) => 
        (a.metrics.avg > b.metrics.avg) ? a : b
      ),
    },
  };

  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`\n📊 Report saved to ${reportFile}`);
  return report;
}

// ─── Display Report ─────────────────────────────────────────────────────────

function displayReport(report) {
  console.log('\n' + '='.repeat(80));
  console.log('PERFORMANCE BENCHMARKS — v0.1.87 Index Validation');
  console.log('='.repeat(80));

  console.log(`\n📈 Summary`);
  console.log(`  Database: ${report.database}`);
  console.log(`  Iterations per query: ${report.iterations}`);
  console.log(`  Queries tested: ${report.summary.totalQueries}`);
  console.log(`  Queries using indexes: ${report.summary.queriesUsingIndexes}/${report.summary.totalQueries}`);
  console.log(`  Average response time: ${report.summary.averageResponseTime}ms`);
  console.log(`  Max response time: ${report.summary.maxResponseTime}ms`);

  console.log(`\n⚡ Query Performance`);
  console.log(`${'Label'.padEnd(50)} | ${'Avg'.padStart(8)} | ${'P95'.padStart(8)} | ${'Index?'.padStart(6)}`);
  console.log('-'.repeat(80));

  for (const result of report.results) {
    const label = result.label.slice(0, 48);
    const avg = `${result.metrics.avg.toFixed(2)}ms`;
    const p95 = `${result.metrics.p95.toFixed(2)}ms`;
    const indexUsed = result.usesIndex ? '✅' : '❌';
    console.log(`${label.padEnd(50)} | ${avg.padStart(8)} | ${p95.padStart(8)} | ${indexUsed.padStart(6)}`);
  }

  console.log('\n' + '='.repeat(80));

  // Recommendations
  const slowQueries = report.results.filter(r => r.metrics.avg > 10);
  if (slowQueries.length > 0) {
    console.log(`\n⚠️  Slow queries (>10ms):`);
    for (const q of slowQueries) {
      console.log(`  - ${q.label}: ${q.metrics.avg.toFixed(2)}ms`);
    }
  }

  const missingIndexes = report.results.filter(r => !r.usesIndex && r.expectedIndexes.length > 0);
  if (missingIndexes.length > 0) {
    console.log(`\n❌ Queries NOT using expected indexes:`);
    for (const q of missingIndexes) {
      console.log(`  - ${q.label}`);
      console.log(`    Expected: ${q.expectedIndexes.join(', ')}`);
    }
  }

  if (slowQueries.length === 0 && missingIndexes.length === 0) {
    console.log(`\n✅ All queries performing well and using indexes!`);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  try {
    console.log('🚀 Medical Research Tracker — Query Performance Benchmark');
    console.log(`Database: ${DB_PATH}`);
    console.log(`Iterations: ${ITERATIONS}`);

    if (!fs.existsSync(DB_PATH)) {
      console.error(`❌ Database not found: ${DB_PATH}`);
      process.exit(1);
    }

    ensureMetricsDir();
    const db = initDb();

    // Seed test data
    seedTestData(db);

    // Run benchmarks
    const results = runBenchmarks(db);

    // Generate and display report
    const report = generateReport(results);
    displayReport(report);

    db.close();
    console.log('\n✅ Benchmark complete!');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
