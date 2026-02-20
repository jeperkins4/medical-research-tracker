/**
 * Cloud Sync Service
 * Syncs local data to Supabase (research papers, user profiles)
 * PHI (medications, labs, vitals) NEVER syncs - stays encrypted locally
 */

import { createClient } from '@supabase/supabase-js';
import { query, run } from './db-secure.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY; // Service role key (server-side only)

let supabase = null;

/**
 * Initialize Supabase client (server-side with service role)
 */
export function initSupabase() {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('⚠️  Supabase not configured - cloud sync disabled');
    return null;
  }
  
  if (!supabase) {
    supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  
  return supabase;
}

/**
 * Check if Supabase is available
 */
export function isCloudSyncAvailable() {
  return !!(supabaseUrl && supabaseServiceKey);
}

/**
 * Log sync event
 */
function logSync(userId, syncType, status, itemsSynced = 0, errorMessage = null) {
  try {
    run(
      'INSERT INTO sync_log (user_id, sync_type, status, items_synced, error_message) VALUES (?, ?, ?, ?, ?)',
      [userId, syncType, status, itemsSynced, errorMessage]
    );
  } catch (err) {
    console.error('Failed to log sync:', err);
  }
}

/**
 * Create Supabase Auth user + profile from local user
 */
export async function syncUserToCloud(localUserId, email, password) {
  const client = initSupabase();
  if (!client) {
    throw new Error('Cloud sync not configured');
  }
  
  logSync(localUserId, 'user', 'started');
  
  try {
    // Get local user
    const users = query('SELECT * FROM users WHERE id = ?', [localUserId]);
    if (users.length === 0) {
      throw new Error('User not found');
    }
    
    const localUser = users[0];
    
    // Check if already synced
    if (localUser.supabase_user_id) {
      console.log('✓ User already synced:', localUser.supabase_user_id);
      return { supabaseUserId: localUser.supabase_user_id, alreadySynced: true };
    }
    
    // Create Supabase Auth user
    const { data: authData, error: authError } = await client.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true
    });
    
    if (authError) {
      throw new Error(`Failed to create Supabase user: ${authError.message}`);
    }
    
    const supabaseUserId = authData.user.id;
    
    // Create user profile in Supabase
    const { error: profileError } = await client
      .from('user_profiles')
      .insert({
        id: supabaseUserId,
        email: email,
        settings: {},
        research_preferences: []
      });
    
    if (profileError) {
      console.error('Failed to create profile:', profileError);
      // Not fatal - auth user still created
    }
    
    // Update local user with Supabase ID
    run(
      'UPDATE users SET supabase_user_id = ?, email = ?, last_synced_at = CURRENT_TIMESTAMP, sync_status = ? WHERE id = ?',
      [supabaseUserId, email, 'synced', localUserId]
    );
    
    logSync(localUserId, 'user', 'completed', 1);
    
    console.log('✅ User synced to cloud:', supabaseUserId);
    
    return { supabaseUserId, created: true };
    
  } catch (err) {
    logSync(localUserId, 'user', 'failed', 0, err.message);
    
    run(
      'UPDATE users SET sync_status = ? WHERE id = ?',
      ['sync_failed', localUserId]
    );
    
    throw err;
  }
}

/**
 * Sync research papers to Supabase
 */
