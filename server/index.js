import express from 'express';
import cors from 'cors';
import db from './db.js';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Conditions
app.get('/api/conditions', (req, res) => {
  const conditions = db.prepare('SELECT * FROM conditions ORDER BY created_at DESC').all();
  res.json(conditions);
});

app.post('/api/conditions', (req, res) => {
  const { name, diagnosed_date, status, notes } = req.body;
  const result = db.prepare(
    'INSERT INTO conditions (name, diagnosed_date, status, notes) VALUES (?, ?, ?, ?)'
  ).run(name, diagnosed_date, status || 'active', notes);
  res.json({ id: result.lastInsertRowid });
});

// Symptoms
app.get('/api/symptoms', (req, res) => {
  const symptoms = db.prepare('SELECT * FROM symptoms ORDER BY date DESC LIMIT 50').all();
  res.json(symptoms);
});

app.post('/api/symptoms', (req, res) => {
  const { description, severity, date, notes } = req.body;
  const result = db.prepare(
    'INSERT INTO symptoms (description, severity, date, notes) VALUES (?, ?, ?, ?)'
  ).run(description, severity, date, notes);
  res.json({ id: result.lastInsertRowid });
});

// Medications
app.get('/api/medications', (req, res) => {
  const medications = db.prepare('SELECT * FROM medications ORDER BY created_at DESC').all();
  res.json(medications);
});

app.post('/api/medications', (req, res) => {
  const { name, dosage, frequency, started_date, notes } = req.body;
  const result = db.prepare(
    'INSERT INTO medications (name, dosage, frequency, started_date, notes) VALUES (?, ?, ?, ?, ?)'
  ).run(name, dosage, frequency, started_date, notes);
  res.json({ id: result.lastInsertRowid });
});

// Papers
app.get('/api/papers', (req, res) => {
  const papers = db.prepare('SELECT * FROM papers ORDER BY saved_at DESC').all();
  res.json(papers);
});

app.post('/api/papers', (req, res) => {
  const { pubmed_id, title, authors, journal, publication_date, abstract, url, type } = req.body;
  const result = db.prepare(
    'INSERT INTO papers (pubmed_id, title, authors, journal, publication_date, abstract, url, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(pubmed_id, title, authors, journal, publication_date, abstract, url, type || 'conventional');
  res.json({ id: result.lastInsertRowid });
});

// Search PubMed (proxy endpoint - implement later)
app.get('/api/search/pubmed', async (req, res) => {
  // TODO: Implement PubMed API search
  res.json({ message: 'PubMed search coming soon', query: req.query.q });
});

// Search Clinical Trials (proxy endpoint - implement later)
app.get('/api/search/trials', async (req, res) => {
  // TODO: Implement ClinicalTrials.gov API search
  res.json({ message: 'Clinical trials search coming soon', query: req.query.q });
});

app.listen(PORT, () => {
  console.log(`🏥 Medical Research Tracker API running on http://localhost:${PORT}`);
});
