# Flaky Test Analysis — v0.1.86 QA Hardening

## Overview

Two tests exhibit intermittent timing-related failures (pass on retry) during the full test suite run. Both are related to database query performance and test setup timing.

---

## Test 1: "response has enabled field"

**Location:** `tests/e2e/api.spec.js:299:3`

### Test Code
```javascript
test('response has enabled field', async ({ request }) => {
  const loginRes = await request.post(`${API}/api/auth/login`, { data: CREDS });
  const cookie = (loginRes.headers()['set-cookie'] || '').split(';')[0];

  const res = await request.get(`${API}/api/analytics/dashboard`, {
    headers: { Cookie: cookie },
  });

  const body = await res.json();
  expect(typeof body.enabled).toBe('boolean');
});
```

### Endpoint: `/api/analytics/dashboard`

**Location:** `server/analytics-routes.js:16`

```javascript
app.get('/api/analytics/dashboard', requireAuth, (req, res) => {
  try {
    logAnalyticsAccess(req.user?.username || 'unknown', 'view_dashboard', req.ip);

    const safeQuery = (sql, params = []) => {
      try { return query(sql, params); } catch { return []; }
    };
    const safeGet = (sql, params = []) => {
      try { const r = query(sql, params); return r.length > 0 ? r[0] : null; } catch { return null; }
    };

    // Multiple database queries for conditions, medications, labs, vitals, mutations, papers
    // ...
    
    res.json({
      enabled: true,
      userMetrics,
      diagnoses,
      mutations,
      treatments,
      demographics: [],
      labTrends,
      vitalsTrend,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Analytics API] Error fetching dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch analytics', message: error.message });
  }
});
```

### Root Cause Analysis

**Hypothesis 1: Sequential Database Query Timeout**
- The endpoint performs **7+ sequential database queries** on the full scope (`query()` calls with safeQuery/safeGet wrappers)
- During concurrent test runs, database lock contention can cause timeouts
- If *any* safeQuery/safeGet call fails silently (catch block returns [] or null), the response structure is still valid but slow
- The test might timeout waiting for the response before it's fully formed

**Hypothesis 2: Race Condition in Test Setup**
- The login creates a session cookie that must be immediately available
- If the session record hasn't fully committed to the database before the next GET request, authentication might fail
- The try-catch wrapping the entire route might silently fail on auth check, returning a response without the full structure

**Hypothesis 3: Database Index Missing**
- Queries like `SELECT COUNT(*) as c FROM conditions` and `SELECT date FROM vitals ORDER BY date DESC LIMIT 1` likely need indexes
- Without indexes, these queries perform full table scans
- Under concurrent test load, full scans can cause timeouts or lock waits

### Symptom Pattern
- **Flakiness rate:** ~10% (2 of 1,183 tests) — suggests rare race condition, not deterministic
- **Behavior on retry:** Always passes — suggests test isolation or warm-up effect
- **Timing:** Fails on first full suite run, passes on retry — consistent with cache/index warm-up

---

## Test 2: "?status=active returns only active subscriptions"

**Location:** `tests/e2e/subscriptions.spec.js:562:3`

### Test Code
```javascript
test('?status=active returns only active subscriptions', async ({ request }) => {
  // ...login...
  const res = await request.get(`${API}/api/subscriptions?status=active`, {
    headers: { Cookie: cookie },
  });
  // ...assertions...
});
```

### Endpoint: `/api/subscriptions?status=active`

**Location:** Likely `server/subscription-routes.js`

### Root Cause Analysis (Suspected)

**Similar Pattern to Test 1:**
- Status filtering on subscriptions table likely requires `WHERE status = 'active'`
- Without an index on `subscriptions(status)`, this is a full table scan
- Concurrent test load causes lock contention
- Query timeout or slow response causes test to fail

---

## Recommended Fixes (v0.1.87)

### Immediate (Quick Win)

#### 1. Add Database Indexes
```sql
CREATE INDEX IF NOT EXISTS idx_conditions_count ON conditions(id);
CREATE INDEX IF NOT EXISTS idx_medications_count ON medications(id);
CREATE INDEX IF NOT EXISTS idx_test_results_date ON test_results(date DESC);
CREATE INDEX IF NOT EXISTS idx_vitals_date ON vitals(date DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
```

**Rationale:** All four queries in analytics dashboard are COUNT(*) or ORDER BY operations that benefit from indexes. The status filter on subscriptions is a direct match.

