/**
 * BodyDiagram — Interactive anatomical diagram for radiology findings.
 * SVG-based, no external dependencies, fully local.
 * Shows AI-extracted findings as color-coded markers on anatomical regions.
 * Supports manual click-to-annotate mode.
 */
import { useState, useCallback } from 'react';

// ── Finding type colors ─────────────────────────────────────────────────────
const FINDING_COLORS = {
  'metastasis':      { fill: '#dc2626', stroke: '#991b1b', label: 'Metastasis',       emoji: '🔴' },
  'primary-tumor':   { fill: '#9f1239', stroke: '#881337', label: 'Primary Tumor',     emoji: '🟣' },
  'mass':            { fill: '#ea580c', stroke: '#9a3412', label: 'Mass/Lesion',        emoji: '🟠' },
  'lymphadenopathy': { fill: '#7c3aed', stroke: '#5b21b6', label: 'Lymphadenopathy',   emoji: '🟣' },
  'inflammation':    { fill: '#d97706', stroke: '#92400e', label: 'Inflammation',       emoji: '🟡' },
  'suspicious':      { fill: '#f59e0b', stroke: '#b45309', label: 'Suspicious',         emoji: '🟡' },
  'normal':          { fill: '#16a34a', stroke: '#14532d', label: 'Normal',             emoji: '🟢' },
  'other':           { fill: '#0369a1', stroke: '#075985', label: 'Other Finding',      emoji: '🔵' },
};

// ── Anatomical region definitions ────────────────────────────────────────────
// Each has: id, label, cx, cy (marker center), shape info for hit area
const REGIONS = {
  'head':                  { label: 'Head / Brain',           cx: 160, cy: 52  },
  'neck':                  { label: 'Neck',                   cx: 160, cy: 108 },
  'left-lung':             { label: 'Left Lung',              cx: 118, cy: 188 },
  'right-lung':            { label: 'Right Lung',             cx: 202, cy: 188 },
  'heart':                 { label: 'Heart',                  cx: 152, cy: 188 },
  'liver':                 { label: 'Liver',                  cx: 198, cy: 250 },
  'spleen':                { label: 'Spleen',                 cx: 117, cy: 248 },
  'stomach':               { label: 'Stomach',                cx: 152, cy: 258 },
  'left-kidney':           { label: 'Left Kidney',            cx: 116, cy: 288 },
  'right-kidney':          { label: 'Right Kidney',           cx: 198, cy: 288 },
  'left-adrenal':          { label: 'Left Adrenal',           cx: 122, cy: 268 },
  'right-adrenal':         { label: 'Right Adrenal',          cx: 192, cy: 268 },
  'abdominal-lymph-nodes': { label: 'Abdominal Lymph Nodes',  cx: 152, cy: 310 },
  'bladder':               { label: 'Bladder',                cx: 152, cy: 350 },
  'pelvis':                { label: 'Pelvis',                  cx: 152, cy: 368 },
  'left-hip':              { label: 'Left Hip',               cx: 108, cy: 390 },
  'right-hip':             { label: 'Right Hip',              cx: 196, cy: 390 },
  'spine':                 { label: 'Spine',                  cx: 152, cy: 270 },
  'left-shoulder':         { label: 'Left Shoulder',          cx: 98,  cy: 140 },
  'right-shoulder':        { label: 'Right Shoulder',         cx: 222, cy: 140 },
  'left-arm':              { label: 'Left Arm',               cx: 80,  cy: 238 },
  'right-arm':             { label: 'Right Arm',              cx: 240, cy: 238 },
  'left-leg':              { label: 'Left Leg',               cx: 124, cy: 480 },
  'right-leg':             { label: 'Right Leg',              cx: 188, cy: 480 },
  'peritoneum':            { label: 'Peritoneum',             cx: 152, cy: 300 },
  'soft-tissue':           { label: 'Soft Tissue',            cx: 152, cy: 220 },
  'left-lymph-node':       { label: 'Left Lymph Node',        cx: 100, cy: 170 },
  'right-lymph-node':      { label: 'Right Lymph Node',       cx: 210, cy: 170 },
};

