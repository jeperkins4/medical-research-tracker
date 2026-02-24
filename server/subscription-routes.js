/**
 * Subscription Tracker Routes
 * CRUD for subscriptions + payment history
 */
import { query, run } from './db-secure.js';

// ── Category constants (single source of truth) ──────────────────────────────
export const SUBSCRIPTION_CATEGORIES = [
  'AI & Machine Learning',
  'Cloud Infrastructure',
  'Communication & Collaboration',
  'Database & Storage',
  'Development Tools',
  'Domain & Hosting',
  'Finance & Banking',
  'Healthcare & Medical',
  'Media & Entertainment',
  'Productivity',
  'Security & Privacy',
  'Software / SaaS',
  'Other',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute next billing date from billing_cycle + billing_day/month.
 * Returns ISO date string or null.
 */
function computeNextBillingDate(billing_cycle, billing_day, billing_month) {
  const now = new Date();
  let next = new Date(now);

  switch (billing_cycle) {
    case 'monthly': {
      const day = billing_day || 1;
      next.setDate(day);
      if (next <= now) next.setMonth(next.getMonth() + 1);
      break;
    }
    case 'annual': {
      const month = (billing_month || 1) - 1; // 0-indexed
      const day   = billing_day || 1;
      next.setMonth(month);
      next.setDate(day);
      if (next <= now) next.setFullYear(next.getFullYear() + 1);
      break;
    }
    case 'quarterly': {
      next.setMonth(next.getMonth() + 3);
      if (billing_day) next.setDate(billing_day);
      break;
    }
    case 'biannual': {
      next.setMonth(next.getMonth() + 6);
      if (billing_day) next.setDate(billing_day);
      break;
    }
    case 'weekly': {
      next.setDate(next.getDate() + 7);
      break;
    }
    case 'one_time':
    default:
      return null;
  }

  return next.toISOString().split('T')[0]; // YYYY-MM-DD
}

// ── Route setup ──────────────────────────────────────────────────────────────

export function setupSubscriptionRoutes(app, requireAuth) {

  // GET /api/subscriptions/categories
  app.get('/api/subscriptions/categories', requireAuth, (req, res) => {
    res.json(SUBSCRIPTION_CATEGORIES);
  });

  // GET /api/subscriptions — list all for user
  app.get('/api/subscriptions', requireAuth, (req, res) => {
    try {
      const { status, category } = req.query;
      let sql = 'SELECT * FROM subscriptions WHERE user_id = ?';
      const params = [req.user.id];

      if (status)   { sql += ' AND status = ?';   params.push(status); }
      if (category) { sql += ' AND category = ?'; params.push(category); }

      sql += ' ORDER BY service_name ASC';

      const subs = query(sql, params);
      // Parse tags JSON
      const result = subs.map(s => ({ ...s, tags: JSON.parse(s.tags || '[]') }));
      res.json(result);
    } catch (err) {
      console.error('[subscriptions] GET error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/subscriptions/summary — spend summary
  app.get('/api/subscriptions/summary', requireAuth, (req, res) => {
    try {
      const subs = query(
        `SELECT * FROM subscriptions WHERE user_id = ? AND status IN ('active','trial')`,
        [req.user.id]
      );

      let monthlyTotal = 0;
      let annualTotal  = 0;

      subs.forEach(s => {
        const cost = s.cost || 0;
        switch (s.billing_cycle) {
          case 'monthly':   monthlyTotal += cost;        annualTotal += cost * 12;  break;
          case 'annual':    monthlyTotal += cost / 12;   annualTotal += cost;       break;
          case 'quarterly': monthlyTotal += cost / 3;    annualTotal += cost * 4;   break;
          case 'biannual':  monthlyTotal += cost / 6;    annualTotal += cost * 2;   break;
          case 'weekly':    monthlyTotal += cost * 4.33; annualTotal += cost * 52;  break;
          default: break;
        }
      });

      // Group by category
      const byCategory = {};
      subs.forEach(s => {
        const cat = s.category || 'Other';
        if (!byCategory[cat]) byCategory[cat] = { count: 0, monthly: 0 };
        byCategory[cat].count++;
        let m = 0;
        switch (s.billing_cycle) {
          case 'monthly':   m = s.cost;          break;
          case 'annual':    m = s.cost / 12;     break;
          case 'quarterly': m = s.cost / 3;      break;
          case 'biannual':  m = s.cost / 6;      break;
          case 'weekly':    m = s.cost * 4.33;   break;
        }
        byCategory[cat].monthly += m;
      });

      res.json({
        total_active:     subs.length,
        monthly_total:    Math.round(monthlyTotal * 100) / 100,
        annual_total:     Math.round(annualTotal  * 100) / 100,
        by_category:      byCategory,
      });
    } catch (err) {
      console.error('[subscriptions] summary error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/subscriptions/:id
  app.get('/api/subscriptions/:id', requireAuth, (req, res) => {
    try {
      const rows = query(
        'SELECT * FROM subscriptions WHERE id = ? AND user_id = ?',
        [req.params.id, req.user.id]
      );
      if (!rows.length) return res.status(404).json({ error: 'Not found' });
      const sub = { ...rows[0], tags: JSON.parse(rows[0].tags || '[]') };
      res.json(sub);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/subscriptions — create
  app.post('/api/subscriptions', requireAuth, (req, res) => {
    try {
      const {
        service_name, provider, category = 'Other',
        status = 'active', cost, currency = 'USD',
        billing_cycle = 'monthly', billing_day, billing_month,
        next_billing_date, trial_ends_at,
        auto_renews = true, reminder_days = 3,
        payment_method, account_email, account_username,
        dashboard_url, support_url, notes,
        tags = [],
      } = req.body;

      if (!service_name) return res.status(400).json({ error: 'service_name is required' });
      if (cost == null)  return res.status(400).json({ error: 'cost is required' });

      const nextBill = next_billing_date ||
        computeNextBillingDate(billing_cycle, billing_day, billing_month);

      const result = run(`
        INSERT INTO subscriptions (
          user_id, service_name, provider, category, status,
          cost, currency, billing_cycle, billing_day, billing_month,
          next_billing_date, trial_ends_at, auto_renews, reminder_days,
          payment_method, account_email, account_username,
          dashboard_url, support_url, notes, tags
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `, [
        req.user.id, service_name, provider || null, category, status,
        cost, currency, billing_cycle,
        billing_day || null, billing_month || null,
        nextBill || null, trial_ends_at || null,
        auto_renews ? 1 : 0, reminder_days,
        payment_method || null, account_email || null, account_username || null,
        dashboard_url || null, support_url || null, notes || null,
        JSON.stringify(tags),
      ]);

      res.status(201).json({ id: result.lastInsertRowid, service_name });
    } catch (err) {
      console.error('[subscriptions] POST error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/subscriptions/:id — update
  app.put('/api/subscriptions/:id', requireAuth, (req, res) => {
    try {
      const existing = query(
        'SELECT * FROM subscriptions WHERE id = ? AND user_id = ?',
        [req.params.id, req.user.id]
      );
      if (!existing.length) return res.status(404).json({ error: 'Not found' });

      const current = existing[0];
      const updated = { ...current, ...req.body };

      // Track cancellation timestamp
      if (req.body.status === 'cancelled' && current.status !== 'cancelled') {
        updated.cancelled_at = new Date().toISOString();
      }

      // Recompute next_billing_date if cycle/day changed
      if (!req.body.next_billing_date) {
        updated.next_billing_date =
          computeNextBillingDate(updated.billing_cycle, updated.billing_day, updated.billing_month)
          || current.next_billing_date;
      }

      run(`
        UPDATE subscriptions SET
          service_name = ?, provider = ?, category = ?, status = ?,
          cost = ?, currency = ?, billing_cycle = ?,
          billing_day = ?, billing_month = ?,
          next_billing_date = ?, trial_ends_at = ?,
          auto_renews = ?, reminder_days = ?,
          payment_method = ?, account_email = ?, account_username = ?,
          dashboard_url = ?, support_url = ?, notes = ?,
          tags = ?, cancelled_at = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `, [
        updated.service_name, updated.provider, updated.category, updated.status,
        updated.cost, updated.currency, updated.billing_cycle,
        updated.billing_day, updated.billing_month,
        updated.next_billing_date, updated.trial_ends_at,
        updated.auto_renews ? 1 : 0, updated.reminder_days,
        updated.payment_method, updated.account_email, updated.account_username,
        updated.dashboard_url, updated.support_url, updated.notes,
        JSON.stringify(Array.isArray(updated.tags) ? updated.tags : JSON.parse(updated.tags || '[]')),
        updated.cancelled_at || null,
        req.params.id, req.user.id,
      ]);

      res.json({ success: true });
    } catch (err) {
      console.error('[subscriptions] PUT error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/subscriptions/:id
  app.delete('/api/subscriptions/:id', requireAuth, (req, res) => {
    try {
      const result = run(
        'DELETE FROM subscriptions WHERE id = ? AND user_id = ?',
        [req.params.id, req.user.id]
      );
      if (!result.changes) return res.status(404).json({ error: 'Not found' });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Payment history ───────────────────────────────────────────────────────

  // GET /api/subscriptions/:id/payments
  app.get('/api/subscriptions/:id/payments', requireAuth, (req, res) => {
    try {
      // Verify ownership
      const sub = query(
        'SELECT id FROM subscriptions WHERE id = ? AND user_id = ?',
        [req.params.id, req.user.id]
      );
      if (!sub.length) return res.status(404).json({ error: 'Not found' });

      const payments = query(
        'SELECT * FROM subscription_payments WHERE subscription_id = ? ORDER BY paid_at DESC',
        [req.params.id]
      );
      res.json(payments);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/subscriptions/:id/payments — log a payment
  app.post('/api/subscriptions/:id/payments', requireAuth, (req, res) => {
    try {
      const sub = query(
        'SELECT id FROM subscriptions WHERE id = ? AND user_id = ?',
        [req.params.id, req.user.id]
      );
      if (!sub.length) return res.status(404).json({ error: 'Not found' });

      const {
        amount, currency = 'USD',
        paid_at, billing_period_start, billing_period_end,
        status = 'paid', transaction_id, notes,
      } = req.body;

      if (amount == null) return res.status(400).json({ error: 'amount is required' });

      const result = run(`
        INSERT INTO subscription_payments (
          subscription_id, amount, currency,
          paid_at, billing_period_start, billing_period_end,
          status, transaction_id, notes
        ) VALUES (?,?,?,?,?,?,?,?,?)
      `, [
        req.params.id, amount, currency,
        paid_at || new Date().toISOString(),
        billing_period_start || null, billing_period_end || null,
        status, transaction_id || null, notes || null,
      ]);

      // Advance next_billing_date after successful payment
      if (status === 'paid') {
        const subRow = query('SELECT * FROM subscriptions WHERE id = ?', [req.params.id])[0];
        const nextBill = computeNextBillingDate(
          subRow.billing_cycle, subRow.billing_day, subRow.billing_month
        );
        if (nextBill) {
          run('UPDATE subscriptions SET next_billing_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [nextBill, req.params.id]);
        }
      }

      res.status(201).json({ id: result.lastInsertRowid });
    } catch (err) {
      console.error('[subscriptions] payment POST error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  console.log('✅ Subscription routes registered');
}
