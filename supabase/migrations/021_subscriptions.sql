-- ============================================================
-- Migration 021: Subscription Tracker
-- ============================================================

-- ── subscriptions ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                  BIGSERIAL     PRIMARY KEY,
  user_id             UUID          REFERENCES auth.users(id) ON DELETE CASCADE,
  service_name        TEXT          NOT NULL,
  provider            TEXT,
  category            TEXT          DEFAULT 'Other',
  status              TEXT          NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','trial','paused','cancelled','inactive')),
  cost                NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency            TEXT          NOT NULL DEFAULT 'USD',
  billing_cycle       TEXT          NOT NULL DEFAULT 'monthly'
                        CHECK (billing_cycle IN ('monthly','annual','quarterly','biannual','weekly','one_time')),
  billing_day         SMALLINT      CHECK (billing_day BETWEEN 1 AND 31),
  billing_month       SMALLINT      CHECK (billing_month BETWEEN 1 AND 12),
  next_billing_date   DATE,
  trial_ends_at       DATE,
  auto_renews         BOOLEAN       NOT NULL DEFAULT TRUE,
  reminder_days       SMALLINT      NOT NULL DEFAULT 3,
  payment_method      TEXT,
  account_email       TEXT,
  account_username    TEXT,
  dashboard_url       TEXT,
  support_url         TEXT,
  notes               TEXT,
  tags                JSONB         DEFAULT '[]',
  cancelled_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── subscription_payments ────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscription_payments (
  id                    BIGSERIAL     PRIMARY KEY,
  subscription_id       BIGINT        NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  amount                NUMERIC(10,2) NOT NULL,
  currency              TEXT          NOT NULL DEFAULT 'USD',
  paid_at               TIMESTAMPTZ,
  billing_period_start  DATE,
  billing_period_end    DATE,
  status                TEXT          NOT NULL DEFAULT 'paid'
                          CHECK (status IN ('paid','failed','pending','refunded')),
  transaction_id        TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_subscriptions_user        ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status      ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_bill   ON subscriptions(next_billing_date);
CREATE INDEX IF NOT EXISTS idx_sub_payments_sub_id       ON subscription_payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_payments_paid_at      ON subscription_payments(paid_at);

-- ── updated_at trigger ───────────────────────────────────────
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_subscriptions_updated_at();

-- ── Row-level security ───────────────────────────────────────
ALTER TABLE subscriptions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own subscriptions"
  ON subscriptions FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users see own payments"
  ON subscription_payments FOR ALL
  USING (
    subscription_id IN (
      SELECT id FROM subscriptions WHERE user_id = auth.uid()
    )
  );
