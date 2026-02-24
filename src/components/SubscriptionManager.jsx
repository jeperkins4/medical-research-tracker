/**
 * Subscription Manager
 * Track recurring services: SaaS, cloud infra, dev tools, etc.
 */

import { useState, useEffect, useCallback } from 'react';
import * as api from '../api';
import './SubscriptionManager.css';

const BILLING_CYCLES = [
  { value: 'monthly',   label: 'Monthly' },
  { value: 'annual',    label: 'Annual' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'biannual',  label: 'Bi-Annual' },
  { value: 'weekly',    label: 'Weekly' },
  { value: 'one_time',  label: 'One-Time' },
];

const STATUSES = [
  { value: 'active',    label: 'Active' },
  { value: 'trial',     label: 'Trial' },
  { value: 'paused',    label: 'Paused' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'inactive',  label: 'Inactive' },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];

const EMPTY_FORM = {
  service_name:    '',
  provider:        '',
  category:        'Other',
  status:          'active',
  cost:            '',
  currency:        'USD',
  billing_cycle:   'monthly',
  billing_day:     '',
  billing_month:   '',
  trial_ends_at:   '',
  auto_renews:     true,
  reminder_days:   3,
  payment_method:  '',
  account_email:   '',
  account_username: '',
  dashboard_url:   '',
  support_url:     '',
  notes:           '',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function cycleLabel(cycle) {
  return BILLING_CYCLES.find(c => c.value === cycle)?.label || cycle;
}

function statusBadgeClass(status) {
  return `badge badge-${status}`;
}

function fmt(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency, minimumFractionDigits: 2,
  }).format(amount || 0);
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SubscriptionManager() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [summary, setSummary]             = useState(null);
  const [categories, setCategories]       = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);

  // Filters
  const [search, setSearch]       = useState('');
  const [filterStatus, setFilterStatus]     = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Modal
  const [showModal, setShowModal]   = useState(false);
  const [editingSub, setEditingSub] = useState(null);
  const [formData, setFormData]     = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState(null);

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [subs, cats, sum] = await Promise.all([
        api.getSubscriptions(),
        api.getSubscriptionCategories(),
        api.getSubscriptionSummary(),
      ]);
      setSubscriptions(Array.isArray(subs) ? subs : []);
      setCategories(Array.isArray(cats) ? cats : []);
      setSummary(sum);
    } catch (err) {
      setError('Failed to load subscriptions: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Modal helpers ───────────────────────────────────────────────────────────

  function openAdd() {
    setEditingSub(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setShowModal(true);
  }

  function openEdit(sub) {
    setEditingSub(sub);
    setFormData({
      service_name:    sub.service_name    || '',
      provider:        sub.provider        || '',
      category:        sub.category        || 'Other',
      status:          sub.status          || 'active',
      cost:            sub.cost != null ? String(sub.cost) : '',
      currency:        sub.currency        || 'USD',
      billing_cycle:   sub.billing_cycle   || 'monthly',
      billing_day:     sub.billing_day     != null ? String(sub.billing_day) : '',
      billing_month:   sub.billing_month   != null ? String(sub.billing_month) : '',
      trial_ends_at:   sub.trial_ends_at   || '',
      auto_renews:     sub.auto_renews     != null ? Boolean(sub.auto_renews) : true,
      reminder_days:   sub.reminder_days   ?? 3,
      payment_method:  sub.payment_method  || '',
      account_email:   sub.account_email   || '',
      account_username: sub.account_username || '',
      dashboard_url:   sub.dashboard_url   || '',
      support_url:     sub.support_url     || '',
      notes:           sub.notes           || '',
    });
    setFormError(null);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingSub(null);
    setFormError(null);
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);

    if (!formData.service_name.trim()) {
      setFormError('Service name is required');
      return;
    }
    if (formData.cost === '' || isNaN(Number(formData.cost))) {
      setFormError('Cost must be a valid number');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        cost:        Number(formData.cost),
        billing_day:   formData.billing_day   ? Number(formData.billing_day)   : null,
        billing_month: formData.billing_month ? Number(formData.billing_month) : null,
        reminder_days: Number(formData.reminder_days) || 3,
        tags: [],
      };

      if (editingSub) {
        await api.updateSubscription(editingSub.id, payload);
      } else {
        await api.addSubscription(payload);
      }

      closeModal();
      await loadAll();
    } catch (err) {
      setFormError('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async function handleDelete(sub) {
    if (!window.confirm(`Delete "${sub.service_name}"? This cannot be undone.`)) return;
    try {
      await api.deleteSubscription(sub.id);
      await loadAll();
    } catch (err) {
      setError('Delete failed: ' + err.message);
    }
  }

  // ── Filtered list ───────────────────────────────────────────────────────────

  const filtered = subscriptions.filter(s => {
    if (filterStatus   && s.status   !== filterStatus)   return false;
    if (filterCategory && s.category !== filterCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        s.service_name?.toLowerCase().includes(q) ||
        s.provider?.toLowerCase().includes(q) ||
        s.notes?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="subscription-manager">
        <p style={{ color: '#94a3b8', textAlign: 'center', padding: '60px' }}>
          Loading subscriptions…
        </p>
      </div>
    );
  }

  return (
    <div className="subscription-manager">

      {/* Header */}
      <div className="sm-header">
        <h2>💳 Subscriptions</h2>
        <button className="btn-add-sub" onClick={openAdd}>+ Add Subscription</button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="sm-summary">
          <div className="sm-card">
            <div className="sm-card-label">Monthly Cost</div>
            <div className="sm-card-value">{fmt(summary.monthly_total)}</div>
            <div className="sm-card-sub">across all active</div>
          </div>
          <div className="sm-card">
            <div className="sm-card-label">Annual Cost</div>
            <div className="sm-card-value">{fmt(summary.annual_total)}</div>
            <div className="sm-card-sub">projected</div>
          </div>
          <div className="sm-card">
            <div className="sm-card-label">Active Services</div>
            <div className="sm-card-value">{summary.total_active}</div>
            <div className="sm-card-sub">subscriptions</div>
          </div>
          {summary.by_category && Object.keys(summary.by_category).length > 0 && (
            <div className="sm-card">
              <div className="sm-card-label">Top Category</div>
              <div className="sm-card-value" style={{ fontSize: '1rem' }}>
                {Object.entries(summary.by_category)
                  .sort((a, b) => b[1].monthly - a[1].monthly)[0]?.[0] || '—'}
              </div>
              <div className="sm-card-sub">by spend</div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="sm-filters">
        <input
          type="text"
          placeholder="Search services…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Error */}
      {error && <div className="sm-error">{error}</div>}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="sm-empty">
          <div style={{ fontSize: '2.5rem' }}>💳</div>
          <p>{subscriptions.length === 0
            ? 'No subscriptions yet. Add your first one!'
            : 'No subscriptions match your filters.'
          }</p>
        </div>
      ) : (
        <div className="sm-grid">
          {filtered.map(sub => (
            <SubCard
              key={sub.id}
              sub={sub}
              onEdit={() => openEdit(sub)}
              onDelete={() => handleDelete(sub)}
            />
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <SubscriptionModal
          editingSub={editingSub}
          formData={formData}
          categories={categories}
          saving={saving}
          formError={formError}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SubCard({ sub, onEdit, onDelete }) {
  const monthlyEq = (() => {
    const c = sub.cost || 0;
    switch (sub.billing_cycle) {
      case 'annual':    return c / 12;
      case 'quarterly': return c / 3;
      case 'biannual':  return c / 6;
      case 'weekly':    return c * 4.33;
      default:          return c;
    }
  })();

  return (
    <div className="sub-card">
      <div className="sub-card-top">
        <div>
          <div className="sub-card-name">{sub.service_name}</div>
          {sub.provider && <div className="sub-card-provider">{sub.provider}</div>}
        </div>
        <div className="sub-card-actions">
          <button className="btn-icon" onClick={onEdit} title="Edit">✏️</button>
          <button className="btn-icon danger" onClick={onDelete} title="Delete">🗑️</button>
        </div>
      </div>

      <div className="sub-card-badges">
        <span className={statusBadgeClass(sub.status)}>{sub.status}</span>
        {sub.category && sub.category !== 'Other' && (
          <span className="badge badge-category">{sub.category}</span>
        )}
      </div>

      <div>
        <span className="sub-card-cost">
          {fmt(sub.cost, sub.currency)}
        </span>
        <span className="sub-card-cycle">/ {cycleLabel(sub.billing_cycle)}</span>
        {sub.billing_cycle !== 'monthly' && sub.billing_cycle !== 'one_time' && (
          <span className="sub-card-cycle">
            {' '}({fmt(monthlyEq)}/mo)
          </span>
        )}
      </div>

      <div className="sub-card-details">
        {sub.next_billing_date && sub.status === 'active' && (
          <div className="sub-card-detail-row">
            <span className="sub-card-detail-label">Next bill:</span>
            <span>{fmtDate(sub.next_billing_date)}</span>
          </div>
        )}
        {sub.trial_ends_at && sub.status === 'trial' && (
          <div className="sub-card-detail-row">
            <span className="sub-card-detail-label">Trial ends:</span>
            <span>{fmtDate(sub.trial_ends_at)}</span>
          </div>
        )}
        {sub.payment_method && (
          <div className="sub-card-detail-row">
            <span className="sub-card-detail-label">Payment:</span>
            <span>{sub.payment_method}</span>
          </div>
        )}
        {sub.dashboard_url && (
          <div className="sub-card-detail-row">
            <span className="sub-card-detail-label">Dashboard:</span>
            <a href={sub.dashboard_url} target="_blank" rel="noreferrer"
               style={{ color: '#2563eb', textDecoration: 'none', fontSize: '13px' }}>
              Open ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function SubscriptionModal({
  editingSub, formData, categories, saving, formError,
  onChange, onSubmit, onClose,
}) {
  const isEdit = Boolean(editingSub);

  return (
    <div className="sm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sm-modal">
        <div className="sm-modal-header">
          <h3>{isEdit ? `Edit: ${editingSub.service_name}` : 'Add Subscription'}</h3>
          <button className="btn-close-modal" onClick={onClose}>×</button>
        </div>

        <form onSubmit={onSubmit}>

          {/* Core */}
          <div className="form-row">
            <div className="form-group">
              <label>Service Name *</label>
              <input
                name="service_name"
                value={formData.service_name}
                onChange={onChange}
                placeholder="e.g. AWS, GitHub, Figma"
                required
              />
            </div>
            <div className="form-group">
              <label>Provider</label>
              <input
                name="provider"
                value={formData.provider}
                onChange={onChange}
                placeholder="e.g. Amazon, Microsoft"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Category</label>
              <select name="category" value={formData.category} onChange={onChange}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select name="status" value={formData.status} onChange={onChange}>
                {STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Billing */}
          <div className="form-section-title">Billing</div>
          <div className="form-row triple">
            <div className="form-group">
              <label>Cost *</label>
              <input
                name="cost"
                type="number"
                min="0"
                step="0.01"
                value={formData.cost}
                onChange={onChange}
                placeholder="29.99"
                required
              />
            </div>
            <div className="form-group">
              <label>Currency</label>
              <select name="currency" value={formData.currency} onChange={onChange}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Billing Cycle</label>
              <select name="billing_cycle" value={formData.billing_cycle} onChange={onChange}>
                {BILLING_CYCLES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Billing Day (1–31)</label>
              <input
                name="billing_day"
                type="number"
                min="1" max="31"
                value={formData.billing_day}
                onChange={onChange}
                placeholder="15"
              />
            </div>
            {formData.billing_cycle === 'annual' && (
              <div className="form-group">
                <label>Billing Month (1–12)</label>
                <input
                  name="billing_month"
                  type="number"
                  min="1" max="12"
                  value={formData.billing_month}
                  onChange={onChange}
                  placeholder="1"
                />
              </div>
            )}
            {formData.status === 'trial' && (
              <div className="form-group">
                <label>Trial Ends</label>
                <input
                  name="trial_ends_at"
                  type="date"
                  value={formData.trial_ends_at}
                  onChange={onChange}
                />
              </div>
            )}
          </div>

          {/* Payment */}
          <div className="form-section-title">Payment & Access</div>
          <div className="form-row">
            <div className="form-group">
              <label>Payment Method</label>
              <input
                name="payment_method"
                value={formData.payment_method}
                onChange={onChange}
                placeholder="Visa *1234, PayPal…"
              />
            </div>
            <div className="form-group">
              <label>Reminder Days Before</label>
              <input
                name="reminder_days"
                type="number"
                min="0" max="30"
                value={formData.reminder_days}
                onChange={onChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Account Email</label>
              <input
                name="account_email"
                type="email"
                value={formData.account_email}
                onChange={onChange}
                placeholder="you@example.com"
              />
            </div>
            <div className="form-group">
              <label>Account Username</label>
              <input
                name="account_username"
                value={formData.account_username}
                onChange={onChange}
                placeholder="jeperkins4"
              />
            </div>
          </div>

          {/* URLs */}
          <div className="form-section-title">Links</div>
          <div className="form-row">
            <div className="form-group">
              <label>Dashboard URL</label>
              <input
                name="dashboard_url"
                type="url"
                value={formData.dashboard_url}
                onChange={onChange}
                placeholder="https://console.aws.amazon.com"
              />
            </div>
            <div className="form-group">
              <label>Support URL</label>
              <input
                name="support_url"
                type="url"
                value={formData.support_url}
                onChange={onChange}
                placeholder="https://support.example.com"
              />
            </div>
          </div>

          {/* Notes + Auto-renew */}
          <div className="form-row">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={onChange}
                placeholder="Additional details, plan tier, team size…"
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <input
              id="auto_renews"
              name="auto_renews"
              type="checkbox"
              checked={formData.auto_renews}
              onChange={onChange}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <label htmlFor="auto_renews" style={{ fontSize: '13px', color: '#374151', cursor: 'pointer' }}>
              Auto-renews
            </label>
          </div>

          {/* Error + Actions */}
          {formError && (
            <div className="sm-error" style={{ marginTop: '12px', marginBottom: '0' }}>
              {formError}
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-save" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Subscription'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