// ── SVG Body outline paths ──────────────────────────────────────────────────
function BodyOutlineSVG() {
  return (
    <g>
      {/* Body outline */}
      <defs>
        <filter id="body-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.08" />
        </filter>
      </defs>

      {/* Head */}
      <ellipse cx="160" cy="52" rx="36" ry="42" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1.5" filter="url(#body-shadow)" />
      {/* Facial features (subtle) */}
      <ellipse cx="149" cy="56" rx="4" ry="4.5" fill="#e2e8f0" /> {/* left eye */}
      <ellipse cx="171" cy="56" rx="4" ry="4.5" fill="#e2e8f0" /> {/* right eye */}
      <path d="M 152 68 Q 160 74 168 68" stroke="#cbd5e1" strokeWidth="1" fill="none" /> {/* mouth */}

      {/* Neck */}
      <rect x="147" y="90" width="26" height="22" rx="4" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1.5" />

      {/* Torso */}
      <path d="M 100 110 Q 90 120 88 145 L 88 320 Q 88 335 100 338 L 220 338 Q 232 335 232 320 L 232 145 Q 230 120 220 110 Z"
            fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" filter="url(#body-shadow)" />

      {/* Shoulders */}
      <ellipse cx="100" cy="135" rx="22" ry="18" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1.5" />
      <ellipse cx="220" cy="135" rx="22" ry="18" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1.5" />

      {/* Left arm */}
      <path d="M 84 142 Q 72 155 68 200 L 68 300 Q 68 312 76 312 L 90 312 Q 98 312 98 300 L 98 198 Q 97 155 110 142 Z"
            fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1.5" />

      {/* Right arm */}
      <path d="M 236 142 Q 248 155 252 200 L 252 300 Q 252 312 244 312 L 230 312 Q 222 312 222 300 L 222 198 Q 223 155 210 142 Z"
            fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1.5" />

      {/* Pelvis */}
      <path d="M 100 335 Q 88 345 86 365 L 90 385 Q 100 398 160 398 Q 220 398 230 385 L 234 365 Q 232 345 220 335 Z"
            fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1.5" />

      {/* Left leg */}
      <path d="M 106 392 Q 96 405 94 430 L 94 540 Q 94 552 106 552 L 138 552 Q 150 552 150 540 L 150 428 Q 150 405 142 392 Z"
            fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1.5" />

      {/* Right leg */}
      <path d="M 170 392 Q 170 405 170 428 L 170 540 Q 170 552 182 552 L 214 552 Q 226 552 226 540 L 226 428 Q 224 405 214 392 Z"
            fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1.5" />

      {/* Internal organ outlines (subtle) */}
      {/* Lungs */}
      <path d="M 110 148 Q 100 165 100 195 Q 100 228 115 240 Q 130 248 138 232 L 140 148 Z"
            fill="#dbeafe" fillOpacity="0.5" stroke="#93c5fd" strokeWidth="1" />
      <path d="M 210 148 Q 220 165 220 195 Q 220 228 205 240 Q 190 248 182 232 L 180 148 Z"
            fill="#dbeafe" fillOpacity="0.5" stroke="#93c5fd" strokeWidth="1" />

      {/* Heart */}
      <path d="M 145 172 Q 140 165 148 162 Q 156 159 162 168 Q 168 159 174 162 Q 182 165 175 172 L 160 194 Z"
            fill="#fecaca" fillOpacity="0.6" stroke="#fca5a5" strokeWidth="1" />

      {/* Liver */}
      <path d="M 162 228 Q 205 224 214 248 Q 210 268 190 268 Q 168 268 158 255 Q 154 245 162 228 Z"
            fill="#fed7aa" fillOpacity="0.5" stroke="#fdba74" strokeWidth="1" />

      {/* Spleen */}
      <ellipse cx="116" cy="248" rx="18" ry="22" fill="#e9d5ff" fillOpacity="0.5" stroke="#c4b5fd" strokeWidth="1" />

      {/* Kidneys */}
      <ellipse cx="116" cy="286" rx="14" ry="20" fill="#fde68a" fillOpacity="0.5" stroke="#fcd34d" strokeWidth="1" />
      <ellipse cx="200" cy="286" rx="14" ry="20" fill="#fde68a" fillOpacity="0.5" stroke="#fcd34d" strokeWidth="1" />

      {/* Bladder */}
      <ellipse cx="160" cy="318" rx="22" ry="18" fill="#d1fae5" fillOpacity="0.5" stroke="#6ee7b7" strokeWidth="1" />

      {/* Spine */}
      <rect x="154" y="148" width="12" height="180" rx="4" fill="#e2e8f0" fillOpacity="0.6" stroke="#cbd5e1" strokeWidth="0.5" />

      {/* Spine vertebrae dots */}
      {[158, 175, 192, 209, 226, 243, 260, 277, 294, 308].map((y, i) => (
        <rect key={i} x="155" y={y} width="10" height="8" rx="2" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="0.5" />
      ))}
    </g>
  );
}

// ── Marker dot ──────────────────────────────────────────────────────────────
function MarkerDot({ marker, onHover, isHovered }) {
  const c = FINDING_COLORS[marker.type] || FINDING_COLORS.other;
  const r = REGION_FOR(marker.region);
  if (!r) return null;
  const { cx, cy } = r;

  return (
    <g
      onMouseEnter={() => onHover(marker)}
      onMouseLeave={() => onHover(null)}
      style={{ cursor: 'pointer' }}
    >
      {/* Pulse ring */}
      {isHovered && (
        <circle cx={cx} cy={cy} r={16} fill={c.fill} fillOpacity={0.15} stroke={c.stroke} strokeWidth={1} />
      )}
      {/* Marker circle */}
      <circle cx={cx} cy={cy} r={isHovered ? 10 : 8} fill={c.fill} stroke={c.stroke} strokeWidth={2}
        style={{ transition: 'r 0.15s' }} />
      {/* Size label if we have mm data */}
      {marker.size_mm && (
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: '6px', fill: '#fff', fontWeight: 700, pointerEvents: 'none' }}>
          {marker.size_mm}
        </text>
      )}
    </g>
  );
}

