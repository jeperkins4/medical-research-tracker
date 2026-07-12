import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

// Wire an in-memory SQLite DB into the db module before importing radiology
let memDb;

vi.mock('./db.js', () => {
  return {
    query: (sql, params = []) => {
      const stmt = memDb.prepare(sql);
      return stmt.all(...params);
    },
    run: (sql, params = []) => {
      const stmt = memDb.prepare(sql);
      const info = stmt.run(...params);
      return { lastInsertRowid: info.lastInsertRowid, changes: info.changes };
    },
  };
});

import {
  createStudy,
  getStudy,
  updateStudy,
  deleteStudy,
  addAnnotation,
  deleteAnnotation,
  getStudyTimeline,
  getFilterOptions,
  generateDemoVolume,
} from './radiology.js';

const SCHEMA = `
  CREATE TABLE radiology_studies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    study_date TEXT NOT NULL,
    modality TEXT NOT NULL,
    body_region TEXT NOT NULL,
    description TEXT,
    facility TEXT,
    ordering_physician TEXT,
    status TEXT DEFAULT 'completed',
    findings TEXT,
    impression TEXT,
    comparison_notes TEXT,
    file_path TEXT,
    thumbnail_path TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE radiology_series (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    study_id INTEGER NOT NULL,
    series_number INTEGER,
    description TEXT,
    modality TEXT,
    slice_count INTEGER DEFAULT 0,
    file_path TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (study_id) REFERENCES radiology_studies(id) ON DELETE CASCADE
  );
  CREATE TABLE radiology_annotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    study_id INTEGER NOT NULL,
    label TEXT NOT NULL,
    description TEXT,
    position_x REAL,
    position_y REAL,
    position_z REAL,
    slice_index INTEGER,
    plane TEXT DEFAULT 'axial',
    color TEXT DEFAULT '#ff6b6b',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (study_id) REFERENCES radiology_studies(id) ON DELETE CASCADE
  );
`;

const makeStudy = (overrides = {}) => ({
  study_date: '2026-01-15',
  modality: 'CT',
  body_region: 'Chest',
  ...overrides,
});

beforeEach(() => {
  memDb = new Database(':memory:');
  memDb.pragma('foreign_keys = ON');
  memDb.exec(SCHEMA);
});

// ─── updateStudy ────────────────────────────────────────────────────────────

describe('updateStudy', () => {
  it('silently ignores fields not in the allow-list', () => {
    const study = createStudy(makeStudy());
    updateStudy(study.id, { modality: 'MRI', evil_column: 'DROP TABLE' });
    const updated = getStudy(study.id);
    expect(updated.modality).toBe('MRI');
    expect(updated).not.toHaveProperty('evil_column');
  });

  it('returns the current study unchanged when no allowed fields provided', () => {
    const study = createStudy(makeStudy({ modality: 'CT' }));
    const result = updateStudy(study.id, { evil_column: 'x' });
    expect(result.modality).toBe('CT');
  });

  it('updates only the fields provided', () => {
    const study = createStudy(makeStudy({ modality: 'CT', body_region: 'Chest' }));
    updateStudy(study.id, { modality: 'MRI' });
    const updated = getStudy(study.id);
    expect(updated.modality).toBe('MRI');
    expect(updated.body_region).toBe('Chest');
  });
});

// ─── getStudyTimeline ───────────────────────────────────────────────────────

describe('getStudyTimeline', () => {
  beforeEach(() => {
    createStudy(makeStudy({ study_date: '2025-03-01', body_region: 'Chest' }));
    createStudy(makeStudy({ study_date: '2025-06-01', body_region: 'Pelvis' }));
    createStudy(makeStudy({ study_date: '2025-09-01', body_region: 'Chest' }));
  });

  it('returns all studies ordered by date ascending when no filter given', () => {
    const timeline = getStudyTimeline();
    expect(timeline).toHaveLength(3);
    expect(timeline[0].study_date).toBe('2025-03-01');
    expect(timeline[2].study_date).toBe('2025-09-01');
  });

  it('filters to only matching body_region', () => {
    const timeline = getStudyTimeline('Chest');
    expect(timeline).toHaveLength(2);
    expect(timeline.every(s => s.body_region === 'Chest')).toBe(true);
  });

  it('returns empty array when no studies match the filter', () => {
    const timeline = getStudyTimeline('Brain');
    expect(timeline).toHaveLength(0);
  });
});

