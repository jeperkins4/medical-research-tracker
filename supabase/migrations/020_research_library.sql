-- Research Library Schema (Non-PHI)
-- Papers, Clinical Trials, Tags - Safe to store in cloud

-- Papers table (research articles)
CREATE TABLE IF NOT EXISTS papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pubmed_id TEXT UNIQUE,
  title TEXT NOT NULL,
  authors TEXT,
  journal TEXT,
  publication_date TEXT,
  abstract TEXT,
  url TEXT,
  type TEXT DEFAULT 'conventional',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Paper notes (could contain PHI - be careful)
-- Only sync if user explicitly opts in
CREATE TABLE IF NOT EXISTS paper_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clinical trials (non-PHI)
CREATE TABLE IF NOT EXISTS clinical_trials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nct_id TEXT UNIQUE,
  title TEXT NOT NULL,
  status TEXT,
  phase TEXT,
  conditions TEXT,
  interventions TEXT,
  locations TEXT,
  url TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tags (non-PHI)
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Paper-Tag associations
CREATE TABLE IF NOT EXISTS paper_tags (
  paper_id UUID REFERENCES papers(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (paper_id, tag_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_papers_user ON papers(user_id);
CREATE INDEX IF NOT EXISTS idx_papers_pubmed ON papers(pubmed_id);
CREATE INDEX IF NOT EXISTS idx_papers_type ON papers(type);
CREATE INDEX IF NOT EXISTS idx_paper_notes_paper ON paper_notes(paper_id);
CREATE INDEX IF NOT EXISTS idx_trials_user ON clinical_trials(user_id);
CREATE INDEX IF NOT EXISTS idx_trials_nct ON clinical_trials(nct_id);
CREATE INDEX IF NOT EXISTS idx_tags_user ON tags(user_id);

-- Row Level Security (RLS)
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_trials ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own data
CREATE POLICY "Users can view own papers"
  ON papers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own papers"
  ON papers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own papers"
  ON papers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own papers"
  ON papers FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own paper notes"
  ON paper_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own paper notes"
  ON paper_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own paper notes"
  ON paper_notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own paper notes"
  ON paper_notes FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own trials"
  ON clinical_trials FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trials"
  ON clinical_trials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trials"
  ON clinical_trials FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own trials"
  ON clinical_trials FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own tags"
  ON tags FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tags"
  ON tags FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tags"
  ON tags FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tags"
  ON tags FOR DELETE
  USING (auth.uid() = user_id);

-- paper_tags: user can manage if they own the paper
CREATE POLICY "Users can manage own paper tags"
  ON paper_tags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM papers
      WHERE papers.id = paper_tags.paper_id
      AND papers.user_id = auth.uid()
    )
  );

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_papers_updated_at
  BEFORE UPDATE ON papers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