export async function syncResearchToCloud(localUserId) {
  const client = initSupabase();
  if (!client) {
    throw new Error('Cloud sync not configured');
  }
  
  logSync(localUserId, 'research', 'started');
  
  try {
    // Get local user's Supabase ID
    const users = query('SELECT supabase_user_id FROM users WHERE id = ?', [localUserId]);
    if (users.length === 0 || !users[0].supabase_user_id) {
      throw new Error('User not synced to cloud yet - sync user first');
    }
    
    const supabaseUserId = users[0].supabase_user_id;
    
    // Get unsynced papers
    const papers = query(
      'SELECT * FROM papers WHERE supabase_paper_id IS NULL OR synced_at IS NULL'
    );
    
    if (papers.length === 0) {
      console.log('✓ No papers to sync');
      logSync(localUserId, 'research', 'completed', 0);
      return { synced: 0 };
    }
    
    let syncedCount = 0;
    
    for (const paper of papers) {
      try {
        // Prepare paper data for Supabase (NO PHI)
        const paperData = {
          user_id: supabaseUserId,
          title: paper.title,
          authors: paper.authors,
          journal: paper.journal,
          publication_date: paper.publication_date,
          abstract: paper.abstract,
          pubmed_id: paper.pmid || paper.pubmed_id,
          doi: paper.doi,
          url: paper.url,
          cancer_types: paper.cancer_type ? [paper.cancer_type] : [],
          mutations: [], // TODO: Extract from tags
          treatment_types: paper.type ? [paper.type] : [],
          tags: [], // TODO: Sync tags
          notes: null // User notes stay local (could be PHI)
        };
        
        // Insert or update in Supabase
        const { data, error } = await client
          .from('research_library')
          .upsert(paperData, { onConflict: 'pubmed_id' })
          .select();
        
        if (error) {
          console.error(`Failed to sync paper ${paper.id}:`, error);
          continue;
        }
        
        const supabasePaperId = data[0].id;
        
        // Update local paper with Supabase ID
        run(
          'UPDATE papers SET supabase_paper_id = ?, synced_at = CURRENT_TIMESTAMP WHERE id = ?',
          [supabasePaperId, paper.id]
        );
        
        syncedCount++;
        
      } catch (err) {
        console.error(`Error syncing paper ${paper.id}:`, err);
      }
    }
    
    // Update user sync status
    run(
      'UPDATE users SET last_synced_at = CURRENT_TIMESTAMP WHERE id = ?',
      [localUserId]
    );
    
    logSync(localUserId, 'research', 'completed', syncedCount);
    
    console.log(`✅ Synced ${syncedCount} papers to cloud`);
    
    return { synced: syncedCount };
    
  } catch (err) {
    logSync(localUserId, 'research', 'failed', 0, err.message);
    throw err;
  }
}

/**
 * Get sync status for a user
 */
export function getSyncStatus(localUserId) {
  const users = query('SELECT supabase_user_id, email, last_synced_at, sync_status FROM users WHERE id = ?', [localUserId]);
  
  if (users.length === 0) {
    return { available: false, error: 'User not found' };
  }
  
  const user = users[0];
  
  // Count unsynced papers
  const unsyncedPapers = query('SELECT COUNT(*) as count FROM papers WHERE supabase_paper_id IS NULL');
  
  // Get last sync log
  const lastSync = query(
    'SELECT * FROM sync_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
    [localUserId]
  );
  
  return {
    available: isCloudSyncAvailable(),
    cloudConnected: !!user.supabase_user_id,
    supabaseUserId: user.supabase_user_id,
    email: user.email,
    lastSyncedAt: user.last_synced_at,
    syncStatus: user.sync_status,
    unsyncedPapers: unsyncedPapers[0].count,
    lastSyncLog: lastSync[0] || null
  };
}

/**
 * Full sync (user + research)
 */
export async function fullSync(localUserId, email, password) {
  const client = initSupabase();
  if (!client) {
    throw new Error('Cloud sync not configured');
  }
  
  logSync(localUserId, 'full', 'started');
  
  try {
    // Step 1: Sync user (if not already synced)
    const userResult = await syncUserToCloud(localUserId, email, password);
    
    // Step 2: Sync research papers
    const researchResult = await syncResearchToCloud(localUserId);
    
    logSync(localUserId, 'full', 'completed', researchResult.synced);
    
    return {
      user: userResult,
      research: researchResult
    };
    
  } catch (err) {
    logSync(localUserId, 'full', 'failed', 0, err.message);
    throw err;
  }
}
