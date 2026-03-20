/**
 * Analytics Aggregation Background Job
 * 
 * Runs analytics aggregation on app startup + every 6 hours.
 * Decoupled from server routes to prevent blocking UI on aggregation.
 * 
 * HIPAA Compliance:
 * - De-identified aggregates only (no PHI)
 * - Minimum cell size enforcement
 * - Audit logging on each run
 */

const path = require('path');

// Dynamically import ES modules
async function importServerModule(moduleName) {
  const modulePath = path.join(__dirname, '../server', moduleName);
  return await import(modulePath);
}

let analyticsJobScheduled = false;
let analyticsJobInterval = null;

/**
 * Initialize analytics aggregation job
 * Called on app startup
 */
async function initializeAnalyticsJob() {
  if (analyticsJobScheduled) {
    console.log('[Analytics Job] Already scheduled');
    return;
  }

  console.log('[Analytics Job] Initializing...');

  try {
    // Run aggregation on startup (after brief delay to ensure DB is ready)
    setTimeout(async () => {
      try {
        console.log('[Analytics Job] Running startup aggregation...');
        const { generateAllAnalytics } = await importServerModule('analytics-aggregator.js');
        await generateAllAnalytics();
        console.log('[Analytics Job] ✅ Startup aggregation complete');
      } catch (err) {
        console.error('[Analytics Job] ❌ Startup aggregation failed:', err.message);
        // Non-fatal — analytics endpoints will fall back to empty arrays
      }
    }, 2000); // 2s delay for DB initialization

    // Schedule recurring aggregation every 6 hours
    analyticsJobInterval = setInterval(async () => {
      try {
        console.log('[Analytics Job] Running scheduled aggregation...');
        const { generateAllAnalytics } = await importServerModule('analytics-aggregator.js');
        await generateAllAnalytics();
        console.log('[Analytics Job] ✅ Scheduled aggregation complete');
      } catch (err) {
        console.error('[Analytics Job] ❌ Scheduled aggregation failed:', err.message);
        // Non-fatal — will retry next cycle
      }
    }, 6 * 60 * 60 * 1000); // 6 hours in ms

    analyticsJobScheduled = true;
    console.log('[Analytics Job] ✅ Scheduled (startup + every 6h)');
  } catch (err) {
    console.error('[Analytics Job] ❌ Failed to initialize:', err.message);
    // Non-fatal — app continues, analytics just empty
  }
}

/**
 * Stop analytics job (on app quit)
 */
function stopAnalyticsJob() {
  if (analyticsJobInterval) {
    clearInterval(analyticsJobInterval);
    analyticsJobInterval = null;
  }
  analyticsJobScheduled = false;
  console.log('[Analytics Job] Stopped');
}

module.exports = {
  initializeAnalyticsJob,
  stopAnalyticsJob,
};
