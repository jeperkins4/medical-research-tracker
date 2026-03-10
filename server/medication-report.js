/**
 * Medication & Supplement Print Report Generator
 * Professional, branded, print-ready HTML for browser-to-PDF export.
 */

const TYPE_ORDER = ['prescription', 'integrative', 'otc', 'supplement'];

const TYPE_LABELS = {
  prescription: 'Prescription Medications',
  supplement:   'Dietary Supplements',
  otc:          'Over-the-Counter',
  integrative:  'Integrative & Functional',
};

const TYPE_ICONS = {
  prescription: '💊',
  supplement:   '🌿',
  otc:          '🏪',
  integrative:  '🍃',
};

const TYPE_COLORS = {
  prescription: { accent: '#1d4ed8', light: '#eff6ff', border: '#93c5fd', pill: '#dbeafe', pillText: '#1e40af' },
  supplement:   { accent: '#15803d', light: '#f0fdf4', border: '#86efac', pill: '#dcfce7', pillText: '#166534' },
  otc:          { accent: '#b45309', light: '#fffbeb', border: '#fcd34d', pill: '#fef3c7', pillText: '#92400e' },
  integrative:  { accent: '#7e22ce', light: '#faf5ff', border: '#d8b4fe', pill: '#f3e8ff', pillText: '#6b21a8' },
};

function fmt(dateStr) {
  if (!dateStr) return null;
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch { return dateStr; }
}

function fmtShort(dateStr) {
  if (!dateStr) return null;
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return dateStr; }
}

function pill(label, value, color = '#e2e8f0', textColor = '#475569') {
  if (!value) return '';
  return `<span class="pill" style="background:${color};color:${textColor}">${label}: <strong>${value}</strong></span>`;
}

function detailRow(label, value) {
  if (!value && value !== 0) return '';
  return `
    <div class="detail-row">
      <span class="detail-label">${label}</span>
      <span class="detail-value">${value}</span>
    </div>`;
}

function medCard(med, colors) {
  const isActive = !!med.active;

  const dateRange = (() => {
    const start = fmtShort(med.started_date);
    const stop  = fmtShort(med.stopped_date);
    if (start && stop) return `${start} → ${stop}`;
    if (start)         return `Since ${start}`;
    return null;
  })();

  const targetPathways = (() => {
    try { return JSON.parse(med.target_pathways).join(' · '); } catch { return med.target_pathways || null; }
  })();

  const brandLine = [med.brand, med.manufacturer].filter(Boolean).join(' · ');

  return `
  <div class="med-card ${isActive ? 'active' : 'stopped'}" style="border-top:3px solid ${colors.accent}">
    <div class="med-card-header">
      <div class="med-name-block">
        <div class="med-name">${med.name}</div>
        ${brandLine ? `<div class="med-brand">${brandLine}</div>` : ''}
      </div>
      <div class="med-status-block">
        <span class="status-badge ${isActive ? 'status-active' : 'status-stopped'}">
          ${isActive ? '● Active' : '○ Stopped'}
        </span>
      </div>
    </div>

    <div class="med-pills">
      ${med.dosage    ? `<span class="pill-chip">${med.dosage}</span>` : ''}
      ${med.frequency ? `<span class="pill-chip">${med.frequency}</span>` : ''}
      ${med.route && med.route !== 'oral' ? `<span class="pill-chip">${med.route}</span>` : ''}
      ${dateRange     ? `<span class="pill-chip pill-date">${dateRange}</span>` : ''}
    </div>

    <div class="med-details">
      ${detailRow('Indication', med.reason)}
      ${detailRow('Prescribed by', med.prescribed_by)}
      ${detailRow('Evidence', med.evidence_strength)}
      ${detailRow('Target Pathways', targetPathways)}
      ${detailRow('Genomic Alignment', med.genomic_alignment)}
      ${detailRow('Precautions', med.precautions)}
      ${detailRow('Interactions', med.interactions)}
      ${detailRow('Notes', med.notes)}
    </div>
  </div>`;
}

