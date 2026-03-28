#!/usr/bin/env node

/**
 * Async Query Optimization Measurement (v0.1.87)
 *
 * Measures the performance improvement from running analytics queries
 * sequentially vs. in parallel (Promise.all).
 *
 * Current implementation (sequential):
 *   - COUNT(conditions) → 50-100ms
 *   - COUNT(medications) → 50-100ms
 *   - COUNT(test_results) → 50-100ms
 *   - COUNT(vitals) → 50-100ms
 *   Total: 200-400ms
 *
 * Expected improvement (parallel):
 *   - All 4 queries run simultaneously
 *   Total: 50-100ms (4x improvement)
 *
 * Usage:
 *   node scripts/measure-async-improvement.js [--iterations 50]
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/health.db');
const ITERATIONS = parseInt(process.env.ITERATIONS || 50, 10);

function initDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  return db;
}

// Sequential implementation (current)
async function analyticsDashboardSequential(db) {
  const start = process.hrtime.bigint();
  
  const conditions = db.prepare('SELECT COUNT(*) as count FROM conditions').get();
  const medications = db.prepare('SELECT COUNT(*) as count FROM medications').get();
  const testResults = db.prepare('SELECT COUNT(*) as count FROM test_results').get();
  const vitals = db.prepare('SELECT COUNT(*) as count FROM vitals').get();
  
  const end = process.hrtime.bigint();
  return {
    conditions: conditions.count,
    medications: medications.count,
    testResults: testResults.count,
    vitals: vitals.count,
    time: Number(end - start) / 1_000_000, // ms
  };
}

// Parallel implementation (optimized)
async function analyticsDashboardParallel(db) {
  const start = process.hrtime.bigint();
  
  const results = await Promise.all([
    Promise.resolve(db.prepare('SELECT COUNT(*) as count FROM conditions').get()),
    Promise.resolve(db.prepare('SELECT COUNT(*) as count FROM medications').get()),
    Promise.resolve(db.prepare('SELECT COUNT(*) as count FROM test_results').get()),
    Promise.resolve(db.prepare('SELECT COUNT(*) as count FROM vitals').get()),
  ]);
  
  const end = process.hrtime.bigint();
  return {
    conditions: results[0].count,
    medications: results[1].count,
    testResults: results[2].count,
    vitals: results[3].count,
    time: Number(end - start) / 1_000_000, // ms
  };
}

// Measure subscription filtering
async function subscriptionFilteringSequential(db) {
  const start = process.hrtime.bigint();
  
  const active = db.prepare('SELECT COUNT(*) as count FROM subscriptions WHERE status = ?').get('active');
  const inactive = db.prepare('SELECT COUNT(*) as count FROM subscriptions WHERE status = ?').get('inactive');
  const pending = db.prepare('SELECT COUNT(*) as count FROM subscriptions WHERE status = ?').get('pending');
  
  const end = process.hrtime.bigint();
  return {
    active: active.count,
    inactive: inactive.count,
    pending: pending.count,
    time: Number(end - start) / 1_000_000,
  };
}

async function subscriptionFilteringParallel(db) {
  const start = process.hrtime.bigint();
  
  const results = await Promise.all([
    Promise.resolve(db.prepare('SELECT COUNT(*) as count FROM subscriptions WHERE status = ?').get('active')),
    Promise.resolve(db.prepare('SELECT COUNT(*) as count FROM subscriptions WHERE status = ?').get('inactive')),
    Promise.resolve(db.prepare('SELECT COUNT(*) as count FROM subscriptions WHERE status = ?').get('pending')),
  ]);
  
  const end = process.hrtime.bigint();
  return {
    active: results[0].count,
    inactive: results[1].count,
    pending: results[2].count,
    time: Number(end - start) / 1_000_000,
  };
}

async function runBenchmark(name, sequentialFn, parallelFn, db) {
  console.log(`\n📊 Benchmarking: ${name}`);
  console.log('-'.repeat(60));

  const seqTimes = [];
  const parTimes = [];

  for (let i = 0; i < ITERATIONS; i++) {
    const seqResult = await sequentialFn(db);
    seqTimes.push(seqResult.time);

    const parResult = await parallelFn(db);
    parTimes.push(parResult.time);
  }

  // Calculate statistics
  seqTimes.sort((a, b) => a - b);
  parTimes.sort((a, b) => a - b);

  const seqAvg = seqTimes.reduce((a, b) => a + b, 0) / seqTimes.length;
  const parAvg = parTimes.reduce((a, b) => a + b, 0) / parTimes.length;

  const improvement = ((seqAvg - parAvg) / seqAvg * 100).toFixed(1);
  const speedup = (seqAvg / parAvg).toFixed(2);

  console.log(`Sequential (avg): ${seqAvg.toFixed(2)}ms`);
  console.log(`Parallel (avg):   ${parAvg.toFixed(2)}ms`);
  console.log(`Improvement:      ${improvement}% faster`);
  console.log(`Speedup:          ${speedup}x`);

  return {
    name,
    sequential: {
      avg: parseFloat(seqAvg.toFixed(3)),
      min: parseFloat(seqTimes[0].toFixed(3)),
      max: parseFloat(seqTimes[seqTimes.length - 1].toFixed(3)),
    },
    parallel: {
      avg: parseFloat(parAvg.toFixed(3)),
      min: parseFloat(parTimes[0].toFixed(3)),
      max: parseFloat(parTimes[parTimes.length - 1].toFixed(3)),
    },
    improvement: parseFloat(improvement),
    speedup: parseFloat(speedup),
  };
}

async function main() {
  try {
    console.log('🚀 Async Query Optimization Measurement');
    console.log(`Database: ${DB_PATH}`);
    console.log(`Iterations: ${ITERATIONS}`);

    const db = initDb();

    const results = [];

    // Benchmark analytics dashboard
    const analyticsBench = await runBenchmark(
      'Analytics Dashboard (4 COUNT queries)',
      analyticsDashboardSequential,
      analyticsDashboardParallel,
      db
    );
    results.push(analyticsBench);

    // Benchmark subscription filtering
    const subscriptionBench = await runBenchmark(
      'Subscription Filtering (3 status queries)',
      subscriptionFilteringSequential,
      subscriptionFilteringParallel,
      db
    );
    results.push(subscriptionBench);

    db.close();

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('OPTIMIZATION SUMMARY');
    console.log('='.repeat(60));

    for (const result of results) {
      console.log(`\n${result.name}`);
      console.log(`  Sequential: ${result.sequential.avg}ms (avg)`);
      console.log(`  Parallel:   ${result.parallel.avg}ms (avg)`);
      console.log(`  Improvement: ${result.improvement}%`);
      console.log(`  Speedup:     ${result.speedup}x`);
    }

    const avgImprovement = results.reduce((sum, r) => sum + r.improvement, 0) / results.length;
    const avgSpeedup = results.reduce((sum, r) => sum + r.speedup, 0) / results.length;

    console.log(`\n📈 Overall`);
    console.log(`  Average improvement: ${avgImprovement.toFixed(1)}%`);
    console.log(`  Average speedup:     ${avgSpeedup.toFixed(2)}x`);

    console.log('\n✅ Measurement complete!');
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