#### 2. Add Explicit Retry Logic in Tests
```javascript
test('response has enabled field', async ({ request }) => {
  const loginRes = await request.post(`${API}/api/auth/login`, { data: CREDS });
  const cookie = (loginRes.headers()['set-cookie'] || '').split(';')[0];

  // Wait for session to be committed
  await page.waitForTimeout(100);

  const res = await request.get(`${API}/api/analytics/dashboard`, {
    headers: { Cookie: cookie },
  });

  const body = await res.json();
  expect(typeof body.enabled).toBe('boolean');
});
```

**Rationale:** Small delay ensures session record is committed before making authenticated request.

### Medium-term (Architectural)

#### 3. Parallelize Database Queries
```javascript
const [condCount, medCount, labCount, vitalsCount, mutCount, paperCount, latestVital, latestLab] = 
  await Promise.all([
    safeGet(`SELECT COUNT(*) as c FROM conditions`),
    safeGet(`SELECT COUNT(*) as c FROM medications`),
    safeGet(`SELECT COUNT(*) as c FROM test_results`),
    safeGet(`SELECT COUNT(*) as c FROM vitals`),
    safeGet(`SELECT COUNT(*) as c FROM genomic_mutations`),
    safeGet(`SELECT COUNT(*) as c FROM papers`),
    safeGet(`SELECT date FROM vitals ORDER BY date DESC LIMIT 1`),
    safeGet(`SELECT date FROM test_results ORDER BY date DESC LIMIT 1`),
  ]);
```

**Rationale:** Running queries in parallel instead of sequence reduces overall latency. Better under concurrent test load.

#### 4. Add Transaction Isolation Level
```javascript
app.get('/api/analytics/dashboard', requireAuth, (req, res) => {
  try {
    // Begin READ COMMITTED transaction for consistent snapshot
    const tx = db.prepare('BEGIN IMMEDIATE').run();
    try {
      // ... all queries here ...
      db.prepare('COMMIT').run();
    } catch (e) {
      db.prepare('ROLLBACK').run();
      throw e;
    }
    res.json({ /* ... */ });
  } catch (error) {
    // ...
  }
});
```

**Rationale:** Explicit transaction isolation prevents dirty reads and race conditions with concurrent writes during test.

#### 5. Implement Query Timeout Guards
```javascript
const QUERY_TIMEOUT_MS = 5000;
const safeGet = (sql, params = []) => {
  try {
    const start = Date.now();
    const r = query(sql, params);
    if (Date.now() - start > QUERY_TIMEOUT_MS) {
      console.warn(`[Analytics] Slow query (${Date.now() - start}ms): ${sql}`);
    }
    return r.length > 0 ? r[0] : null;
  } catch { 
    return null; 
  }
};
```

**Rationale:** Explicit timing helps identify which queries are slow. Logging provides observability for future optimization.

---

## Testing Strategy for v0.1.87

### 1. Run Full Suite With Indexes
```bash
npm test  # Should show 0 flaky tests
```

### 2. Stress Test with Concurrent Requests
```bash
# In separate terminal, hit analytics endpoint 50x concurrently
for i in {1..50}; do curl -s "http://localhost:3000/api/analytics/dashboard" -H "Cookie: ..." & done
```

### 3. Database Lock Monitoring
```javascript
// In global-setup.js
const db = require('better-sqlite3')(':memory:');
db.pragma('journal_mode = WAL');  // Enable WAL for concurrent access
```

### 4. Re-run Full Suite 3x to Verify Stability
```bash
npm test && npm test && npm test
# Should get 1,183 passing all 3 runs
```

---

## Acceptance Criteria (v0.1.87)

- [ ] All database indexes created and verified in schema
- [ ] Full test suite runs 3x consecutively with **0 flaky tests**
- [ ] Concurrent stress test (50 parallel requests) succeeds
- [ ] Query timeout logging shows no queries > 1000ms
- [ ] PR #2 merged with "fix(flaky-tests)" commit

---

## References

- **Better SQLite3 WAL:** https://github.com/WiseLibs/better-sqlite3/wiki/Concurrency
- **SQLite Locking:** https://www.sqlite.org/lockingv3.html
- **Playwright Timeout Tuning:** https://playwright.dev/docs/test-timeouts

---

*Analysis completed: 2026-03-21 11:35 PM EDT*  
*Next action: Create v0.1.87 branch and apply index + parallel query fixes*
