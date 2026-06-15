-- MyTreatmentPath Cloud Database Schema
-- NON-PHI DATA ONLY
-- All patient health data stays local (encrypted SQLite)

-- ============================================================================
-- User Profiles (extends Supabase auth.users)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
  settings JSONB DEFAULT '{}'::jsonb,
  research_preferences JSONB DEFAULT '[]'::jsonb
);

-- Row-level security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);

-- ============================================================================
-- Research Library (public research papers, user-specific saves)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.research_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Paper metadata
  title TEXT NOT NULL,
  authors TEXT,
  journal TEXT,
  publication_date DATE,
  abstract TEXT,
  pubmed_id TEXT,
  doi TEXT,
  url TEXT,
  
  -- Classification (non-PHI)
  cancer_types TEXT[], -- e.g., ['bladder', 'lung']
  mutations TEXT[], -- e.g., ['FGFR3', 'ARID1A']
  treatment_types TEXT[], -- e.g., ['chemotherapy', 'immunotherapy']
  tags TEXT[],
  
  -- User-specific
  notes TEXT, -- User's personal notes about the paper
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row-level security
ALTER TABLE research_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own research"
  ON research_library FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own research"
  ON research_library FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own research"
  ON research_library FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own research"
  ON research_library FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_research_user ON research_library(user_id);
CREATE INDEX IF NOT EXISTS idx_research_cancer ON research_library USING GIN(cancer_types);
CREATE INDEX IF NOT EXISTS idx_research_mutations ON research_library USING GIN(mutations);
CREATE INDEX IF NOT EXISTS idx_research_pubmed ON research_library(pubmed_id) WHERE pubmed_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_research_saved_at ON research_library(user_id, saved_at DESC);

-- ============================================================================
-- Backup Metadata (encrypted backup blobs stored in Supabase Storage)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.backup_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Backup details
  backup_path TEXT NOT NULL, -- Path in Supabase Storage
  created_at TIMESTAMPTZ DEFAULT NOW(),
  size_bytes BIGINT,
  encrypted BOOLEAN DEFAULT true,
  
  -- Device info (for user to identify which backup)
  device_name TEXT, -- e.g., "John's MacBook Pro"
  app_version TEXT, -- e.g., "0.1.0"
  database_version INTEGER, -- For migration tracking
  
  -- Status
  status TEXT DEFAULT 'completed' CHECK (status IN ('in_progress', 'completed', 'failed')),
  error_message TEXT
);

-- Row-level security
ALTER TABLE backup_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own backups"
  ON backup_metadata FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own backups"
  ON backup_metadata FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own backups"
  ON backup_metadata FOR DELETE
  USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_backup_user_created ON backup_metadata(user_id, created_at DESC);

-- ============================================================================
-- Research Scan Results (daily automated scans)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.research_scan_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Scan details
  scan_date DATE NOT NULL,
  search_term TEXT NOT NULL,
  papers_found INTEGER DEFAULT 0,
  
  -- Results (references to research_library)
  paper_ids UUID[],
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row-level security
ALTER TABLE research_scan_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scan results"
  ON research_scan_results FOR SELECT
  USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_scan_user_date ON research_scan_results(user_id, scan_date DESC);

-- ============================================================================
-- Functions & Triggers
-- ============================================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_research_library_updated_at
  BEFORE UPDATE ON research_library
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create user profile automatically on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- Storage Buckets (for encrypted backups)
-- ============================================================================

-- Create storage bucket for backups
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload own backups"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'backups' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own backups"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'backups' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own backups"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'backups' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================================
-- Indexes & Optimization
-- ============================================================================

-- Vacuum and analyze tables
VACUUM ANALYZE user_profiles;
VACUUM ANALYZE research_library;
VACUUM ANALYZE backup_metadata;
VACUUM ANALYZE research_scan_results;

-- ============================================================================
-- Comments (documentation)
-- ============================================================================

COMMENT ON TABLE user_profiles IS 'User account settings and preferences. NO PHI.';
COMMENT ON TABLE research_library IS 'Public research papers saved by users. NO PHI.';
COMMENT ON TABLE backup_metadata IS 'Metadata for encrypted database backups. Actual backups in Storage. NO PHI.';
COMMENT ON TABLE research_scan_results IS 'Results from automated daily research scans. NO PHI.';

COMMENT ON COLUMN user_profiles.settings IS 'App settings (theme, notifications, etc.)';
COMMENT ON COLUMN user_profiles.research_preferences IS 'Search terms for daily scans (cancer type, mutations)';
COMMENT ON COLUMN backup_metadata.backup_path IS 'Path to encrypted backup blob in Supabase Storage';
COMMENT ON COLUMN backup_metadata.encrypted IS 'Always true - backups are encrypted client-side before upload';
