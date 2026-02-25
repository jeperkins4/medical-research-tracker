/**
 * Genomics Trials Search
 * After importing mutations, search for:
 *   1. ClinicalTrials.gov (free, no key) — active/recruiting studies by gene
 *   2. Brave Web Search (optional, needs BRAVE_API_KEY) — general research
 *
 * Results are stored in `clinical_trials` + `mutation_trial_links` tables.
 */

const https = require('https');
const Database = require('better-sqlite3');

// ── Helpers ────────────────────────────────────────────────────────────────

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'MyTreatmentPath/1.0 (health research app)' } }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`JSON parse failed for ${url}: ${data.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

function ensureSchema(db) {
  // Ensure clinical_trials table exists (may already exist from server/db.js)
  db.exec(`
    CREATE TABLE IF NOT EXISTS clinical_trials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nct_id TEXT UNIQUE,
      title TEXT NOT NULL,
      status TEXT,
      phase TEXT,
      conditions TEXT,
      interventions TEXT,
      locations TEXT,
      url TEXT,
      source TEXT DEFAULT 'clinicaltrials.gov',
      saved_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Junction table linking mutations → trials
  db.exec(`
    CREATE TABLE IF NOT EXISTS mutation_trial_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mutation_id INTEGER NOT NULL,
      trial_id INTEGER NOT NULL,
      gene TEXT,
      search_query TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (mutation_id) REFERENCES genomic_mutations(id) ON DELETE CASCADE,
      FOREIGN KEY (trial_id) REFERENCES clinical_trials(id) ON DELETE CASCADE,
      UNIQUE(mutation_id, trial_id)
    )
  `);
}

// ── ClinicalTrials.gov ─────────────────────────────────────────────────────

async function searchClinicalTrialsGov(gene, condition = 'cancer') {
  const query = encodeURIComponent(`${gene} ${condition}`);
  const url = `https://clinicaltrials.gov/api/v2/studies?query.term=${query}&filter.overallStatus=RECRUITING,ACTIVE_NOT_RECRUITING,ENROLLING_BY_INVITATION&pageSize=8&format=json&fields=NCTId,BriefTitle,OverallStatus,Phase,Condition,InterventionName,LocationFacility,StudyFirstPostDate`;

  try {
    const data = await httpsGet(url);
    const studies = data?.studies || [];
    return studies.map(s => {
      const p = s.protocolSection || {};
      const id = p.identificationModule?.nctId || '';
      const status = p.statusModule?.overallStatus || '';
      const phases = p.designModule?.phases || [];
      const conditions = (p.conditionsModule?.conditions || []).join(', ');
      const interventions = (p.armsInterventionsModule?.interventions || [])
        .map(i => i.name).slice(0, 3).join(', ');
      const locations = (p.contactsLocationsModule?.locations || [])
        .map(l => l.facility).slice(0, 3).join(', ');
      return {
        nct_id: id,
        title: p.identificationModule?.briefTitle || 'Untitled',
        status,
        phase: phases.join(', '),
        conditions,
        interventions,
        locations,
        url: id ? `https://clinicaltrials.gov/study/${id}` : null,
        source: 'clinicaltrials.gov',
      };
    });
  } catch (err) {
    console.warn(`[TrialSearch] ClinicalTrials.gov error for "${gene}":`, err.message);
    return [];
  }
}

// ── Brave Search ───────────────────────────────────────────────────────────

async function searchBrave(gene, mutation, braveApiKey) {
  if (!braveApiKey) return [];
  const q = encodeURIComponent(`${gene} ${mutation} clinical trial cancer 2024 2025`);
  const url = `https://api.search.brave.com/res/v1/web/search?q=${q}&count=5&search_lang=en&result_filter=web`;

  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': braveApiKey,
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const results = (parsed?.web?.results || []).map(r => ({
            nct_id: null,
            title: r.title || '',
            status: 'Web Result',
            phase: null,
            conditions: gene,
            interventions: null,
            locations: null,
            url: r.url,
            source: 'brave',
          }));
          resolve(results);
        } catch { resolve([]); }
      });
    });
    req.on('error', () => resolve([]));
    req.setTimeout(10000, () => { req.destroy(); resolve([]); });
  });
}

// ── Store results ──────────────────────────────────────────────────────────

function upsertTrial(db, trial) {
  if (trial.nct_id) {
    const existing = db.prepare('SELECT id FROM clinical_trials WHERE nct_id = ?').get(trial.nct_id);
    if (existing) return existing.id;
    const r = db.prepare(`
      INSERT INTO clinical_trials (nct_id, title, status, phase, conditions, interventions, locations, url, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(trial.nct_id, trial.title, trial.status, trial.phase,
           trial.conditions, trial.interventions, trial.locations, trial.url, trial.source);
    return r.lastInsertRowid;
  } else {
    // Brave result — dedupe by URL
    const existing = db.prepare('SELECT id FROM clinical_trials WHERE url = ?').get(trial.url);
    if (existing) return existing.id;
    const r = db.prepare(`
      INSERT INTO clinical_trials (title, status, conditions, url, source)
      VALUES (?, ?, ?, ?, ?)
    `).run(trial.title, trial.status, trial.conditions, trial.url, trial.source);
    return r.lastInsertRowid;
  }
}

function linkMutationTrial(db, mutationId, trialId, gene, query) {
  try {
    db.prepare(`
      INSERT OR IGNORE INTO mutation_trial_links (mutation_id, trial_id, gene, search_query)
      VALUES (?, ?, ?, ?)
    `).run(mutationId, trialId, gene, query);
  } catch (e) {
    console.warn('[TrialSearch] Link insert skipped:', e.message);
  }
}

// ── Main export ────────────────────────────────────────────────────────────

/**
 * Search for clinical trials for a list of mutations and store results.
 * @param {Array} mutations  Array of { id, gene, mutation_detail, mutation_type }
 * @param {string} dbPath   Path to health-secure.db
 * @param {string} [braveApiKey]  Optional Brave API key
 * @returns {{ trialsFound: number, mutationsSearched: number }}
 */
async function searchTrialsForMutations(mutations, dbPath, braveApiKey = null) {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  ensureSchema(db);

  let trialsFound = 0;
  const seen = new Set(); // avoid duplicate gene searches

  for (const mutation of mutations) {
    const gene = (mutation.gene || '').trim().toUpperCase();
    if (!gene || seen.has(gene)) continue;
    seen.add(gene);

    console.log(`[TrialSearch] Searching for: ${gene} ${mutation.mutation_detail || ''}`);

    // ClinicalTrials.gov
    const ctGovResults = await searchClinicalTrialsGov(gene, 'cancer');
    for (const trial of ctGovResults) {
      try {
        const trialId = upsertTrial(db, trial);
        linkMutationTrial(db, mutation.id, trialId, gene, `${gene} cancer`);
        trialsFound++;
      } catch (e) {
        console.warn('[TrialSearch] Store CT.gov trial failed:', e.message);
      }
    }

    // Brave (if key available)
    if (braveApiKey) {
      const braveResults = await searchBrave(gene, mutation.mutation_detail || '', braveApiKey);
      for (const trial of braveResults) {
        try {
          const trialId = upsertTrial(db, trial);
          linkMutationTrial(db, mutation.id, trialId, gene, `${gene} ${mutation.mutation_detail} clinical trial`);
          trialsFound++;
        } catch (e) {
          console.warn('[TrialSearch] Store Brave trial failed:', e.message);
        }
      }
    }
  }

  db.close();
  return { trialsFound, mutationsSearched: seen.size };
}

module.exports = { searchTrialsForMutations };