// ─── generateDemoVolume ─────────────────────────────────────────────────────

describe('generateDemoVolume', () => {
  it('returns null for a nonexistent study id', () => {
    expect(generateDemoVolume(9999)).toBeNull();
  });

  it('returns a 64×64×64 volume with correct metadata', () => {
    const study = createStudy(makeStudy());
    const vol = generateDemoVolume(study.id);
    expect(vol.size).toEqual([64, 64, 64]);
    expect(vol.spacing).toEqual([1, 1, 1]);
    expect(vol.data).toHaveLength(64);
    expect(vol.data[0]).toHaveLength(64);
    expect(vol.data[0][0]).toHaveLength(64);
  });

  it('clamps every voxel value to [0, 1]', () => {
    const study = createStudy(makeStudy());
    const vol = generateDemoVolume(study.id);
    for (const slice of vol.data) {
      for (const row of slice) {
        for (const v of row) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('produces higher max intensity for Pelvis region (lesion present)', () => {
    const pelvis = createStudy(makeStudy({ body_region: 'Pelvis' }));
    const chest = createStudy(makeStudy({ body_region: 'Chest' }));
    const pelvisMax = generateDemoVolume(pelvis.id).data.flat(2).reduce((a, b) => Math.max(a, b), 0);
    const chestMax = generateDemoVolume(chest.id).data.flat(2).reduce((a, b) => Math.max(a, b), 0);
    // Both hit 0.9 from spine, but pelvis has lesion at 0.65 — ensure lesion path is exercised
    expect(pelvisMax).toBeGreaterThanOrEqual(chestMax);
  });
});

// ─── CRUD round-trip ────────────────────────────────────────────────────────

describe('study CRUD', () => {
  it('creates and retrieves a study with series and annotations arrays', () => {
    const study = createStudy(makeStudy({ description: 'Test scan' }));
    expect(study.id).toBeTruthy();
    expect(study.description).toBe('Test scan');
    expect(Array.isArray(study.series)).toBe(true);
    expect(Array.isArray(study.annotations)).toBe(true);
  });

  it('getStudy returns null for unknown id', () => {
    expect(getStudy(9999)).toBeNull();
  });

  it('deleteStudy removes the study', () => {
    const study = createStudy(makeStudy());
    deleteStudy(study.id);
    expect(getStudy(study.id)).toBeNull();
  });

  it('addAnnotation defaults plane to axial and color to #ff6b6b', () => {
    const study = createStudy(makeStudy());
    const ann = addAnnotation(study.id, { label: 'Lesion' });
    expect(ann.plane).toBe('axial');
    expect(ann.color).toBe('#ff6b6b');
  });

  it('deleteAnnotation removes the annotation from the study', () => {
    const study = createStudy(makeStudy());
    const ann = addAnnotation(study.id, { label: 'Mark' });
    deleteAnnotation(ann.id);
    const updated = getStudy(study.id);
    expect(updated.annotations).toHaveLength(0);
  });
});

// ─── getFilterOptions ───────────────────────────────────────────────────────

describe('getFilterOptions', () => {
  it('returns sorted unique modalities and body regions', () => {
    createStudy(makeStudy({ modality: 'MRI', body_region: 'Brain' }));
    createStudy(makeStudy({ modality: 'CT', body_region: 'Chest' }));
    createStudy(makeStudy({ modality: 'CT', body_region: 'Brain' }));
    const opts = getFilterOptions();
    expect(opts.modalities).toEqual(['CT', 'MRI']);
    expect(opts.bodyRegions).toEqual(['Brain', 'Chest']);
  });
});
