-- Meal Analysis Storage
-- Stores AI-generated meal analyses so they can be re-viewed without re-analyzing

CREATE TABLE IF NOT EXISTS meal_analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meal_id INTEGER NOT NULL,
  analysis_data TEXT NOT NULL,  -- JSON blob of full analysis
  model TEXT,                    -- Which AI model was used
  analyzed_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_meal_analyses_meal_id ON meal_analyses(meal_id);
