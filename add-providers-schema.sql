-- Add healthcare providers and consultations tracking

-- Healthcare providers table (oncologists, specialists, etc.)
CREATE TABLE IF NOT EXISTS healthcare_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    specialty TEXT,
    institution TEXT,
    role TEXT DEFAULT 'consulting', -- 'primary', 'consulting', 'specialist', 'second-opinion', 'third-opinion'
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    first_seen_date TEXT,
    last_seen_date TEXT,
    active BOOLEAN DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Consultations/visits with providers
CREATE TABLE IF NOT EXISTS consultations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER NOT NULL,
    consultation_date TEXT NOT NULL,
    consultation_type TEXT, -- 'initial', 'follow-up', 'second-opinion', 'third-opinion', 'emergency'
    reason TEXT,
    findings TEXT,
    recommendations TEXT,
    treatment_plan TEXT,
    next_steps TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (provider_id) REFERENCES healthcare_providers(id)
);

-- Link conditions to providers (who is managing what)
CREATE TABLE IF NOT EXISTS condition_providers (
    condition_id INTEGER NOT NULL,
    provider_id INTEGER NOT NULL,
    role TEXT DEFAULT 'managing', -- 'managing', 'consulting', 'monitoring'
    started_date TEXT,
    ended_date TEXT,
    notes TEXT,
    PRIMARY KEY (condition_id, provider_id),
    FOREIGN KEY (condition_id) REFERENCES conditions(id),
    FOREIGN KEY (provider_id) REFERENCES healthcare_providers(id)
);

-- Second opinions table (for tracking specific opinion requests)
CREATE TABLE IF NOT EXISTS second_opinions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER NOT NULL,
    requested_date TEXT NOT NULL,
    completed_date TEXT,
    reason TEXT NOT NULL,
    diagnosis_opinion TEXT,
    treatment_opinion TEXT,
    differs_from_primary BOOLEAN,
    differences_summary TEXT,
    recommendation_followed BOOLEAN,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (provider_id) REFERENCES healthcare_providers(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_providers_specialty ON healthcare_providers(specialty);
CREATE INDEX IF NOT EXISTS idx_providers_role ON healthcare_providers(role);
CREATE INDEX IF NOT EXISTS idx_consultations_date ON consultations(consultation_date);
CREATE INDEX IF NOT EXISTS idx_consultations_provider ON consultations(provider_id);
CREATE INDEX IF NOT EXISTS idx_second_opinions_date ON second_opinions(requested_date);
