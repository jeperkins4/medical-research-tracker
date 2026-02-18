import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import cron from 'node-cron';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { validateConfig } from './config-validator.js';
import { init, query, run } from './db-secure.js';
import { hashPassword, verifyPassword, generateToken, requireAuth } from './auth.js';
import { auditMiddleware, logAuth } from './audit.js';
import { createEncryptedBackup, cleanupOldBackups } from './backup.js';
import { generateHealthcareSummary } from './ai-summary.js';
import * as vault from './vault.js';
import * as portalCreds from './portal-credentials.js';
import { syncPortal } from './portal-sync.js';
import { getBoneHealthData, getBoneHealthMetrics, getBoneHealthActions } from './bone-health.js';
import { shouldMonitorLiver, shouldMonitorLungs, shouldMonitorKidneys, shouldMonitorLymphatic, getAllOrganStatuses, getMonitoringSummary } from './organ-health.js';
import * as nutrition from './nutrition.js';
import { analyzeMeal, getMealSuggestions, getSavedAnalysis, saveAnalysis } from './meal-analyzer.js';
import { setupMedicationRoutes } from './medications-routes.js';
import { setupAnalyticsRoutes } from './analytics-routes.js';
import { generateAllAnalytics } from './analytics-aggregator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Validate security configuration before starting
validateConfig();

const app = express();
const PORT = 3000;

// CORS configuration
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://localhost:5173',
  'https://localhost:3000'
];

