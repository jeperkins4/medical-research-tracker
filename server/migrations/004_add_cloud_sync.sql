-- Add cloud sync tracking to users table
ALTER TABLE users ADD COLUMN supabase_user_id TEXT;
ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN last_synced_at TEXT;
ALTER TABLE users ADD COLUMN sync_status TEXT DEFAULT 'local_only' CHECK (sync_status IN ('local_only', 'syncing', 'synced', 'sync_failed'));

-- Add sync tracking to papers
ALTER TABLE papers ADD COLUMN supabase_paper_id TEXT;
ALTER TABLE papers ADD COLUMN synced_at TEXT;

-- Create sync log table
CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  sync_type TEXT NOT NULL, -- 'user', 'research', 'full'
  status TEXT NOT NULL, -- 'started', 'completed', 'failed'
  items_synced INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Index for sync queries
CREATE INDEX IF NOT EXISTS idx_sync_log_user ON sync_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_supabase ON users(supabase_user_id);
CREATE INDEX IF NOT EXISTS idx_papers_supabase ON papers(supabase_paper_id);
