-- Nutrition Module Schema
-- Supports meal logging, food-pathway mapping, and genomics-driven nutrition recommendations

-- Foods database with nutrient profiles
CREATE TABLE IF NOT EXISTS foods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  category TEXT, -- vegetable, fruit, protein, grain, legume, spice, beverage
  serving_size TEXT, -- e.g., "1 cup", "100g", "1 medium"
  calories REAL,
  anti_inflammatory_score REAL, -- 0-10 scale
  anti_cancer_score REAL, -- 0-10 scale (based on research)
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Food-pathway mapping (genomics-driven nutrition)
CREATE TABLE IF NOT EXISTS food_pathways (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  food_id INTEGER NOT NULL,
  pathway_id INTEGER NOT NULL,
  mechanism TEXT NOT NULL, -- e.g., "Curcumin inhibits HIF-1α transcription"
  evidence_level TEXT, -- clinical_trial, in_vitro, epidemiological, traditional
  research_link TEXT,
  potency_score REAL, -- 0-10 (how effective for this pathway)
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE CASCADE,
  FOREIGN KEY (pathway_id) REFERENCES genomic_pathways(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_food_pathways_food ON food_pathways(food_id);
CREATE INDEX IF NOT EXISTS idx_food_pathways_pathway ON food_pathways(pathway_id);

-- Meal logging
CREATE TABLE IF NOT EXISTS meals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  time TEXT,
  meal_type TEXT, -- breakfast, lunch, dinner, snack
  description TEXT, -- Free-form meal description
  treatment_phase TEXT, -- chemo_week, recovery_week, maintenance, pre_treatment
  energy_level INTEGER, -- 1-10 (how did you feel after?)
  nausea_level INTEGER, -- 0-10 (0 = none, 10 = severe)
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_meals_date ON meals(date);

-- Meal-food junction (what foods were in this meal)
CREATE TABLE IF NOT EXISTS meal_foods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meal_id INTEGER NOT NULL,
  food_id INTEGER NOT NULL,
  portion_size TEXT, -- e.g., "1 cup", "2 tbsp", "small bowl"
  FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE,
  FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_meal_foods_meal ON meal_foods(meal_id);
CREATE INDEX IF NOT EXISTS idx_meal_foods_food ON meal_foods(food_id);

-- Nutrition goals (genomics-driven targets)
CREATE TABLE IF NOT EXISTS nutrition_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nutrient TEXT NOT NULL, -- curcumin, sulforaphane, vitamin_d, omega3, etc.
  target_daily REAL,
  unit TEXT, -- mg, g, IU, mcg
  rationale TEXT NOT NULL, -- "Supports ARID1A pathway suppression"
  mutation_id INTEGER,
  pathway_id INTEGER,
  priority TEXT, -- critical, high, medium, low
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mutation_id) REFERENCES genomic_mutations(id),
  FOREIGN KEY (pathway_id) REFERENCES genomic_pathways(id)
);

-- Pre-populate with anti-cancer superfoods
INSERT OR IGNORE INTO foods (name, category, serving_size, anti_inflammatory_score, anti_cancer_score, notes) VALUES
  ('Turmeric (Curcumin)', 'spice', '1 tsp', 10, 9, 'Potent HIF-1α inhibitor, anti-inflammatory, enhances chemo efficacy'),
  ('Ginger', 'spice', '1 tbsp fresh', 8, 7, 'Anti-nausea, anti-inflammatory, gingerols inhibit cancer growth'),
  ('Carrot (Beta-carotene)', 'vegetable', '1 medium', 7, 8, 'Antioxidant, immune support, converts to Vitamin A'),
  ('Broccoli Sprouts (Sulforaphane)', 'vegetable', '1/4 cup', 9, 10, 'Nrf2 activation, HIF-1α suppression, induces cancer cell apoptosis'),
  ('Green Tea (EGCG)', 'beverage', '1 cup', 8, 9, 'Inhibits HIF-1α, anti-angiogenic, EGCG synergizes with chemo'),
  ('Pomegranate', 'fruit', '1/2 cup seeds', 8, 8, 'Ellagic acid = anti-angiogenic, inhibits metastasis'),
  ('Garlic (Allicin)', 'vegetable', '2 cloves', 7, 8, 'HIF-1α downregulation, immune modulation, anti-cancer'),
  ('Blueberries', 'fruit', '1 cup', 7, 7, 'Anthocyanins = antioxidant, anti-inflammatory, inhibit cancer stem cells'),
  ('Cruciferous Vegetables', 'vegetable', '1 cup cooked', 8, 9, 'Sulforaphane, DIM = estrogen metabolism, cancer prevention'),
  ('Walnuts (Omega-3)', 'protein', '1/4 cup', 8, 7, 'Anti-inflammatory, ALA omega-3, supports immune function'),
  ('Extra Virgin Olive Oil', 'fat', '1 tbsp', 9, 7, 'Oleocanthal = anti-inflammatory, Mediterranean diet staple'),
  ('Dark Chocolate (70%+)', 'treat', '1 oz', 6, 6, 'Flavonoids = antioxidant, improves mood (in moderation)'),
  ('Mushrooms (Beta-glucans)', 'vegetable', '1 cup cooked', 7, 8, 'Immune modulation, anti-tumor polysaccharides'),
  ('Tomatoes (Lycopene)', 'vegetable', '1 medium', 6, 7, 'Lycopene = antioxidant, anti-angiogenic'),
  ('Spinach', 'vegetable', '1 cup raw', 7, 7, 'Folate, iron, lutein = antioxidant, nutrient-dense'),
  ('Wild Salmon (Omega-3)', 'protein', '4 oz', 9, 8, 'EPA/DHA omega-3 = anti-inflammatory, supports immune function'),
  ('Avocado', 'fat', '1/2 medium', 8, 6, 'Monounsaturated fats, fiber, nutrient-dense'),
  ('Berries (Mixed)', 'fruit', '1 cup', 8, 8, 'Antioxidants, polyphenols, anti-inflammatory'),
  ('Kale', 'vegetable', '1 cup cooked', 8, 8, 'Cruciferous, high in vitamins K/C, anti-cancer compounds'),
  ('Black Pepper (Piperine)', 'spice', '1/4 tsp', 5, 5, 'Enhances curcumin absorption by 2000%, bioavailability booster');

-- Pre-populate food-pathway connections (for John's ARID1A mutation)
-- Note: pathway_id references will need to be updated based on actual IDs in genomic_pathways table
-- This is a template - actual implementation will query genomic_pathways first

-- Example connections (to be populated after querying actual pathway IDs):
-- Turmeric → Hypoxia/HIF1 pathway
-- Broccoli Sprouts → Hypoxia/HIF1 pathway  
-- Green Tea → Angiogenesis pathway
-- Pomegranate → Angiogenesis pathway
-- Garlic → Hypoxia/HIF1 pathway