app.use(cors({ 
  origin: (origin, callback) => {
    // Allow requests with no origin (like Postman, mobile apps)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check whitelist
    if (ALLOWED_ORIGINS.some(allowed => origin.includes(allowed.replace(/^https?:\/\//, '')))) {
      callback(null, true);
    } else {
      console.warn(`⚠️  Blocked CORS request from: ${origin}`);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true 
}));
app.use(express.json());
app.use(cookieParser());

// Initialize database before starting server
await init();

// Setup enhanced medication routes
setupMedicationRoutes(app, requireAuth);
setupAnalyticsRoutes(app, requireAuth);

// Setup automated encrypted backups (HIPAA compliance)
const backupDir = join(__dirname, '..', 'backups');
if (!existsSync(backupDir)) {
  mkdirSync(backupDir, { recursive: true });
}

if (process.env.BACKUP_ENCRYPTION_KEY) {
  // Daily backup at 2 AM
  cron.schedule('0 2 * * *', async () => {
    const timestamp = new Date().toISOString().split('T')[0];
    const dbPath = join(__dirname, '..', 'data', 'health-secure.db');
    const backupPath = join(backupDir, `health_${timestamp}.db.enc`);
    
    try {
      await createEncryptedBackup(dbPath, backupPath);
      
      // Cleanup backups older than 30 days
      cleanupOldBackups(backupDir, 30);
      
      // Generate analytics aggregates (HIPAA-compliant, de-identified)
      console.log('🔄 Running nightly analytics aggregation...');
      await generateAllAnalytics();
      console.log('✅ Analytics aggregation complete');
    } catch (err) {
      console.error('❌ Backup/Analytics failed:', err.message);
      // TODO: Alert admin via email/SMS
    }
  });
  
  console.log('✅ Automated encrypted backups scheduled (daily at 2 AM)');
} else {
  console.warn('⚠️  BACKUP_ENCRYPTION_KEY not set - automated backups disabled');
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes
app.post('/api/auth/setup', async (req, res) => {
  // Check if any users exist
  const existingUsers = query('SELECT COUNT(*) as count FROM users');
  
  if (existingUsers[0].count > 0) {
    return res.status(400).json({ error: 'User already exists. Use login instead.' });
  }
  
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  
  try {
    const passwordHash = await hashPassword(password);
    const result = run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, passwordHash]);
    
    const token = generateToken(result.lastInsertRowid, username);
    res.cookie('auth_token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 }); // 7 days
    
    res.json({ success: true, username });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    logAuth(0, username || 'unknown', 'login', 'failure', 'missing_credentials', req);
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  const users = query('SELECT * FROM users WHERE username = ?', [username]);
  
  if (users.length === 0) {
    logAuth(0, username, 'login', 'failure', 'user_not_found', req);
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const user = users[0];
  const valid = await verifyPassword(password, user.password_hash);
  
  if (!valid) {
    logAuth(user.id, username, 'login', 'failure', 'invalid_password', req);
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const token = generateToken(user.id, user.username);
  res.cookie('auth_token', token, { 
    httpOnly: true, 
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 
  });
  
  logAuth(user.id, username, 'login', 'success', null, req);
  
  res.json({ success: true, username: user.username });
});

app.post('/api/auth/logout', (req, res) => {
  if (req.user) {
    logAuth(req.user.userId, req.user.username, 'logout', 'success', null, req);
  }
  res.clearCookie('auth_token');
  res.json({ success: true });
});

app.get('/api/auth/check', requireAuth, (req, res) => {
  res.json({ authenticated: true, username: req.user.username });
});

app.get('/api/auth/needs-setup', (req, res) => {
  const users = query('SELECT COUNT(*) as count FROM users');
  res.json({ needsSetup: users[0].count === 0 });
});

// Patient Profile
app.get('/api/profile', requireAuth, (req, res) => {
  const profile = query('SELECT * FROM patient_profile WHERE id = 1');
  res.json(profile[0] || {});
});

app.put('/api/profile', requireAuth, (req, res) => {
  const {
    first_name, last_name, date_of_birth, sex, blood_type,
    height_inches, weight_lbs, allergies, emergency_contact_name,
    emergency_contact_phone, primary_physician, insurance_provider,
    insurance_id, notes
  } = req.body;

  // Check if profile exists
  const existing = query('SELECT id FROM patient_profile WHERE id = 1');
  
  if (existing.length > 0) {
    // Update
    run(`UPDATE patient_profile SET
      first_name = ?, last_name = ?, date_of_birth = ?, sex = ?, blood_type = ?,
      height_inches = ?, weight_lbs = ?, allergies = ?,
      emergency_contact_name = ?, emergency_contact_phone = ?,
      primary_physician = ?, insurance_provider = ?, insurance_id = ?,
      notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1`,
      [first_name, last_name, date_of_birth, sex, blood_type,
       height_inches, weight_lbs, allergies, emergency_contact_name,
       emergency_contact_phone, primary_physician, insurance_provider,
       insurance_id, notes]
    );
  } else {
    // Insert
    run(`INSERT INTO patient_profile (
      id, first_name, last_name, date_of_birth, sex, blood_type,
      height_inches, weight_lbs, allergies, emergency_contact_name,
      emergency_contact_phone, primary_physician, insurance_provider,
      insurance_id, notes
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [first_name, last_name, date_of_birth, sex, blood_type,
       height_inches, weight_lbs, allergies, emergency_contact_name,
       emergency_contact_phone, primary_physician, insurance_provider,
       insurance_id, notes]
    );
  }
  
  res.json({ success: true });
});

// Conditions
app.get('/api/conditions', requireAuth, (req, res) => {
  const conditions = query('SELECT * FROM conditions ORDER BY created_at DESC');
  res.json(conditions);
});

app.post('/api/conditions', requireAuth, (req, res) => {
  const { name, diagnosed_date, status, notes } = req.body;
  const result = run(
    'INSERT INTO conditions (name, diagnosed_date, status, notes) VALUES (?, ?, ?, ?)',
    [name, diagnosed_date, status || 'active', notes]
  );
  res.json({ id: result.lastInsertRowid });
});

// Symptoms
app.get('/api/symptoms', requireAuth, (req, res) => {
  const symptoms = query('SELECT * FROM symptoms ORDER BY date DESC LIMIT 50');
  res.json(symptoms);
});

app.post('/api/symptoms', requireAuth, (req, res) => {
  const { description, severity, date, notes } = req.body;
  const result = run(
    'INSERT INTO symptoms (description, severity, date, notes) VALUES (?, ?, ?, ?)',
    [description, severity, date, notes]
  );
  res.json({ id: result.lastInsertRowid });
});

// Medications
app.get('/api/medications', requireAuth, (req, res) => {
  const medications = query('SELECT * FROM medications ORDER BY created_at DESC');
  res.json(medications);
});

app.post('/api/medications', requireAuth, (req, res) => {
  const { name, dosage, frequency, started_date, notes } = req.body;
  const result = run(
    'INSERT INTO medications (name, dosage, frequency, started_date, notes) VALUES (?, ?, ?, ?, ?)',
    [name, dosage, frequency, started_date, notes]
  );
  res.json({ id: result.lastInsertRowid });
});

// Test Results
app.get('/api/tests', requireAuth, (req, res) => {
  const tests = query('SELECT * FROM test_results ORDER BY date DESC');
  res.json(tests);
});

app.post('/api/tests', requireAuth, (req, res) => {
  const { test_name, result, date, provider, notes, condition_ids } = req.body;
  const insertResult = run(
    'INSERT INTO test_results (test_name, result, date, provider, notes) VALUES (?, ?, ?, ?, ?)',
    [test_name, result, date, provider || null, notes || null]
  );
  
  const testId = insertResult.lastInsertRowid;
  
  // Associate with conditions if provided
  if (condition_ids && Array.isArray(condition_ids)) {
    for (const conditionId of condition_ids) {
      run('INSERT INTO condition_tests (condition_id, test_id) VALUES (?, ?)', [conditionId, testId]);
    }
  }
  
  res.json({ id: testId });
});

// Vitals
app.get('/api/vitals', requireAuth, (req, res) => {
  const limit = req.query.limit || 50;
  const vitals = query('SELECT * FROM vitals ORDER BY date DESC, time DESC LIMIT ?', [limit]);
  res.json(vitals);
});

app.post('/api/vitals', requireAuth, (req, res) => {
  const {
    date, time, systolic, diastolic, heart_rate, temperature_f,
    respiratory_rate, oxygen_saturation, weight_lbs, height_inches,
    blood_glucose, pain_level, notes, condition_ids
  } = req.body;
  
  const result = run(
    `INSERT INTO vitals (
      date, time, systolic, diastolic, heart_rate, temperature_f,
      respiratory_rate, oxygen_saturation, weight_lbs, height_inches,
      blood_glucose, pain_level, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      date, time, systolic, diastolic, heart_rate, temperature_f,
      respiratory_rate, oxygen_saturation, weight_lbs, height_inches,
      blood_glucose, pain_level, notes
    ]
  );
  
  const vitalId = result.lastInsertRowid;
  
  // Associate with conditions if provided
  if (condition_ids && Array.isArray(condition_ids)) {
    for (const conditionId of condition_ids) {
      run('INSERT INTO condition_vitals (condition_id, vital_id) VALUES (?, ?)', [conditionId, vitalId]);
    }
  }
  
  res.json({ id: vitalId });
});

// Get vitals for a specific condition
app.get('/api/conditions/:id/vitals', (req, res) => {
  const vitals = query(`
    SELECT v.* FROM vitals v
    JOIN condition_vitals cv ON v.id = cv.vital_id
    WHERE cv.condition_id = ?
    ORDER BY v.date DESC, v.time DESC
  `, [req.params.id]);
  res.json(vitals);
});

// Associate existing vital with condition
app.post('/api/conditions/:conditionId/vitals/:vitalId', (req, res) => {
  run('INSERT OR IGNORE INTO condition_vitals (condition_id, vital_id) VALUES (?, ?)',
    [req.params.conditionId, req.params.vitalId]);
  res.json({ success: true });
});

// Associate existing symptom with condition
app.post('/api/conditions/:conditionId/symptoms/:symptomId', (req, res) => {
  run('INSERT OR IGNORE INTO condition_symptoms (condition_id, symptom_id) VALUES (?, ?)',
    [req.params.conditionId, req.params.symptomId]);
  res.json({ success: true });
});

// Associate existing test with condition
app.post('/api/conditions/:conditionId/tests/:testId', (req, res) => {
  run('INSERT OR IGNORE INTO condition_tests (condition_id, test_id) VALUES (?, ?)',
    [req.params.conditionId, req.params.testId]);
  res.json({ success: true });
});

// Papers
app.get('/api/papers', requireAuth, (req, res) => {
  const papers = query('SELECT * FROM papers ORDER BY saved_at DESC');
  res.json(papers);
});

app.post('/api/papers', requireAuth, (req, res) => {
  const { pubmed_id, title, authors, journal, publication_date, abstract, url, type } = req.body;
  const result = run(
    'INSERT INTO papers (pubmed_id, title, authors, journal, publication_date, abstract, url, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [pubmed_id, title, authors, journal, publication_date, abstract, url, type || 'conventional']
  );
  res.json({ id: result.lastInsertRowid });
});

// Search PubMed (proxy endpoint - implement later)
// Research Search (uses Brave Search API - configured in OpenClaw)
app.get('/api/search/research', requireAuth, async (req, res) => {
  const { q, count = 10 } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: 'Query parameter required' });
  }
  
  try {
    // Get user's primary diagnosis to enhance search context
    const conditions = query('SELECT name FROM conditions WHERE active = 1 ORDER BY diagnosis_date DESC LIMIT 1');
    const userDiagnosis = conditions.length > 0 ? conditions[0].name : 'cancer';
    
    // Enhanced query for medical research (uses user's diagnosis dynamically)
    const searchQuery = `${q} site:pubmed.ncbi.nlm.nih.gov OR site:clinicaltrials.gov OR site:nih.gov OR site:cancer.gov OR ${userDiagnosis}`;
    
    // Note: This is a placeholder - actual implementation would use external API
    // For now, return structure for frontend development
    res.json({ 
      query: q,
      results: [],
      message: 'Search implementation requires external API - use OpenClaw web_search tool for actual searches'
    });
  } catch (error) {
    res.status(500).json({ error: 'Search failed', details: error.message });
  }
});

// Get all tags
app.get('/api/tags', requireAuth, (req, res) => {
  const tags = query('SELECT * FROM tags ORDER BY name');
  res.json(tags);
});

// Create new tag
app.post('/api/tags', requireAuth, (req, res) => {
  const { name, category } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Tag name required' });
  }
  
  try {
    const result = run('INSERT INTO tags (name, category) VALUES (?, ?)', [name, category || null]);
    res.json({ id: result.lastInsertRowid, name, category });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create tag' });
  }
});

// Save paper to library
app.post('/api/papers', requireAuth, (req, res) => {
  const { title, authors, journal, publication_date, abstract, url, pmid, doi, type, tags } = req.body;
  
  if (!title) {
    return res.status(400).json({ error: 'Title required' });
  }
  
  try {
    // Insert paper
    const paperResult = run(`
      INSERT INTO papers (title, authors, journal, publication_date, abstract, url, pmid, doi, type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [title, authors || null, journal || null, publication_date || null, abstract || null, url || null, pmid || null, doi || null, type || 'research']);
    
    const paperId = paperResult.lastInsertRowid;
    
    // Add tags if provided
    if (tags && Array.isArray(tags)) {
      const insertPaperTag = db.prepare('INSERT INTO paper_tags (paper_id, tag_id) VALUES (?, ?)');
      for (const tagId of tags) {
        insertPaperTag.run(paperId, tagId);
      }
    }
    
    res.json({ id: paperId, title });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save paper', details: error.message });
  }
});

// Add tag to existing paper
app.post('/api/papers/:id/tags', requireAuth, (req, res) => {
  const { tag_id } = req.body;
  
  if (!tag_id) {
    return res.status(400).json({ error: 'Tag ID required' });
  }
  
  try {
    run('INSERT INTO paper_tags (paper_id, tag_id) VALUES (?, ?)', [req.params.id, tag_id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add tag' });
  }
});

// Remove tag from paper
app.delete('/api/papers/:id/tags/:tagId', requireAuth, (req, res) => {
  try {
    run('DELETE FROM paper_tags WHERE paper_id = ? AND tag_id = ?', [req.params.id, req.params.tagId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove tag' });
  }
});

// Get papers with their tags
app.get('/api/papers/detailed', requireAuth, (req, res) => {
  const papers = query(`
    SELECT 
      p.*,
      GROUP_CONCAT(t.name) as tag_names,
      GROUP_CONCAT(t.id) as tag_ids
    FROM papers p
    LEFT JOIN paper_tags pt ON p.id = pt.paper_id
    LEFT JOIN tags t ON pt.tag_id = t.id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `);
  
  // Parse tag_names and tag_ids into arrays
  const parsedPapers = papers.map(p => ({
    ...p,
    tags: p.tag_names ? p.tag_names.split(',').map((name, idx) => ({
      id: parseInt(p.tag_ids.split(',')[idx]),
      name
    })) : []
  }));
  
  res.json(parsedPapers);
});

// News Feed
app.get('/api/news', requireAuth, (req, res) => {
  const limit = req.query.limit || 50;
  const unreadOnly = req.query.unread === 'true';
  
  let sql = 'SELECT * FROM news_feed';
  const params = [];
  
  if (unreadOnly) {
    sql += ' WHERE is_read = 0';
  }
  
  sql += ' ORDER BY relevance_score DESC, discovered_at DESC LIMIT ?';
  params.push(limit);
  
  const articles = query(sql, params);
  res.json(articles);
});

app.get('/api/news/stats', requireAuth, (req, res) => {
  const stats = query(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread,
      MAX(discovered_at) as last_update,
      AVG(relevance_score) as avg_relevance
    FROM news_feed
  `);
  res.json(stats[0] || { total: 0, unread: 0, last_update: null, avg_relevance: 0 });
});

app.put('/api/news/:id/read', requireAuth, (req, res) => {
  run('UPDATE news_feed SET is_read = 1 WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

app.put('/api/news/mark-all-read', requireAuth, (req, res) => {
  run('UPDATE news_feed SET is_read = 1 WHERE is_read = 0');
  res.json({ success: true });
});

app.delete('/api/news/:id', requireAuth, (req, res) => {
  run('DELETE FROM news_feed WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// Genomic Profile - Precision Medicine
app.get('/api/genomic/mutations', requireAuth, (req, res) => {
  const mutations = query(`
    SELECT * FROM genomic_mutations 
    ORDER BY is_confirmed DESC, gene_name ASC
  `);
  res.json(mutations);
});

app.get('/api/genomic/pathways', requireAuth, (req, res) => {
  const pathways = query(`
    SELECT gp.*, 
      GROUP_CONCAT(gm.gene_name) as affected_genes,
      COUNT(DISTINCT mpm.mutation_id) as mutation_count
    FROM genomic_pathways gp
    LEFT JOIN mutation_pathway_map mpm ON gp.id = mpm.pathway_id
    LEFT JOIN genomic_mutations gm ON mpm.mutation_id = gm.id
    GROUP BY gp.id
    ORDER BY mutation_count DESC, gp.pathway_name
  `);
  res.json(pathways);
});

app.get('/api/genomic/treatments', requireAuth, (req, res) => {
  const treatments = query(`
    SELECT gt.*, 
      gp.pathway_name, gp.pathway_category,
      gm.gene_name as target_gene,
      gmo.overlap_type,
      m.name as existing_medication
    FROM genomic_treatments gt
    LEFT JOIN genomic_pathways gp ON gt.target_pathway_id = gp.id
    LEFT JOIN genomic_mutations gm ON gt.target_mutation_id = gm.id
    LEFT JOIN genomic_med_overlap gmo ON gt.id = gmo.genomic_treatment_id
    LEFT JOIN medications m ON gmo.medication_id = m.id
    ORDER BY 
      CASE priority_level 
        WHEN 'Critical' THEN 1 
        WHEN 'High' THEN 2 
        WHEN 'Medium' THEN 3 
        ELSE 4 
      END,
      gt.treatment_name
  `);
  res.json(treatments);
});

app.get('/api/genomic/precision-map', requireAuth, (req, res) => {
  // Complete precision medicine map: Mutations → Pathways → Treatments
  const mutations = query(`
    SELECT gm.*, 
      GROUP_CONCAT(DISTINCT gp.pathway_name) as affected_pathways
    FROM genomic_mutations gm
    LEFT JOIN mutation_pathway_map mpm ON gm.id = mpm.mutation_id
    LEFT JOIN genomic_pathways gp ON mpm.pathway_id = gp.id
    WHERE gm.is_confirmed = 1
    GROUP BY gm.id
  `);
  
  const pathways = query(`
    SELECT gp.*,
      GROUP_CONCAT(DISTINCT gm.gene_name) as driving_mutations,
      GROUP_CONCAT(DISTINCT gt.treatment_name) as targeting_treatments
    FROM genomic_pathways gp
    LEFT JOIN mutation_pathway_map mpm ON gp.id = mpm.pathway_id
    LEFT JOIN genomic_mutations gm ON mpm.mutation_id = gm.id
    LEFT JOIN genomic_treatments gt ON gp.id = gt.target_pathway_id
    GROUP BY gp.id
  `);
  
  res.json({ mutations, pathways });
});

app.get('/api/genomic/biomarkers', requireAuth, (req, res) => {
  const biomarkers = query(`
    SELECT gb.*,
      gp.pathway_name,
      gm.gene_name,
      COUNT(bm.id) as measurement_count,
      MAX(bm.measurement_date) as last_measured
    FROM genomic_biomarkers gb
    LEFT JOIN genomic_pathways gp ON gb.related_pathway_id = gp.id
    LEFT JOIN genomic_mutations gm ON gb.related_mutation_id = gm.id
    LEFT JOIN biomarker_measurements bm ON gb.id = bm.biomarker_id
    GROUP BY gb.id
  `);
  res.json(biomarkers);
});

// Foundation One Genomics Endpoints

// Get all genomic mutations
app.get('/api/genomics/mutations', requireAuth, (req, res) => {
  const mutations = query(`
    SELECT * FROM genomic_mutations
    ORDER BY variant_allele_frequency DESC
  `);
  res.json(mutations);
});

// Get mutation details with pathways and treatments
app.get('/api/genomics/mutations/:id', requireAuth, (req, res) => {
  const mutation = query('SELECT * FROM genomic_mutations WHERE id = ?', [req.params.id])[0];
  
  if (!mutation) {
    return res.status(404).json({ error: 'Mutation not found' });
  }
  
  const pathways = query(`
    SELECT p.*, mp.impact_level, mp.mechanism
    FROM pathways p
    JOIN mutation_pathways mp ON p.id = mp.pathway_id
    WHERE mp.mutation_id = ?
    ORDER BY 
      CASE mp.impact_level
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 3
        ELSE 4
      END
  `, [req.params.id]);
  
  const treatments = query(`
    SELECT * FROM mutation_treatments
    WHERE mutation_id = ?
    ORDER BY 
      sensitivity_or_resistance DESC,
      CASE clinical_evidence
        WHEN 'FDA_approved' THEN 1
        WHEN 'Phase_3' THEN 2
        WHEN 'Phase_2' THEN 3
        WHEN 'Phase_1' THEN 4
        WHEN 'Preclinical' THEN 5
        ELSE 6
      END
  `, [req.params.id]);
  
  const trials = query(`
    SELECT * FROM genomic_trials
    WHERE mutation_id = ? AND status = 'recruiting'
    ORDER BY priority_score DESC
  `, [req.params.id]);
  
  res.json({ mutation, pathways, treatments, trials });
});

// Get all pathways
app.get('/api/genomics/pathways', requireAuth, (req, res) => {
  const pathways = query('SELECT * FROM pathways');
  res.json(pathways);
});

// Get pathway details with linked mutations and treatments
app.get('/api/genomics/pathways/:id', requireAuth, (req, res) => {
  const pathway = query('SELECT * FROM pathways WHERE id = ?', [req.params.id])[0];
  
  if (!pathway) {
    return res.status(404).json({ error: 'Pathway not found' });
  }
  
  const mutations = query(`
    SELECT gm.*, mp.impact_level, mp.mechanism
    FROM genomic_mutations gm
    JOIN mutation_pathways mp ON gm.id = mp.mutation_id
    WHERE mp.pathway_id = ?
  `, [req.params.id]);
  
  const treatments = query(`
    SELECT * FROM mutation_treatments
    WHERE pathway_id = ?
  `, [req.params.id]);
  
  res.json({ pathway, mutations, treatments });
});

// Get all biomarkers
app.get('/api/genomics/biomarkers', requireAuth, (req, res) => {
  const biomarkers = query(`
    SELECT * FROM biomarkers
    ORDER BY report_date DESC
  `);
  res.json(biomarkers);
});

// Get clinical trials
app.get('/api/genomics/trials', requireAuth, (req, res) => {
  const trials = query(`
    SELECT gt.*, gm.gene, gm.alteration
    FROM genomic_trials gt
    LEFT JOIN genomic_mutations gm ON gt.mutation_id = gm.id
    WHERE gt.status = 'recruiting'
    ORDER BY gt.priority_score DESC, gt.phase
  `);
  res.json(trials);
});

// Get Pathway Visualization Graph Data
app.get('/api/genomics/pathway-graph', requireAuth, (req, res) => {
  // Get all mutations
  const mutations = query('SELECT * FROM genomic_mutations ORDER BY variant_allele_frequency DESC');
  
  // Get all pathways
  const pathways = query('SELECT * FROM genomic_pathways ORDER BY pathway_name');
  
  // Get all treatments
  const treatments = query('SELECT * FROM genomic_treatments ORDER BY treatment_name');
  
  // Get mutation-pathway mappings
  const mutationPathways = query(`
    SELECT mutation_id, pathway_id
    FROM mutation_pathway_map
  `);
  
  // Get pathway-treatment mappings
  const pathwayTreatments = query(`
    SELECT target_pathway_id as pathway_id, id as treatment_id
    FROM genomic_treatments
    WHERE target_pathway_id IS NOT NULL
  `);
  
  res.json({
    mutations,
    pathways,
    treatments,
    mutationPathways,
    pathwayTreatments
  });
});

// Get Mutation-Drug Network for Cytoscape visualization
app.get('/api/genomics/mutation-drug-network', requireAuth, (req, res) => {
  // Get mutations
  const mutations = query('SELECT id, gene, alteration, variant_allele_frequency FROM genomic_mutations');
  
  // Get treatments connected through pathways
  const treatmentConnections = query(`
    SELECT DISTINCT
      m.id as mutation_id,
      m.gene,
      t.id as treatment_id,
      t.treatment_name,
      t.treatment_type,
      t.priority_level,
      t.status,
      p.pathway_name,
      mp.impact_level
    FROM genomic_mutations m
    JOIN mutation_pathway_map mp ON m.id = mp.mutation_id
    JOIN genomic_pathways p ON mp.pathway_id = p.id
    JOIN genomic_treatments t ON p.id = t.target_pathway_id
    WHERE t.status = 'Recommended' OR t.status = 'Active'
    ORDER BY m.gene, t.treatment_name
  `);
  
  // Build Cytoscape-compatible nodes and edges
  const nodes = [];
  const edges = [];
  
  // Add mutation nodes (center nodes)
  mutations.forEach(mut => {
    nodes.push({
      data: {
        id: `mutation_${mut.id}`,
        label: mut.gene,
        type: 'mutation',
        alteration: mut.alteration,
        vaf: mut.variant_allele_frequency
      }
    });
  });
  
  // Track unique treatments to avoid duplicates
  const treatmentSet = new Set();
  
  // Add treatment nodes and edges
  treatmentConnections.forEach(conn => {
    const treatmentNodeId = `treatment_${conn.treatment_id}`;
    
    // Add treatment node if not already added
    if (!treatmentSet.has(conn.treatment_id)) {
      nodes.push({
        data: {
          id: treatmentNodeId,
          label: conn.treatment_name,
          type: 'treatment',
          treatment_type: conn.treatment_type,
          priority: conn.priority_level,
          status: conn.status
        }
      });
      treatmentSet.add(conn.treatment_id);
    }
    
    // Add edge from mutation to treatment
    edges.push({
      data: {
        id: `edge_${conn.mutation_id}_${conn.treatment_id}`,
        source: `mutation_${conn.mutation_id}`,
        target: treatmentNodeId,
        pathway: conn.pathway_name,
        impact: conn.impact_level
      }
    });
  });
  
  res.json({ nodes, edges });
});

// Get Precision Medicine Dashboard summary
app.get('/api/genomics/dashboard', requireAuth, (req, res) => {
  const mutations = query(`
    SELECT 
      gm.*,
      COUNT(DISTINCT mp.pathway_id) as pathway_count,
      COUNT(DISTINCT mt.id) as treatment_count,
      COUNT(DISTINCT gt.id) as trial_count
    FROM genomic_mutations gm
    LEFT JOIN mutation_pathways mp ON gm.id = mp.mutation_id
    LEFT JOIN mutation_treatments mt ON gm.id = mt.mutation_id
    LEFT JOIN genomic_trials gt ON gm.id = gt.mutation_id AND gt.status = 'recruiting'
    GROUP BY gm.id
    ORDER BY gm.variant_allele_frequency DESC
  `);
  
  const biomarkers = query('SELECT * FROM biomarkers ORDER BY report_date DESC');
  
  const topTrials = query(`
    SELECT gt.*, gm.gene, gm.alteration
    FROM genomic_trials gt
    LEFT JOIN genomic_mutations gm ON gt.mutation_id = gm.id
    WHERE gt.status = 'recruiting'
    ORDER BY gt.priority_score DESC
    LIMIT 5
  `);
  
  const treatmentOpportunities = query(`
    SELECT 
      mt.*,
      gm.gene,
      gm.alteration,
      gm.variant_allele_frequency
    FROM mutation_treatments mt
    JOIN genomic_mutations gm ON mt.mutation_id = gm.id
    WHERE mt.sensitivity_or_resistance = 'sensitivity'
    AND mt.clinical_evidence IN ('FDA_approved', 'Phase_3', 'Phase_2')
    ORDER BY 
      CASE mt.clinical_evidence
        WHEN 'FDA_approved' THEN 1
        WHEN 'Phase_3' THEN 2
        WHEN 'Phase_2' THEN 3
        ELSE 4
      END
  `);
  
  res.json({ mutations, biomarkers, topTrials, treatmentOpportunities });
});

// Get VUS variants
app.get('/api/genomics/vus', requireAuth, (req, res) => {
  const vusVariants = query('SELECT * FROM vus_variants ORDER BY gene');
  res.json(vusVariants);
});

// Get treatment-genomic correlations (Dr. Gildea's rationale)
app.get('/api/genomics/treatment-correlations', requireAuth, (req, res) => {
  const correlations = query(`
    SELECT 
      tgc.*,
      m.name as medication_name,
      m.dosage,
      m.frequency,
      gm.gene,
      gm.alteration,
      gm.variant_allele_frequency,
      p.name as pathway_name
    FROM treatment_genomic_correlation tgc
    LEFT JOIN medications m ON tgc.medication_id = m.id
    LEFT JOIN genomic_mutations gm ON tgc.mutation_id = gm.id
    LEFT JOIN pathways p ON tgc.pathway_id = p.id
    ORDER BY 
      CASE tgc.correlation_type
        WHEN 'targeted' THEN 1
        WHEN 'synergistic' THEN 2
        WHEN 'supportive' THEN 3
        ELSE 4
      END,
      m.name
  `);
  res.json(correlations);
});

// Get treatment correlations for a specific medication
app.get('/api/genomics/treatment-correlations/medication/:id', requireAuth, (req, res) => {
  const correlations = query(`
    SELECT 
      tgc.*,
      gm.gene,
      gm.alteration,
      gm.variant_allele_frequency,
      gm.clinical_significance,
      p.name as pathway_name,
      p.description as pathway_description
    FROM treatment_genomic_correlation tgc
    LEFT JOIN genomic_mutations gm ON tgc.mutation_id = gm.id
    LEFT JOIN pathways p ON tgc.pathway_id = p.id
    WHERE tgc.medication_id = ?
    ORDER BY tgc.correlation_type
  `, [req.params.id]);
  
  res.json(correlations);
});

// Get treatment correlations for a specific mutation
app.get('/api/genomics/treatment-correlations/mutation/:id', requireAuth, (req, res) => {
  const correlations = query(`
    SELECT 
      tgc.*,
      m.name as medication_name,
      m.dosage,
      m.frequency,
      p.name as pathway_name
    FROM treatment_genomic_correlation tgc
    LEFT JOIN medications m ON tgc.medication_id = m.id
    LEFT JOIN pathways p ON tgc.pathway_id = p.id
    WHERE tgc.mutation_id = ?
    ORDER BY 
      CASE tgc.correlation_type
        WHEN 'targeted' THEN 1
        WHEN 'synergistic' THEN 2
        WHEN 'supportive' THEN 3
        ELSE 4
      END
  `, [req.params.id]);
  
  res.json(correlations);
});

// AI Healthcare Strategy Summary
app.get('/api/ai/healthcare-summary', requireAuth, async (req, res) => {
  try {
    const result = await generateHealthcareSummary();
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to generate healthcare summary',
      message: error.message 
    });
  }
});

// Vault Management
app.get('/api/vault/status', requireAuth, (req, res) => {
  try {
    const status = vault.getVaultStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/vault/setup', requireAuth, (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Password required' });
    }

    const result = vault.setupMasterPassword(password);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/vault/unlock', requireAuth, (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Password required' });
    }

    const result = vault.unlockVault(password);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

app.post('/api/vault/lock', requireAuth, (req, res) => {
  try {
    const result = vault.lockVault();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Portal Credentials Management
app.get('/api/portals/credentials', requireAuth, (req, res) => {
  try {
    const credentials = portalCreds.listCredentials();
    res.json(credentials);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/portals/credentials/:id', requireAuth, (req, res) => {
  try {
    const credential = portalCreds.getCredential(req.params.id);
    res.json(credential);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/portals/credentials', requireAuth, (req, res) => {
  try {
    const result = portalCreds.addCredential(req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/portals/credentials/:id', requireAuth, (req, res) => {
  try {
    const result = portalCreds.updateCredential(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/portals/credentials/:id', requireAuth, (req, res) => {
  try {
    const result = portalCreds.deleteCredential(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/portals/sync-history', requireAuth, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const history = portalCreds.getAllSyncHistory(limit);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/portals/credentials/:id/sync-history', requireAuth, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const history = portalCreds.getSyncHistory(req.params.id, limit);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manual sync trigger
app.post('/api/portals/credentials/:id/sync', requireAuth, async (req, res) => {
  try {
    const result = await syncPortal(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bone Health Tracking API
app.get('/api/bone-health', requireAuth, (req, res) => {
  try {
    const data = getBoneHealthData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/bone-health/metrics', requireAuth, (req, res) => {
  try {
    const metrics = getBoneHealthMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/bone-health/actions', requireAuth, (req, res) => {
  try {
    const actions = getBoneHealthActions();
    res.json(actions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Organ Health Monitoring API
app.get('/api/organ-health/liver', requireAuth, (req, res) => {
  try {
    const status = shouldMonitorLiver();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/organ-health/lungs', requireAuth, (req, res) => {
  try {
    const status = shouldMonitorLungs();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/organ-health/kidneys', requireAuth, (req, res) => {
  try {
    const status = shouldMonitorKidneys();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/organ-health/lymphatic', requireAuth, (req, res) => {
  try {
    const status = shouldMonitorLymphatic();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/organ-health/all', requireAuth, (req, res) => {
  try {
    const statuses = getAllOrganStatuses();
    res.json(statuses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/organ-health/summary', requireAuth, (req, res) => {
  try {
    const summary = getMonitoringSummary();
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Audit Log API (HIPAA compliance)
app.get('/api/audit/logs', requireAuth, (req, res) => {
  const { limit = 100, offset = 0, user, action, resource, status } = req.query;
  
  let sql = 'SELECT * FROM audit_log WHERE 1=1';
  const params = [];
  
  if (user) {
    sql += ' AND username = ?';
    params.push(user);
  }
  
  if (action) {
    sql += ' AND action = ?';
    params.push(action);
  }
  
  if (resource) {
    sql += ' AND resource_type = ?';
    params.push(resource);
  }
  
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  
  sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  
  const logs = query(sql, params);
  res.json(logs);
});

app.get('/api/audit/stats', requireAuth, (req, res) => {
  const stats = query(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'failure' THEN 1 END) as failures,
      COUNT(CASE WHEN action = 'login' THEN 1 END) as logins,
      COUNT(CASE WHEN action = 'view' THEN 1 END) as views,
      MAX(timestamp) as last_activity
    FROM audit_log
  `);
  
  res.json(stats[0] || { total: 0, failures: 0, logins: 0, views: 0, last_activity: null });
});

// Nutrition API
app.get('/api/nutrition/foods', requireAuth, (req, res) => {
  try {
    const foods = nutrition.getAllFoods();
    res.json(foods);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch foods', message: error.message });
  }
});

app.get('/api/nutrition/foods/:id', requireAuth, (req, res) => {
  try {
    const food = nutrition.getFoodWithPathways(req.params.id);
    if (!food) {
      return res.status(404).json({ error: 'Food not found' });
    }
    res.json(food);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch food', message: error.message });
  }
});

app.get('/api/nutrition/meals', requireAuth, (req, res) => {
  try {
    const { start_date, end_date, limit } = req.query;
    const meals = nutrition.getMeals(start_date, end_date, limit);
    res.json(meals);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch meals', message: error.message });
  }
});

app.get('/api/nutrition/meals/today', requireAuth, (req, res) => {
  try {
    const meals = nutrition.getTodaysMeals();
    res.json(meals);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch today\'s meals', message: error.message });
  }
});

app.post('/api/nutrition/meals', requireAuth, (req, res) => {
  try {
    const meal = nutrition.logMeal(req.body);
    res.json(meal);
  } catch (error) {
    res.status(500).json({ error: 'Failed to log meal', message: error.message });
  }
});

app.put('/api/nutrition/meals/:id', requireAuth, (req, res) => {
  try {
    const meal = nutrition.updateMeal(req.params.id, req.body);
    res.json(meal);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update meal', message: error.message });
  }
});

app.delete('/api/nutrition/meals/:id', requireAuth, (req, res) => {
  try {
    const result = nutrition.deleteMeal(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete meal', message: error.message });
  }
});

app.get('/api/nutrition/dashboard', requireAuth, (req, res) => {
  try {
    const dashboard = nutrition.getGenomicNutritionDashboard();
    res.json(dashboard);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate dashboard', message: error.message });
  }
});

app.get('/api/nutrition/recommendations', requireAuth, (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const recommendations = nutrition.getRecommendedFoods(date);
    res.json(recommendations);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get recommendations', message: error.message });
  }
});

app.post('/api/nutrition/analyze-meal', requireAuth, async (req, res) => {
  try {
    const { mealId, description, treatment_phase, energy_level, nausea_level, forceReanalyze } = req.body;
    
    if (!description) {
      return res.status(400).json({ error: 'Meal description required' });
    }
    
    // Check for saved analysis first (unless forcing re-analysis)
    if (mealId && !forceReanalyze) {
      const saved = getSavedAnalysis(mealId);
      if (saved) {
        return res.json({
          success: true,
          ...saved,
          cached: true
        });
      }
    }
    
    // Perform new analysis
    const analysis = await analyzeMeal(description, {
      treatment_phase,
      energy_level,
      nausea_level
    });
    
    // Save analysis if we have a meal ID and analysis was successful
    if (mealId && analysis.success) {
      saveAnalysis(mealId, analysis.analysis, analysis.model);
    }
    
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: 'Failed to analyze meal', message: error.message });
  }
});

app.get('/api/nutrition/meal-suggestions', requireAuth, async (req, res) => {
  try {
    const { treatment_phase } = req.query;
    const suggestions = await getMealSuggestions(treatment_phase || 'maintenance');
    res.json(suggestions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get meal suggestions', message: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🏥 Medical Research Tracker API running on http://0.0.0.0:${PORT}`);
  console.log(`   Access from network at http://<your-mac-ip>:${PORT}`);
});
