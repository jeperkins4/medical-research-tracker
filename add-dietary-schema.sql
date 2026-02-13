-- Dietary habits and philosophy tracking
CREATE TABLE IF NOT EXISTS dietary_habits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  category TEXT NOT NULL, -- 'philosophy', 'routine', 'restriction', 'supplement'
  description TEXT NOT NULL,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Insert current dietary philosophy
INSERT INTO dietary_habits (date, category, description, notes) VALUES
('2026-02-12', 'philosophy', 'Avoiding processed foods and refined sugar', 'Anti-inflammatory metabolic approach. Complements genomic-targeted supplement protocol. Cancer cells metabolize glucose preferentially - clean whole foods support Hypoxia/HIF1 pathway targeting.'),
('2026-02-12', 'routine', 'Morning: Coffee (2 cups) followed by Organic Carrot juice with Ginger and Turmeric', 'Pasteurized juice but provides beta-carotene (antioxidant/immune), curcumin (anti-inflammatory, HIF1 pathway support), gingerols (anti-inflammatory/digestive). Core phytonutrients survive pasteurization.');
