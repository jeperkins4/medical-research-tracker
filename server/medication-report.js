/**
 * Medication & Supplement Print Report Generator
 * Produces a clean, print-ready HTML page for browser-to-PDF export.
 */

const TYPE_ORDER = ['prescription', 'integrative', 'otc', 'supplement'];

const TYPE_LABELS = {
  prescription: '💊 Prescriptions',
  supplement: '🌿 Supplements',
  otc: '🏪 Over-the-Counter',
  integrative: '🍃 Integrative / Functional',
};

const TYPE_COLORS = {
  prescription: { bg: '#eff6ff', border: '#bfdbfe', badge: '#1d4ed8', badgeBg: '#dbeafe' },
  supplement:   { bg: '#f0fdf4', border: '#bbf7d0', badge: '#15803d', badgeBg: '#dcfce7' },
  otc:          { bg: '#fff7ed', border: '#fed7aa', badge: '#c2410c', badgeBg: '#ffedd5' },
  integrative:  { bg: '#fdf4ff', border: '#e9d5ff', badge: '#7e22ce', badgeBg: '#f3e8ff' },
};

function fmt(dateStr) {
  if (!dateStr) return null;
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return dateStr; }
}

function row(label, value) {
  if (!value && value !== 0) return '';
  return `<tr><td class="lbl">${label}</td><td>${value}</td></tr>`;
}

function medCard(med, colors) {
  const statusTag = med.active
    ? `<span class="badge active">Active</span>`
    : `<span class="badge stopped">Stopped</span>`;

  const typeBadge = `<span class="type-badge" style="background:${colors.badgeBg};color:${colors.badge}">${med.type}</span>`;

  const dateRange = (() => {
    const start = fmt(med.started_date);
    const stop  = fmt(med.stopped_date);
    if (start && stop) return `${start} → ${stop}`;
    if (start)         return `Since ${start}`;
    return null;
  })();

  const targetPathways = (() => {
    try { return JSON.parse(med.target_pathways).join(', '); } catch { return med.target_pathways; }
  })();

  return `
  <div class="med-card" style="border-left:4px solid ${colors.border};background:${colors.bg}">
    <div class="med-header">
      <div class="med-title">
        <span class="med-name">${med.name}</span>
        ${med.brand ? `<span class="brand">${med.brand}${med.manufacturer ? ` · ${med.manufacturer}` : ''}</span>` : ''}
      </div>
      <div class="med-badges">${typeBadge}${statusTag}</div>
    </div>
    <table class="detail-table">
      ${row('Dosage', med.dosage)}
      ${row('Frequency', med.frequency)}
      ${row('Route', med.route !== 'oral' ? med.route : null)}
      ${row('Dates', dateRange)}
      ${row('Indication', med.reason)}
      ${row('Prescribed by', med.prescribed_by)}
      ${row('Evidence', med.evidence_strength)}
      ${row('Target Pathways', targetPathways)}
      ${row('Genomic Alignment', med.genomic_alignment)}
      ${row('Precautions', med.precautions)}
      ${row('Interactions', med.interactions)}
      ${row('Notes', med.notes)}
    </table>
  </div>`;
}