export function generateMedicationReportHtml(medications, {
  patientName = 'John Perkins',
  dob         = null,
  title       = 'Medications & Supplements',
} = {}) {

  const generatedAt = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const generatedTime = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });

  // Group
  const grouped = {};
  for (const m of medications) {
    const t = m.type || 'supplement';
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(m);
  }

  // Sort: active first, then alpha
  for (const t of Object.keys(grouped)) {
    grouped[t].sort((a, b) => {
      if (!!b.active !== !!a.active) return (b.active ? 1 : 0) - (a.active ? 1 : 0);
      return a.name.localeCompare(b.name);
    });
  }

  const activeTotal   = medications.filter(m => m.active).length;
  const inactiveTotal = medications.length - activeTotal;

  // Count by type
  const typeCounts = TYPE_ORDER
    .filter(t => grouped[t]?.length)
    .map(t => {
      const a = grouped[t].filter(m => m.active).length;
      const s = grouped[t].length - a;
      return { type: t, total: grouped[t].length, active: a, stopped: s };
    });

  const summaryRows = typeCounts.map(({ type, total, active, stopped }) => `
    <tr>
      <td>${TYPE_ICONS[type]} ${TYPE_LABELS[type]}</td>
      <td class="num">${total}</td>
      <td class="num active-num">${active}</td>
      <td class="num stopped-num">${stopped || '—'}</td>
    </tr>`).join('');

  const sections = TYPE_ORDER
    .filter(t => grouped[t]?.length)
    .map(t => {
      const colors = TYPE_COLORS[t] || TYPE_COLORS.supplement;
      const cards  = grouped[t].map(m => medCard(m, colors)).join('\n');
      const activeN   = grouped[t].filter(m => m.active).length;
      const inactiveN = grouped[t].length - activeN;

      return `
    <section class="type-section">
      <div class="section-header" style="background:${colors.light};border-left:4px solid ${colors.accent}">
        <span class="section-icon">${TYPE_ICONS[t]}</span>
        <span class="section-title">${TYPE_LABELS[t]}</span>
        <span class="section-counts">
          <span class="count-active">${activeN} active</span>
          ${inactiveN ? `<span class="count-stopped">${inactiveN} stopped</span>` : ''}
        </span>
      </div>
      <div class="cards-grid">
        ${cards}
      </div>
    </section>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — ${patientName}</title>
<style>
/* ── Reset ───────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ── Page ────────────────────────────────────────────── */
html { font-size: 13px; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
  color: #1e293b;
  background: #f8fafc;
  line-height: 1.5;
}

.page {
  max-width: 860px;
  margin: 0 auto;
  background: #fff;
  min-height: 100vh;
  padding: 0;
}

/* ── Print banner (screen-only) ──────────────────────── */
.print-banner {
  background: linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%);
  color: #fff;
  padding: 14px 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.print-banner p { font-size: 13px; opacity: 0.9; }
.print-banner strong { color: #bfdbfe; }
.btn-print {
  background: #fff;
  color: #1d4ed8;
  border: none;
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  letter-spacing: 0.01em;
}
.btn-print:hover { background: #eff6ff; }

/* ── Letterhead ──────────────────────────────────────── */
.letterhead {
  padding: 28px 36px 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}

.logo-block { display: flex; align-items: center; gap: 12px; }
.logo-mark {
  width: 48px; height: 48px;
  background: linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%);
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; flex-shrink: 0;
}
.logo-text {}
.logo-name {
  font-size: 17px;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.02em;
}
.logo-tagline {
  font-size: 10.5px;
  color: #64748b;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.doc-meta {
  text-align: right;
  font-size: 11px;
  color: #64748b;
  line-height: 1.7;
}
.doc-meta .confidential {
  display: inline-block;
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-bottom: 4px;
}
.doc-meta .generated { color: #94a3b8; font-size: 10.5px; }

/* ── Divider ─────────────────────────────────────────── */
.divider {
  margin: 20px 36px 0;
  height: 2px;
  background: linear-gradient(to right, #0f172a 0%, #0f172a 40%, #e2e8f0 100%);
  border-radius: 1px;
}

/* ── Patient banner ──────────────────────────────────── */
.patient-banner {
  margin: 0 36px;
  padding: 14px 20px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-top: none;
  border-radius: 0 0 10px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.patient-name {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}
.patient-label {
  font-size: 10.5px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  display: block;
  margin-bottom: 1px;
}
.report-title-line {
  font-size: 18px;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.02em;
  margin: 20px 36px 0;
}

/* ── Summary table ───────────────────────────────────── */
.summary-section {
  margin: 16px 36px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
}
.summary-section table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.summary-section thead th {
  background: #0f172a;
  color: #fff;
  padding: 8px 14px;
  text-align: left;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.summary-section thead th.num { text-align: right; }
.summary-section tbody td {
  padding: 7px 14px;
  border-bottom: 1px solid #f1f5f9;
  color: #334155;
}
.summary-section tbody tr:last-child td { border-bottom: none; }
.summary-section tbody tr:nth-child(even) td { background: #f8fafc; }
.summary-section td.num { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
.summary-section td.active-num  { color: #15803d; }
.summary-section td.stopped-num { color: #dc2626; }
.summary-footer {
  background: #f8fafc;
  border-top: 2px solid #e2e8f0;
  padding: 8px 14px;
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 700;
  color: #0f172a;
}
.summary-footer .total-active  { color: #15803d; }
.summary-footer .total-stopped { color: #dc2626; }

/* ── Section header ──────────────────────────────────── */
.type-section { margin: 20px 36px 0; }
.section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-radius: 8px 8px 0 0;
  margin-bottom: 0;
}
.section-icon { font-size: 16px; }
.section-title { font-size: 13px; font-weight: 700; color: #0f172a; flex: 1; }
.section-counts { display: flex; gap: 8px; }
.count-active  { font-size: 11px; font-weight: 600; color: #15803d; background: #dcfce7; padding: 2px 8px; border-radius: 10px; }
.count-stopped { font-size: 11px; font-weight: 600; color: #b91c1c; background: #fee2e2; padding: 2px 8px; border-radius: 10px; }

/* ── Cards grid ──────────────────────────────────────── */
.cards-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 10px 0;
}

.med-card {
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  padding: 13px 15px;
  background: #fff;
  page-break-inside: avoid;
  break-inside: avoid;
}

.med-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
}
.med-name-block { flex: 1; }
.med-name {
  font-size: 13.5px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.3;
}
.med-brand {
  font-size: 10.5px;
  color: #64748b;
  margin-top: 1px;
}
.med-status-block { flex-shrink: 0; }

.status-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 10px;
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.status-active  { background: #dcfce7; color: #166534; }
.status-stopped { background: #f1f5f9; color: #64748b; }

/* ── Dosage pills ────────────────────────────────────── */
.med-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 9px;
}
.pill-chip {
  display: inline-block;
  font-size: 10.5px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  background: #f1f5f9;
  color: #334155;
  border: 1px solid #e2e8f0;
}
.pill-date {
  background: #fffbeb;
  color: #92400e;
  border-color: #fcd34d;
}

/* ── Detail rows ─────────────────────────────────────── */
.med-details {
  border-top: 1px solid #f1f5f9;
  padding-top: 8px;
}
.detail-row {
  display: flex;
  gap: 8px;
  font-size: 11.5px;
  padding: 2px 0;
  line-height: 1.4;
}
.detail-label {
  font-weight: 600;
  color: #64748b;
  white-space: nowrap;
  min-width: 100px;
  flex-shrink: 0;
}
.detail-value { color: #334155; }

/* ── Footer ──────────────────────────────────────────── */
.report-footer {
  margin: 24px 36px 28px;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 10px;
  color: #94a3b8;
}
.footer-brand { display: flex; align-items: center; gap: 6px; font-weight: 600; color: #64748b; }
.footer-dot {
  width: 18px; height: 18px;
  background: linear-gradient(135deg, #1e3a5f, #1d4ed8);
  border-radius: 4px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 10px;
}
.footer-right { text-align: right; }

/* ── Page numbers for print ──────────────────────────── */
@page {
  size: letter;
  margin: 0.55in 0.6in 0.65in;
}

/* ── Print overrides ─────────────────────────────────── */
@media print {
  .no-print { display: none !important; }
  body { background: #fff; }
  .page { max-width: 100%; }
  .letterhead  { padding: 0 0 0; }
  .divider     { margin: 14px 0 0; }
  .patient-banner { margin: 0; }
  .report-title-line { margin: 14px 0 0; }
  .summary-section { margin: 10px 0; }
  .type-section { margin: 14px 0 0; }
  .report-footer { margin: 16px 0 20px; }
  .cards-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
  .med-card { border: 1px solid #d1d5db; page-break-inside: avoid; break-inside: avoid; }
  .type-section { page-break-inside: avoid; break-inside: avoid; }
}
</style>
</head>
<body>
<div class="page">

  <!-- Print Banner (screen only) -->
  <div class="print-banner no-print">
    <p>📄 <strong>Print Preview</strong> — Use <strong>⌘P</strong> (or Ctrl+P) and choose "Save as PDF".<br>
    Recommended: Letter size, default margins, Background graphics ON.</p>
    <button class="btn-print" onclick="window.print()">🖨️ Print / Save PDF</button>
  </div>

  <!-- Letterhead -->
  <div class="letterhead">
    <div class="logo-block">
      <div class="logo-mark">⚕️</div>
      <div class="logo-text">
        <div class="logo-name">Medical Research Tracker</div>
        <div class="logo-tagline">Personal Health Intelligence Platform</div>
      </div>
    </div>
    <div class="doc-meta">
      <div class="confidential">Private &amp; Confidential</div>
      <div>Generated: ${generatedAt}</div>
      <div class="generated">${generatedTime} · Medical Research Tracker</div>
    </div>
  </div>

  <!-- Divider -->
  <div class="divider"></div>

  <!-- Patient Banner -->
  <div class="patient-banner">
    <div>
      <span class="patient-label">Patient</span>
      <span class="patient-name">${patientName}</span>
    </div>
    ${dob ? `<div><span class="patient-label">Date of Birth</span><span class="patient-name" style="font-size:13px">${dob}</span></div>` : ''}
    <div style="text-align:right">
      <span class="patient-label">Report Date</span>
      <span class="patient-name" style="font-size:13px">${generatedAt}</span>
    </div>
  </div>

  <!-- Report Title -->
  <div class="report-title-line">${title}</div>

  <!-- Summary Table -->
  <div class="summary-section">
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th class="num">Total</th>
          <th class="num">Active</th>
          <th class="num">Stopped</th>
        </tr>
      </thead>
      <tbody>
        ${summaryRows}
      </tbody>
    </table>
    <div class="summary-footer">
      <span>Total: <strong>${medications.length}</strong> medications &amp; supplements</span>
      <span>
        <span class="total-active">${activeTotal} active</span>
        ${inactiveTotal ? `&nbsp;·&nbsp;<span class="total-stopped">${inactiveTotal} stopped</span>` : ''}
      </span>
    </div>
  </div>

  <!-- Medication Sections -->
  ${sections}

  <!-- Footer -->
  <div class="report-footer">
    <div class="footer-brand">
      <span class="footer-dot">⚕️</span>
      Medical Research Tracker
    </div>
    <div class="footer-right">
      Patient: ${patientName} &nbsp;·&nbsp; Generated ${generatedAt} &nbsp;·&nbsp; PRIVATE &amp; CONFIDENTIAL
    </div>
  </div>

</div>
</body>
</html>`;
}