function REGION_FOR(regionId) {
  return REGIONS[regionId] || null;
}

// ── Main component ───────────────────────────────────────────────────────────
export default function BodyDiagram({ findings = [], markers = [], onMarkersChange, readOnly = false }) {
  const [hoveredMarker, setHoveredMarker]   = useState(null);
  const [hoveredRegion, setHoveredRegion]   = useState(null);
  const [addMode, setAddMode]               = useState(false);
  const [addType, setAddType]               = useState('metastasis');
  const [addNote, setAddNote]               = useState('');
  const [tooltip, setTooltip]               = useState(null);

  // Merge AI-extracted regions + manual markers into one marker list
  const allMarkers = [
    ...findings.map(f => ({ ...f, source: 'ai' })),
    ...markers.map(m => ({ ...m, source: 'manual' })),
  ];

  const handleRegionClick = useCallback((regionId, e) => {
    if (!addMode || readOnly) return;
    const newMarker = {
      region: regionId,
      type: addType,
      finding: addNote || REGIONS[regionId]?.label || regionId,
      note: addNote,
      source: 'manual',
      id: Date.now(),
    };
    const updated = [...markers, newMarker];
    onMarkersChange?.(updated);
    setAddNote('');
  }, [addMode, addType, addNote, markers, onMarkersChange, readOnly]);

  const removeMarker = useCallback((id) => {
    const updated = markers.filter(m => m.id !== id);
    onMarkersChange?.(updated);
  }, [markers, onMarkersChange]);

  // Clickable region overlays (invisible hit areas)
  const RegionHitArea = ({ id, children }) => (
    <g
      onClick={(e) => handleRegionClick(id, e)}
      onMouseEnter={() => addMode && setHoveredRegion(id)}
      onMouseLeave={() => setHoveredRegion(null)}
      style={{ cursor: addMode ? 'crosshair' : 'default' }}
    >
      {children}
      {addMode && hoveredRegion === id && (
        <circle
          cx={REGIONS[id]?.cx || 0}
          cy={REGIONS[id]?.cy || 0}
          r={20}
          fill="#3b82f6"
          fillOpacity={0.2}
          stroke="#3b82f6"
          strokeWidth={1.5}
          strokeDasharray="4,3"
        />
      )}
    </g>
  );

  const hoveredInfo = hoveredMarker;

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {/* ── Diagram ── */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Anatomy Diagram
          </span>
          {!readOnly && (
            <button
              onClick={() => setAddMode(!addMode)}
              style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                border: addMode ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                background: addMode ? '#eff6ff' : '#f8fafc',
                color: addMode ? '#2563eb' : '#64748b',
                cursor: 'pointer',
              }}
            >
              {addMode ? '✏️ Click body to mark' : '➕ Add Marker'}
            </button>
          )}
        </div>

        {/* Add controls */}
        {addMode && !readOnly && (
          <div style={{ marginBottom: 10, padding: '10px 12px', background: '#eff6ff',
            border: '1px solid #bfdbfe', borderRadius: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={addType} onChange={e => setAddType(e.target.value)}
              style={{ padding: '3px 8px', fontSize: 12, borderRadius: 6, border: '1px solid #bfdbfe' }}>
              {Object.entries(FINDING_COLORS).map(([k, v]) => (
                <option key={k} value={k}>{v.emoji} {v.label}</option>
              ))}
            </select>
            <input
              value={addNote} onChange={e => setAddNote(e.target.value)}
              placeholder="Note (optional)"
              style={{ padding: '3px 8px', fontSize: 12, borderRadius: 6, border: '1px solid #bfdbfe',
                flex: 1, minWidth: 120, maxWidth: 200 }}
            />
            <span style={{ fontSize: 11, color: '#2563eb' }}>← Click a body region</span>
          </div>
        )}

        <svg
          viewBox="0 0 320 570"
          width={260}
          height={464}
          style={{
            background: '#ffffff',
            borderRadius: 16,
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            display: 'block',
          }}
        >
          {/* Body anatomy */}
          <BodyOutlineSVG />

          {/* Invisible clickable region overlays */}
          {Object.entries(REGIONS).map(([id, r]) => (
            <RegionHitArea key={id} id={id}>
              <circle cx={r.cx} cy={r.cy} r={22} fill="transparent" />
            </RegionHitArea>
          ))}

          {/* Finding markers */}
          {allMarkers.map((marker, i) => (
            <MarkerDot
              key={marker.id || `${marker.region}-${i}`}
              marker={marker}
              onHover={setHoveredMarker}
              isHovered={hoveredMarker?.region === marker.region && hoveredMarker?.type === marker.type}
            />
          ))}
        </svg>

        {/* Legend */}
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {Object.entries(FINDING_COLORS)
            .filter(([k]) => allMarkers.some(m => m.type === k))
            .map(([k, v]) => (
              <span key={k} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 500,
                background: v.fill + '18', color: v.fill, border: `1px solid ${v.fill}40`,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: v.fill, flexShrink: 0 }} />
                {v.label}
              </span>
            ))}
        </div>
      </div>

      {/* ── Findings panel ── */}
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase',
          letterSpacing: '0.05em', marginBottom: 10 }}>
          Findings by Region
        </div>

        {/* Hover tooltip */}
        {hoveredInfo && (
          <div style={{
            padding: '10px 14px', borderRadius: 10, marginBottom: 10,
            background: (FINDING_COLORS[hoveredInfo.type] || FINDING_COLORS.other).fill + '12',
            border: `1px solid ${(FINDING_COLORS[hoveredInfo.type] || FINDING_COLORS.other).fill}40`,
          }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 3 }}>
              {(FINDING_COLORS[hoveredInfo.type] || FINDING_COLORS.other).emoji} {REGIONS[hoveredInfo.region]?.label || hoveredInfo.region}
            </div>
            <div style={{ fontSize: 12, color: '#334155' }}>{hoveredInfo.finding}</div>
            {hoveredInfo.size_mm && (
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>Size: {hoveredInfo.size_mm}mm</div>
            )}
          </div>
        )}

        {/* All findings list */}
        {allMarkers.length === 0 ? (
          <div style={{ color: '#94a3b8', fontSize: 13, fontStyle: 'italic' }}>
            No findings mapped yet.
            {!readOnly && ' Click "Add Marker" to annotate.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {allMarkers.map((marker, i) => {
              const c = FINDING_COLORS[marker.type] || FINDING_COLORS.other;
              const isManual = marker.source === 'manual';
              return (
                <div key={marker.id || `${marker.region}-${i}`}
                  onMouseEnter={() => setHoveredMarker(marker)}
                  onMouseLeave={() => setHoveredMarker(null)}
                  style={{
                    padding: '8px 10px', borderRadius: 8, cursor: 'default',
                    background: hoveredMarker?.region === marker.region ? c.fill + '15' : '#f8fafc',
                    border: `1px solid ${hoveredMarker?.region === marker.region ? c.fill + '50' : '#e2e8f0'}`,
                    transition: 'all 0.15s',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.fill, flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, fontSize: 12, color: '#1e293b' }}>
                        {REGIONS[marker.region]?.label || marker.region}
                      </span>
                      {isManual && (
                        <span style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic' }}>manual</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#475569', marginLeft: 16, lineHeight: 1.4 }}>
                      {marker.finding}
                      {marker.size_mm && <span style={{ color: '#64748b' }}> · {marker.size_mm}mm</span>}
                    </div>
                  </div>
                  {isManual && !readOnly && (
                    <button onClick={() => removeMarker(marker.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer',
                        color: '#94a3b8', fontSize: 14, padding: '0 2px', lineHeight: 1 }}>
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {allMarkers.length > 0 && (
          <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8,
            background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 11, color: '#64748b' }}>
            💡 Hover a row or dot to highlight · {allMarkers.filter(m => m.source === 'ai').length} AI-detected · {allMarkers.filter(m => m.source === 'manual').length} manual
          </div>
        )}
      </div>
    </div>
  );
}