export function generateMedicationReportHtml(medications, { patientName = 'John Perkins', title = 'Medications & Supplements' } = {}) {
  const generatedAt = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  // Group and sort
  const grouped = {};
  for (const m of medications) {
    const t = m.type || 'supplement';
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(m);
  }

  // Within each group: active first, then stopped; alpha within each
  for (const t of Object.keys(grouped)) {
    grouped[t].sort((a, b) => {
      if (!!b.active !== !!a.active) return b.active - a.active;
      return a.name.localeCompare(b.name);
    });
  }

  const activeTotal   = medications.filter(m => m.active).length;
  const inactiveTotal = medications.length - activeTotal;

  const sections = TYPE_ORDER
    .filter(t => grouped[t]?.length)
    .map(t => {
      const colors = TYPE_COLORS[t] || TYPE_COLORS.supplement;
      const cards  = grouped[t].map(m => medCard(m, colors)).join('\n');
      const activeN   = grouped[t].filter(m => m.active).length;
      const inactiveN = grouped[t].length - activeN;
      const countLine = [
        activeN   ? `${activeN} active`   : null,
        inactiveN ? `${inactiveN} stopped` : null,
      ].filter(Boolean).join(', ');

      return `
    <section class="type-section">
      <h2 class="section-heading" style="border-color:${colors.border}">
        ${TYPE_LABELS[t] || t}
        <span class="section-count">${countLine}</span>
      </h2>
      <div class="cards">${cards}</div>
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
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px;
    color: #1e293b;
    background: #fff;
    padding: 28px 36px;
    max-width: 900px;
    margin: 0 auto;
  }

  /* ── Header ─────────────────────────────────────── */
  .report-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 16px;
    border-bottom: 2px solid #0f172a;
    margin-bottom: 20px;
  }
  .report-title { font-size: 22px; font-weight: 800; color: #0f172a; }
  .report-patient { font-size: 14px; color: #475569; margin-top: 3px; }
  .report-meta { text-align: right; font-size: 11px; color: #94a3b8; line-height: 1.6; }
  .report-meta strong { color: #475569; }

  /* ── Summary bar ─────────────────────────────────── */
  .summary-bar {
    display: flex; gap: 12px; flex-wrap: wrap;
    margin-bottom: 24px;
  }
  .summary-chip {
    padding: 5px 14px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    background: #f1f5f9;
    color: #475569;
  }
  .summary-chip.total { background: #0f172a; color: #fff; }

  /* ── Section headings ────────────────────────────── */
  .section-heading {
    font-size: 15px;
    font-weight: 700;
    color: #0f172a;
    padding: 10px 14px;
    border-left: 4px solid #94a3b8;
    background: #f8fafc;
    border-radius: 0 8px 8px 0;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .section-count { font-size: 11px; font-weight: 500; color: #64748b; }

  /* ── Cards ───────────────────────────────────────── */
  .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 24px; }

  .med-card {
    padding: 11px 13px;
    border-radius: 8px;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .med-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
    gap: 8px;
  }
  .med-title { flex: 1; }
  .med-name { font-weight: 700; font-size: 13px; color: #0f172a; display: block; }
  .brand { font-size: 10px; color: #64748b; margin-top: 1px; display: block; }
  .med-badges { display: flex; gap: 5px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }

  .badge {
    font-size: 10px; font-weight: 600;
    padding: 2px 7px; border-radius: 10px;
  }
  .badge.active  { background: #d1fae5; color: #065f46; }
  .badge.stopped { background: #fee2e2; color: #991b1b; }

  .type-badge {
    font-size: 10px; font-weight: 600;
    padding: 2px 7px; border-radius: 10px;
  }

  /* ── Detail table ────────────────────────────────── */
  .detail-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11.5px;
  }
  .detail-table tr { border-bottom: 1px solid rgba(0,0,0,0.05); }
  .detail-table tr:last-child { border-bottom: none; }
  .detail-table td { padding: 3px 4px; vertical-align: top; line-height: 1.4; }
  .detail-table .lbl {
    font-weight: 600;
    color: #64748b;
    white-space: nowrap;
    padding-right: 8px;
    width: 30%;
  }

  /* ── Footer ──────────────────────────────────────── */
  .report-footer {
    margin-top: 24px;
    padding-top: 12px;
    border-top: 1px solid #e2e8f0;
    font-size: 10px;
    color: #94a3b8;
    display: flex;
    justify-content: space-between;
  }

  /* ── Print overrides ─────────────────────────────── */
  @media print {
    body { padding: 0; font-size: 11px; }
    .no-print { display: none !important; }
    .cards { grid-template-columns: 1fr 1fr; }
    .med-card { page-break-inside: avoid; break-inside: avoid; }
    .type-section { page-break-inside: avoid; break-inside: avoid; }
  }
</style>
</head>
<body>

<div class="no-print" style="
  background:#1d4ed8;color:#fff;padding:10px 16px;border-radius:8px;
  margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;
">
  <span>📄 <strong>Print Preview</strong> — Use your browser's Print (⌘P) to save as PDF</span>
  <button onclick="window.print()" style="
    background:#fff;color:#1d4ed8;border:none;padding:6px 16px;
    border-radius:6px;font-weight:700;cursor:pointer;font-size:13px;
  ">🖨️ Print / Save PDF</button>
</div>

<div class="report-header">
  <div>
    <div class="report-title">💊 ${title}</div>
    <div class="report-patient">Patient: <strong>${patientName}</strong></div>
  </div>
  <div class="report-meta">
    <div>Generated: <strong>${generatedAt}</strong></div>
    <div>Medical Research Tracker</div>
    <div>PRIVATE &amp; CONFIDENTIAL</div>
  </div>
</div>

<div class="summary-bar">
  <span class="summary-chip total">Total: ${medications.length}</span>
  <span class="summary-chip" style="background:#d1fae5;color:#065f46">✅ Active: ${activeTotal}</span>
  ${inactiveTotal ? `<span class="summary-chip" style="background:#fee2e2;color:#991b1b">🛑 Stopped: ${inactiveTotal}</span>` : ''}
  ${Object.entries(grouped).map(([t, arr]) =>
    `<span class="summary-chip">${TYPE_LABELS[t]?.replace(/^[^ ]+ /, '') || t}: ${arr.length}</span>`
  ).join('')}
</div>

${sections}

<div class="report-footer">
  <span>Generated by Medical Research Tracker · ${generatedAt}</span>
  <span>Patient: ${patientName} · PRIVATE &amp; CONFIDENTIAL</span>
</div>

</body>
</html>`;
}
