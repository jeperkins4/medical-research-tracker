/**
 * Enhanced Medication Routes
 * Routes for medications, supplements, and research articles
 */

import {
  getAllMedications,
  getMedicationById,
  createMedication,
  updateMedication,
  deleteMedication,
  getResearchArticles,
  addResearchArticle,
  deleteResearchArticle,
  getMedicationLog,
  logDoseTaken,
  getMedicationStats,
  searchMedications
} from './medications-api.js';

export const setupMedicationRoutes = (app, requireAuth) => {
  
  // Get all medications (with optional filters)
  app.get('/api/medications', requireAuth, (req, res) => {
    try {
      const filters = {
        type: req.query.type,
        active: req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined
      };
      
      const medications = getAllMedications(filters);
      res.json({ medications });
    } catch (error) {
      console.error('Error fetching medications:', error);
      res.status(500).json({ error: 'Failed to fetch medications' });
    }
  });

  // Get a single medication by ID
  app.get('/api/medications/:id', requireAuth, (req, res) => {
    try {
      const medication = getMedicationById(req.params.id);
      if (!medication) {
        return res.status(404).json({ error: 'Medication not found' });
      }
      res.json(medication);
    } catch (error) {
      console.error('Error fetching medication:', error);
      res.status(500).json({ error: 'Failed to fetch medication' });
    }
  });

  // Create a new medication
  app.post('/api/medications', requireAuth, (req, res) => {
    try {
      if (!req.body.name || !req.body.type) {
        return res.status(400).json({ error: 'Name and type are required' });
      }

      const result = createMedication(req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error('Error creating medication:', error);
      res.status(500).json({ error: 'Failed to create medication' });
    }
  });

  // Update a medication
  app.put('/api/medications/:id', requireAuth, (req, res) => {
    try {
      const existing = getMedicationById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'Medication not found' });
      }

      updateMedication(req.params.id, req.body);
      res.json({ id: req.params.id, message: 'Medication updated successfully' });
    } catch (error) {
      console.error('Error updating medication:', error);
      res.status(500).json({ error: 'Failed to update medication' });
    }
  });

  // Delete a medication
  app.delete('/api/medications/:id', requireAuth, (req, res) => {
    try {
      const existing = getMedicationById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'Medication not found' });
      }

      deleteMedication(req.params.id);
      res.json({ message: 'Medication deleted successfully' });
    } catch (error) {
      console.error('Error deleting medication:', error);
      res.status(500).json({ error: 'Failed to delete medication' });
    }
  });

  // Search medications
  app.get('/api/medications/search/:term', requireAuth, (req, res) => {
    try {
      const filters = {
        type: req.query.type,
        active: req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined
      };
      
      const results = searchMedications(req.params.term, filters);
      res.json({ results });
    } catch (error) {
      console.error('Error searching medications:', error);
      res.status(500).json({ error: 'Failed to search medications' });
    }
  });

  // Get medication statistics
  app.get('/api/medications/:id/stats', requireAuth, (req, res) => {
    try {
      const stats = getMedicationStats(req.params.id);
      if (!stats) {
        return res.status(404).json({ error: 'Medication not found' });
      }
      res.json(stats);
    } catch (error) {
      console.error('Error fetching medication stats:', error);
      res.status(500).json({ error: 'Failed to fetch medication stats' });
    }
  });

  // ============================================================================
  // Research Articles
  // ============================================================================

  // Get research articles for a medication
  app.get('/api/medications/:id/research', requireAuth, (req, res) => {
    try {
      const articles = getResearchArticles(req.params.id);
      res.json({ articles });
    } catch (error) {
      console.error('Error fetching research articles:', error);
      res.status(500).json({ error: 'Failed to fetch research articles' });
    }
  });

  // Add a research article to a medication
  app.post('/api/medications/research', requireAuth, (req, res) => {
    try {
      if (!req.body.medication_id || !req.body.title) {
        return res.status(400).json({ error: 'medication_id and title are required' });
      }

      // Verify medication exists
      const medication = getMedicationById(req.body.medication_id);
      if (!medication) {
        return res.status(404).json({ error: 'Medication not found' });
      }

      const result = addResearchArticle(req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error('Error adding research article:', error);
      res.status(500).json({ error: 'Failed to add research article' });
    }
  });

  // Delete a research article
  app.delete('/api/medications/research/:id', requireAuth, (req, res) => {
    try {
      deleteResearchArticle(req.params.id);
      res.json({ message: 'Research article deleted successfully' });
    } catch (error) {
      console.error('Error deleting research article:', error);
      res.status(500).json({ error: 'Failed to delete research article' });
    }
  });

  // ============================================================================
  // Medication Log (Dose Tracking)
  // ============================================================================

  // Get medication log for a medication
  app.get('/api/medications/:id/log', requireAuth, (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit) : 30;
      const log = getMedicationLog(req.params.id, limit);
      res.json({ log });
    } catch (error) {
      console.error('Error fetching medication log:', error);
      res.status(500).json({ error: 'Failed to fetch medication log' });
    }
  });

  // Log a dose taken
  app.post('/api/medications/log', requireAuth, (req, res) => {
    try {
      if (!req.body.medication_id || !req.body.taken_date) {
        return res.status(400).json({ error: 'medication_id and taken_date are required' });
      }

      // Verify medication exists
      const medication = getMedicationById(req.body.medication_id);
      if (!medication) {
        return res.status(404).json({ error: 'Medication not found' });
      }

      const result = logDoseTaken(req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error('Error logging dose:', error);
      res.status(500).json({ error: 'Failed to log dose' });
    }
  });

};
