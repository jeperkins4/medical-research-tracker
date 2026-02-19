#!/usr/bin/env node
/**
 * Migrate Non-PHI Research Data to Supabase
 * 
 * Copies research papers, clinical trials, and tags from local SQLite → Supabase
 * Does NOT migrate patient health data (stays encrypted locally)
 */

import Database from 'better-sqlite3-multiple-ciphers';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // Use service key to bypass RLS
const DB_KEY = process.env.DB_ENCRYPTION_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials in .env');
  console.error('   Required: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

if (!DB_KEY) {
  console.error('❌ Missing DB_ENCRYPTION_KEY in .env');
  process.exit(1);
}

// Initialize Supabase client with service key (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Initialize local SQLite database
const dbPath = join(__dirname, 'data', 'health-secure.db');
const db = new Database(dbPath);
db.pragma(`key = "${DB_KEY}"`);
db.pragma('cipher_compatibility = 4');

console.log('🔄 Starting Supabase Migration...\n');

/**
 * Step 1: Migrate Papers
 */
async function migratePapers(userId) {
  console.log('📚 Migrating research papers...');
  
  const papers = db.prepare('SELECT * FROM papers').all();
  
  if (papers.length === 0) {
    console.log('   No papers to migrate');
    return { papers: [], idMap: {} };
  }
  
  const idMap = {}; // SQLite ID → Supabase UUID
  const migratedPapers = [];
  
  for (const paper of papers) {
    const { data, error } = await supabase
      .from('papers')
      .insert({
        pubmed_id: paper.pubmed_id,
        title: paper.title,
        authors: paper.authors,
        journal: paper.journal,
        publication_date: paper.publication_date,
        abstract: paper.abstract,
        url: paper.url,
        type: paper.type || 'conventional',
        user_id: userId,
        saved_at: paper.saved_at
      })
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') {
        // Duplicate - fetch existing
        const { data: existing } = await supabase
          .from('papers')
          .select('id')
          .eq('pubmed_id', paper.pubmed_id)
          .single();
        
        if (existing) {
          idMap[paper.id] = existing.id;
          console.log(`   ⚠️  Skipped duplicate: ${paper.title}`);
        }
      } else {
        console.error(`   ❌ Failed to migrate: ${paper.title}`, error.message);
      }
    } else {
      idMap[paper.id] = data.id;
      migratedPapers.push(data);
      console.log(`   ✅ ${paper.title}`);
    }
  }
  
  console.log(`   📊 Migrated ${migratedPapers.length}/${papers.length} papers\n`);
  return { papers: migratedPapers, idMap };
}

/**
 * Step 2: Migrate Tags
 */
async function migrateTags(userId) {
  console.log('🏷️  Migrating tags...');
  
  const tags = db.prepare('SELECT * FROM tags').all();
  
  if (tags.length === 0) {
    console.log('   No tags to migrate');
    return { tags: [], idMap: {} };
  }
  
  const idMap = {};
  const migratedTags = [];
  
  for (const tag of tags) {
    const { data, error } = await supabase
      .from('tags')
      .insert({
        name: tag.name,
        user_id: userId
      })
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') {
        // Duplicate - fetch existing
        const { data: existing } = await supabase
          .from('tags')
          .select('id')
          .eq('name', tag.name)
          .single();
        
        if (existing) {
          idMap[tag.id] = existing.id;
          console.log(`   ⚠️  Skipped duplicate: ${tag.name}`);
        }
      } else {
        console.error(`   ❌ Failed to migrate: ${tag.name}`, error.message);
      }
    } else {
      idMap[tag.id] = data.id;
      migratedTags.push(data);
      console.log(`   ✅ ${tag.name}`);
    }
  }
  
  console.log(`   📊 Migrated ${migratedTags.length}/${tags.length} tags\n`);
  return { tags: migratedTags, idMap };
}

/**
 * Step 3: Migrate Paper-Tag Associations
 */
async function migratePaperTags(paperIdMap, tagIdMap) {
  console.log('🔗 Migrating paper-tag associations...');
  
  const paperTags = db.prepare('SELECT * FROM paper_tags').all();
  
  if (paperTags.length === 0) {
    console.log('   No associations to migrate');
    return;
  }
  
  let migrated = 0;
  
  for (const pt of paperTags) {
    const paperId = paperIdMap[pt.paper_id];
    const tagId = tagIdMap[pt.tag_id];
    
    if (!paperId || !tagId) {
      console.log(`   ⚠️  Skipped invalid association (paper ${pt.paper_id}, tag ${pt.tag_id})`);
      continue;
    }
    
    const { error } = await supabase
      .from('paper_tags')
      .insert({
        paper_id: paperId,
        tag_id: tagId
      });
    
    if (error && error.code !== '23505') {
      console.error(`   ❌ Failed to migrate association`, error.message);
    } else {
      migrated++;
    }
  }
  
  console.log(`   📊 Migrated ${migrated}/${paperTags.length} associations\n`);
}

/**
 * Step 4: Migrate Clinical Trials
 */
async function migrateTrials(userId) {
  console.log('🔬 Migrating clinical trials...');
  
  const trials = db.prepare('SELECT * FROM clinical_trials').all();
  
  if (trials.length === 0) {
    console.log('   No trials to migrate');
    return;
  }
  
  let migrated = 0;
  
  for (const trial of trials) {
    const { error } = await supabase
      .from('clinical_trials')
      .insert({
        nct_id: trial.nct_id,
        title: trial.title,
        status: trial.status,
        phase: trial.phase,
        conditions: trial.conditions,
        interventions: trial.interventions,
        locations: trial.locations,
        url: trial.url,
        user_id: userId,
        saved_at: trial.saved_at
      });
    
    if (error) {
      if (error.code === '23505') {
        console.log(`   ⚠️  Skipped duplicate: ${trial.nct_id}`);
      } else {
        console.error(`   ❌ Failed to migrate: ${trial.title}`, error.message);
      }
    } else {
      migrated++;
      console.log(`   ✅ ${trial.title}`);
    }
  }
  
  console.log(`   📊 Migrated ${migrated}/${trials.length} trials\n`);
}

/**
 * Main Migration
 */
async function main() {
  try {
    // Get or create user account
    // NOTE: This assumes you've already created a Supabase Auth user
    // You need to provide the user ID here
    
    console.log('⚠️  IMPORTANT: You must provide your Supabase user ID');
    console.log('   1. Log in to Supabase dashboard: https://app.supabase.com');
    console.log('   2. Go to Authentication → Users');
    console.log('   3. Create a new user (or use existing)');
    console.log('   4. Copy the UUID and pass it as --user-id argument\n');
    
    const userIdArg = process.argv.find(arg => arg.startsWith('--user-id='));
    if (!userIdArg) {
      console.error('❌ Missing --user-id argument');
      console.error('   Usage: node migrate-to-supabase.mjs --user-id=YOUR_UUID');
      process.exit(1);
    }
    
    const userId = userIdArg.split('=')[1];
    console.log(`📝 Using user ID: ${userId}\n`);
    
    // Migrate data
    const { idMap: paperIdMap } = await migratePapers(userId);
    const { idMap: tagIdMap } = await migrateTags(userId);
    await migratePaperTags(paperIdMap, tagIdMap);
    await migrateTrials(userId);
    
    console.log('✅ Migration complete!\n');
    console.log('📊 Summary:');
    console.log(`   Papers: ${Object.keys(paperIdMap).length}`);
    console.log(`   Tags: ${Object.keys(tagIdMap).length}`);
    console.log('\n🔒 PHI Data Status: Still encrypted locally (not migrated)');
    
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
