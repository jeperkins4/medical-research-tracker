/**
 * Unit tests for multi-cancer genomic data support
 * Tests: mutation mapping, pathway classification, treatment recommendations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from 'better-sqlite3';

// Mock genomic query functions
const createGenomicManager = (db) => {
  return {
    getMutationsByCancer: (cancerType) => {
      try {
        const stmt = db.prepare(`
          SELECT gm.*, gp.pathway_name, gp.significance
          FROM genomic_mutations gm
          LEFT JOIN genomic_pathways gp ON gm.pathway_id = gp.id
          WHERE gm.cancer_type = ?
          ORDER BY gp.significance DESC
        `);
        return stmt.all(cancerType);
      } catch (err) {
        console.error('Error fetching mutations:', err);
        return [];
      }
    },

    getPathwaysByMutation: (mutationGene) => {
      try {
        const stmt = db.prepare(`
          SELECT gp.* FROM genomic_pathways gp
          INNER JOIN mutation_pathway_mapping mpm ON gp.id = mpm.pathway_id
          INNER JOIN genomic_mutations gm ON mpm.mutation_id = gm.id
          WHERE gm.gene_name = ?
        `);
        return stmt.all(mutationGene);
      } catch (err) {
        console.error('Error fetching pathways:', err);
        return [];
      }
    },

    getTreatmentsByMutation: (mutationGene, cancerType) => {
      try {
        const stmt = db.prepare(`
          SELECT DISTINCT t.* FROM treatments t
          INNER JOIN genomic_mutations gm ON t.mutation_id = gm.id
          WHERE gm.gene_name = ? AND gm.cancer_type = ?
          ORDER BY t.evidence_level DESC
        `);
        return stmt.all(mutationGene, cancerType);
      } catch (err) {
        console.error('Error fetching treatments:', err);
        return [];
      }
    },

    getActiveClinicalTrials: (cancerType, pathwayName) => {
      try {
        const stmt = db.prepare(`
          SELECT DISTINCT ct.* FROM clinical_trials ct
          INNER JOIN trial_pathways tp ON ct.id = tp.trial_id
          INNER JOIN genomic_pathways gp ON tp.pathway_id = gp.id
          WHERE ct.cancer_type = ? AND gp.pathway_name = ? AND ct.status = 'active'
          ORDER BY ct.enrollment_status DESC
        `);
        return stmt.all(cancerType, pathwayName);
      } catch (err) {
        console.error('Error fetching trials:', err);
        return [];
      }
    },

    getSupportedCancerTypes: () => {
      try {
        const stmt = db.prepare(`
          SELECT DISTINCT cancer_type FROM genomic_mutations
          ORDER BY cancer_type
        `);
        return stmt.all().map(row => row.cancer_type);
      } catch (err) {
        console.error('Error fetching cancer types:', err);
        return [];
      }
    }
  };
};

describe('Multi-Cancer Genomic Support', () => {
  let db;
  let genomicManager;

  beforeEach(() => {
    db = new Database(':memory:');

    // Create genomic schema
    db.exec(`
      CREATE TABLE genomic_mutations (
        id INTEGER PRIMARY KEY,
        gene_name TEXT NOT NULL,
        mutation_type TEXT,
        cancer_type TEXT NOT NULL,
        prevalence REAL,
        pathway_id INTEGER,
        created_at INTEGER
      );

      CREATE TABLE genomic_pathways (
        id INTEGER PRIMARY KEY,
        pathway_name TEXT NOT NULL,
        description TEXT,
        significance TEXT,
        drug_targets TEXT
      );

      CREATE TABLE mutation_pathway_mapping (
        id INTEGER PRIMARY KEY,
        mutation_id INTEGER NOT NULL,
        pathway_id INTEGER NOT NULL,
        FOREIGN KEY (mutation_id) REFERENCES genomic_mutations(id),
        FOREIGN KEY (pathway_id) REFERENCES genomic_pathways(id)
      );

      CREATE TABLE treatments (
        id INTEGER PRIMARY KEY,
        mutation_id INTEGER NOT NULL,
        drug_name TEXT NOT NULL,
        evidence_level TEXT,
        approval_status TEXT,
        FOREIGN KEY (mutation_id) REFERENCES genomic_mutations(id)
      );

      CREATE TABLE clinical_trials (
        id INTEGER PRIMARY KEY,
        trial_name TEXT NOT NULL,
        cancer_type TEXT NOT NULL,
        status TEXT,
        enrollment_status TEXT
      );

      CREATE TABLE trial_pathways (
        id INTEGER PRIMARY KEY,
        trial_id INTEGER NOT NULL,
        pathway_id INTEGER NOT NULL,
        FOREIGN KEY (trial_id) REFERENCES clinical_trials(id),
        FOREIGN KEY (pathway_id) REFERENCES genomic_pathways(id)
      );
    `);

    // Seed test data
    const insertPathways = db.prepare(`
      INSERT INTO genomic_pathways (pathway_name, description, significance, drug_targets)
      VALUES (?, ?, ?, ?)
    `);

    insertPathways.run('FGFR Signaling', 'Fibroblast Growth Factor Receptor pathway', 'HIGH', 'erdafitinib');
    insertPathways.run('PI3K/AKT/mTOR', 'Phosphoinositide 3-kinase pathway', 'HIGH', 'ipatasertib');
    insertPathways.run('CDK4/6', 'Cell cycle checkpoint pathway', 'MEDIUM', 'palbociclib');
    insertPathways.run('PD-1/PD-L1', 'Immune checkpoint pathway', 'HIGH', 'pembrolizumab');

    // Insert mutations
    const insertMutations = db.prepare(`
      INSERT INTO genomic_mutations (gene_name, mutation_type, cancer_type, prevalence, pathway_id)
      VALUES (?, ?, ?, ?, ?)
    `);

    insertMutations.run('FGFR3', 'point', 'bladder', 0.65, 1);
    insertMutations.run('ARID1A', 'deletion', 'bladder', 0.75, 2);
    insertMutations.run('PIK3CA', 'point', 'bladder', 0.45, 2);
    insertMutations.run('BRCA1', 'deletion', 'breast', 0.05, 3);
    insertMutations.run('KRAS', 'point', 'pancreas', 0.90, 2);

    genomicManager = createGenomicManager(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('cancer type support', () => {
    it('should return all supported cancer types', () => {
      const types = genomicManager.getSupportedCancerTypes();
      expect(types).toContain('bladder');
      expect(types).toContain('breast');
      expect(types).toContain('pancreas');
      expect(types.length).toBeGreaterThanOrEqual(3);
    });

    it('should sort cancer types alphabetically', () => {
      const types = genomicManager.getSupportedCancerTypes();
      const sorted = [...types].sort();
      expect(types).toEqual(sorted);
    });
  });

  describe('mutation queries', () => {
    it('should retrieve mutations for bladder cancer', () => {
      const mutations = genomicManager.getMutationsByCancer('bladder');
      expect(mutations.length).toBe(3);
      expect(mutations.map(m => m.gene_name)).toContain('FGFR3');
      expect(mutations.map(m => m.gene_name)).toContain('ARID1A');
      expect(mutations.map(m => m.gene_name)).toContain('PIK3CA');
    });

    it('should retrieve mutations for breast cancer', () => {
      const mutations = genomicManager.getMutationsByCancer('breast');
      expect(mutations.length).toBe(1);
      expect(mutations[0].gene_name).toBe('BRCA1');
    });

    it('should return empty array for unknown cancer type', () => {
      const mutations = genomicManager.getMutationsByCancer('unknown-cancer');
      expect(mutations).toEqual([]);
    });

    it('should include pathway information with mutations', () => {
      const mutations = genomicManager.getMutationsByCancer('bladder');
      const fgfr3Mutation = mutations.find(m => m.gene_name === 'FGFR3');
      expect(fgfr3Mutation.pathway_name).toBe('FGFR Signaling');
      expect(fgfr3Mutation.significance).toBe('HIGH');
    });
  });

  describe('pathway queries', () => {
    it('should retrieve pathways for FGFR3 mutation', () => {
      const pathways = genomicManager.getPathwaysByMutation('FGFR3');
      expect(pathways.length).toBeGreaterThan(0);
      expect(pathways.map(p => p.pathway_name)).toContain('FGFR Signaling');
    });

    it('should retrieve pathways for PIK3CA mutation', () => {
      const pathways = genomicManager.getPathwaysByMutation('PIK3CA');
      expect(pathways.map(p => p.pathway_name)).toContain('PI3K/AKT/mTOR');
    });

    it('should return empty array for mutation with no pathways', () => {
      const pathways = genomicManager.getPathwaysByMutation('NONEXISTENT');
      expect(pathways).toEqual([]);
    });
  });

  describe('treatment recommendations', () => {
    it('should retrieve treatments for FGFR3 mutation in bladder cancer', () => {
      const insertTreatment = db.prepare(`
        INSERT INTO treatments (mutation_id, drug_name, evidence_level, approval_status)
        VALUES (?, ?, ?, ?)
      `);
      
      const fgfr3Mutation = db.prepare('SELECT id FROM genomic_mutations WHERE gene_name = ?').get('FGFR3');
      insertTreatment.run(fgfr3Mutation.id, 'erdafitinib', 'HIGH', 'FDA_APPROVED');

      const treatments = genomicManager.getTreatmentsByMutation('FGFR3', 'bladder');
      expect(treatments.length).toBeGreaterThan(0);
      expect(treatments[0].drug_name).toBe('erdafitinib');
    });

    it('should sort treatments by evidence level', () => {
      const insertTreatment = db.prepare(`
        INSERT INTO treatments (mutation_id, drug_name, evidence_level, approval_status)
        VALUES (?, ?, ?, ?)
      `);

      const piMutation = db.prepare('SELECT id FROM genomic_mutations WHERE gene_name = ?').get('PIK3CA');
      insertTreatment.run(piMutation.id, 'ipatasertib', 'HIGH', 'INVESTIGATIONAL');
      insertTreatment.run(piMutation.id, 'alternative', 'LOW', 'INVESTIGATIONAL');

      const treatments = genomicManager.getTreatmentsByMutation('PIK3CA', 'bladder');
      expect(treatments.length).toBeGreaterThan(1);
      expect(treatments[0].evidence_level).toBe('HIGH');
    });
  });

  describe('clinical trial matching', () => {
    it('should retrieve active clinical trials for cancer and pathway', () => {
      const insertTrial = db.prepare(`
        INSERT INTO clinical_trials (trial_name, cancer_type, status, enrollment_status)
        VALUES (?, ?, ?, ?)
      `);

      const insertTrialPathway = db.prepare(`
        INSERT INTO trial_pathways (trial_id, pathway_id)
        VALUES (?, ?)
      `);

      const trialId = insertTrial.run('BT8009 Trial', 'bladder', 'active', 'OPEN').lastInsertRowid;
      insertTrialPathway.run(trialId, 1); // FGFR pathway

      const trials = genomicManager.getActiveClinicalTrials('bladder', 'FGFR Signaling');
      expect(trials.length).toBeGreaterThan(0);
      expect(trials[0].trial_name).toBe('BT8009 Trial');
    });
  });
});
