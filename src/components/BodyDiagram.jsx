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
// Coordinates calibrated to the updated high-fidelity body SVG (viewBox 0 0 320 590)
const REGIONS = {
  'head':                  { label: 'Head / Brain',           cx: 160, cy: 48  },
  'neck':                  { label: 'Neck',                   cx: 160, cy: 112 },
  'left-lung':             { label: 'Left Lung',              cx: 112, cy: 200 },
  'right-lung':            { label: 'Right Lung',             cx: 208, cy: 200 },
  'heart':                 { label: 'Heart',                  cx: 160, cy: 176 },
  'liver':                 { label: 'Liver',                  cx: 196, cy: 244 },
  'spleen':                { label: 'Spleen',                 cx: 102, cy: 264 },
  'stomach':               { label: 'Stomach',                cx: 146, cy: 256 },
  'left-kidney':           { label: 'Left Kidney',            cx: 104, cy: 304 },
  'right-kidney':          { label: 'Right Kidney',           cx: 216, cy: 304 },
  'left-adrenal':          { label: 'Left Adrenal',           cx: 104, cy: 280 },
  'right-adrenal':         { label: 'Right Adrenal',          cx: 216, cy: 280 },
  'abdominal-lymph-nodes': { label: 'Abdominal Lymph Nodes',  cx: 160, cy: 318 },
  'bladder':               { label: 'Bladder',                cx: 160, cy: 348 },
  'pelvis':                { label: 'Pelvis',                 cx: 160, cy: 378 },
  'left-hip':              { label: 'Left Hip',               cx: 104, cy: 398 },
  'right-hip':             { label: 'Right Hip',              cx: 216, cy: 398 },
  'spine':                 { label: 'Spine',                  cx: 160, cy: 240 },
  'left-shoulder':         { label: 'Left Shoulder',          cx: 94,  cy: 138 },
  'right-shoulder':        { label: 'Right Shoulder',         cx: 226, cy: 138 },
  'left-arm':              { label: 'Left Arm',               cx: 68,  cy: 260 },
  'right-arm':             { label: 'Right Arm',              cx: 252, cy: 260 },
  'left-leg':              { label: 'Left Leg',               cx: 114, cy: 528 },
  'right-leg':             { label: 'Right Leg',              cx: 206, cy: 528 },
  'peritoneum':            { label: 'Peritoneum',             cx: 160, cy: 302 },
  'soft-tissue':           { label: 'Soft Tissue',            cx: 160, cy: 222 },
  'left-lymph-node':       { label: 'Left Lymph Node',        cx: 98,  cy: 166 },
  'right-lymph-node':      { label: 'Right Lymph Node',       cx: 222, cy: 166 },
};

// ── SVG Body outline paths ──────────────────────────────────────────────────
function BodyOutlineSVG() {
  return (
    <g>
      <defs>
        <filter id="body-shadow" x="-15%" y="-5%" width="130%" height="115%">
          <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#0f172a" floodOpacity="0.10" />
        </filter>
        <filter id="organ-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <linearGradient id="skin-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#e8d5c4" />
          <stop offset="50%" stopColor="#f5e6d8" />
          <stop offset="100%" stopColor="#e8d5c4" />
        </linearGradient>
        <linearGradient id="skin-grad-v" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f5e6d8" />
          <stop offset="100%" stopColor="#e2c9b5" />
        </linearGradient>
      </defs>

      {/* ── HEAD ─────────────────────────────────────────────────── */}
      {/* Skull / cranium */}
      <ellipse cx="160" cy="50" rx="38" ry="44" fill="url(#skin-grad)" stroke="#c4a882" strokeWidth="1.5" filter="url(#body-shadow)" />
      {/* Jaw / lower face narrowing */}
      <path d="M 130 68 Q 125 82 132 92 Q 145 100 160 101 Q 175 100 188 92 Q 195 82 190 68"
            fill="url(#skin-grad)" stroke="#c4a882" strokeWidth="1.5" />
      {/* Ear left */}
      <path d="M 122 48 Q 116 52 116 60 Q 116 68 122 72 Q 126 70 126 60 Q 126 50 122 48 Z"
            fill="#e8d5c4" stroke="#c4a882" strokeWidth="1" />
      {/* Ear right */}
      <path d="M 198 48 Q 204 52 204 60 Q 204 68 198 72 Q 194 70 194 60 Q 194 50 198 48 Z"
            fill="#e8d5c4" stroke="#c4a882" strokeWidth="1" />
      {/* Eye sockets */}
      <ellipse cx="148" cy="54" rx="7" ry="5.5" fill="#c8b09a" fillOpacity="0.35" />
      <ellipse cx="172" cy="54" rx="7" ry="5.5" fill="#c8b09a" fillOpacity="0.35" />
      {/* Pupils */}
      <ellipse cx="148" cy="54" rx="3.5" ry="3.5" fill="#6b4c3b" fillOpacity="0.6" />
      <ellipse cx="172" cy="54" rx="3.5" ry="3.5" fill="#6b4c3b" fillOpacity="0.6" />
      {/* Nose */}
      <path d="M 157 62 Q 155 74 152 78 Q 156 80 160 80 Q 164 80 168 78 Q 165 74 163 62 Z"
            fill="#c4a882" fillOpacity="0.3" stroke="none" />
      {/* Mouth */}
      <path d="M 151 87 Q 156 91 160 91 Q 164 91 169 87" stroke="#a07850" strokeWidth="1.2" fill="none" strokeLinecap="round" />

      {/* ── NECK ─────────────────────────────────────────────────── */}
      <path d="M 148 98 Q 145 100 144 108 L 144 122 Q 152 125 160 125 Q 168 125 176 122 L 176 108 Q 175 100 172 98 Z"
            fill="url(#skin-grad)" stroke="#c4a882" strokeWidth="1.5" />
      {/* Clavicle hints */}
      <path d="M 100 130 Q 128 122 144 124" stroke="#c4a882" strokeWidth="1" fill="none" strokeOpacity="0.6" />
      <path d="M 220 130 Q 192 122 176 124" stroke="#c4a882" strokeWidth="1" fill="none" strokeOpacity="0.6" />

      {/* ── TORSO ────────────────────────────────────────────────── */}
      {/* Main torso — chest wider, waist narrower, hips flare */}
      <path d="
        M 108 124
        Q  92 128  88 148
        L  86 210
        Q  84 230  88 248
        Q  90 262  96 272
        L  96 330
        Q  96 342 108 344
        L 212 344
        Q 224 342 224 330
        L 224 272
        Q 230 262 232 248
        Q 236 230 234 210
        L 232 148
        Q 228 128 212 124
        Z"
            fill="url(#skin-grad-v)" stroke="#c4a882" strokeWidth="1.5" filter="url(#body-shadow)" />
      {/* Chest midline crease */}
      <line x1="160" y1="126" x2="160" y2="210" stroke="#c4a882" strokeWidth="0.6" strokeOpacity="0.4" />
      {/* Pectoral contour lines */}
      <path d="M 108 148 Q 132 140 156 148" stroke="#c4a882" strokeWidth="0.8" fill="none" strokeOpacity="0.35" />
      <path d="M 212 148 Q 188 140 164 148" stroke="#c4a882" strokeWidth="0.8" fill="none" strokeOpacity="0.35" />
      {/* Rib cage hint */}
      {[168, 182, 196, 210].map((y, i) => (
        <path key={i}
          d={`M 96 ${y} Q 128 ${y - 4} 156 ${y}`}
          stroke="#c4a882" strokeWidth="0.6" fill="none" strokeOpacity="0.25" />
      ))}
      {[168, 182, 196, 210].map((y, i) => (
        <path key={i + 10}
          d={`M 224 ${y} Q 192 ${y - 4} 164 ${y}`}
          stroke="#c4a882" strokeWidth="0.6" fill="none" strokeOpacity="0.25" />
      ))}
      {/* Navel */}
      <ellipse cx="160" cy="254" rx="4" ry="3" fill="#c4a882" fillOpacity="0.4" />
      {/* Waist taper crease */}
      <path d="M 90 240 Q 100 244 108 243" stroke="#c4a882" strokeWidth="0.7" fill="none" strokeOpacity="0.3" />
      <path d="M 230 240 Q 220 244 212 243" stroke="#c4a882" strokeWidth="0.7" fill="none" strokeOpacity="0.3" />

      {/* ── SHOULDERS ────────────────────────────────────────────── */}
      <ellipse cx="96"  cy="138" rx="26" ry="20" fill="url(#skin-grad)" stroke="#c4a882" strokeWidth="1.3" />
      <ellipse cx="224" cy="138" rx="26" ry="20" fill="url(#skin-grad)" stroke="#c4a882" strokeWidth="1.3" />

      {/* ── ARMS ─────────────────────────────────────────────────── */}
      {/* Left arm — upper, elbow, forearm, hand */}
      <path d="M 76 148 Q 64 160 60 192 Q 58 216 62 230 Q 66 242 72 244 L 76 244 Q 76 232 74 218 Q 72 200 78 182 Q 84 162 96 150 Z"
            fill="url(#skin-grad)" stroke="#c4a882" strokeWidth="1.3" />
      <path d="M 62 230 Q 58 250 58 280 L 58 308 Q 58 318 66 320 L 78 320 Q 86 318 86 308 L 86 276 Q 87 256 76 244 Z"
            fill="url(#skin-grad)" stroke="#c4a882" strokeWidth="1.3" />
      {/* Left hand */}
      <ellipse cx="72" cy="324" rx="10" ry="7" fill="url(#skin-grad)" stroke="#c4a882" strokeWidth="1" />

      {/* Right arm */}
      <path d="M 244 148 Q 256 160 260 192 Q 262 216 258 230 Q 254 242 248 244 L 244 244 Q 244 232 246 218 Q 248 200 242 182 Q 236 162 224 150 Z"
            fill="url(#skin-grad)" stroke="#c4a882" strokeWidth="1.3" />
      <path d="M 258 230 Q 262 250 262 280 L 262 308 Q 262 318 254 320 L 242 320 Q 234 318 234 308 L 234 276 Q 233 256 244 244 Z"
            fill="url(#skin-grad)" stroke="#c4a882" strokeWidth="1.3" />
      {/* Right hand */}
      <ellipse cx="248" cy="324" rx="10" ry="7" fill="url(#skin-grad)" stroke="#c4a882" strokeWidth="1" />

      {/* ── PELVIS / HIPS ─────────────────────────────────────────── */}
      <path d="M 96 338 Q 82 348 80 368 Q 80 386 94 396 Q 114 404 160 404 Q 206 404 226 396 Q 240 386 240 368 Q 240 348 224 338 Z"
            fill="url(#skin-grad-v)" stroke="#c4a882" strokeWidth="1.5" />
      {/* Hip crease lines */}
      <path d="M 98 356 Q 116 362 132 360" stroke="#c4a882" strokeWidth="0.7" fill="none" strokeOpacity="0.35" />
      <path d="M 222 356 Q 204 362 188 360" stroke="#c4a882" strokeWidth="0.7" fill="none" strokeOpacity="0.35" />

      {/* ── LEGS ─────────────────────────────────────────────────── */}
      {/* Left thigh */}
      <path d="M 98 396 Q 88 408 86 432 Q 84 455 88 472 L 92 482 Q 100 488 118 488 Q 132 488 138 480 L 140 470 Q 142 452 140 430 Q 138 408 130 396 Z"
            fill="url(#skin-grad-v)" stroke="#c4a882" strokeWidth="1.4" />
      {/* Left knee */}
      <ellipse cx="114" cy="488" rx="22" ry="12" fill="url(#skin-grad)" stroke="#c4a882" strokeWidth="1.2" />
      {/* Left calf */}
      <path d="M 94 496 Q 90 516 91 540 Q 92 556 100 562 L 126 562 Q 136 556 136 540 Q 136 516 132 496 Q 126 490 114 488 Q 102 490 94 496 Z"
            fill="url(#skin-grad-v)" stroke="#c4a882" strokeWidth="1.3" />
      {/* Left foot */}
      <ellipse cx="113" cy="564" rx="20" ry="8" fill="url(#skin-grad)" stroke="#c4a882" strokeWidth="1" />
      <path d="M 96 566 Q 96 572 94 574 M 104 568 Q 104 574 102 576 M 113 569 Q 113 575 111 577 M 122 568 Q 122 574 120 576 M 130 566 Q 130 572 128 574"
            stroke="#c4a882" strokeWidth="1" strokeLinecap="round" fill="none" strokeOpacity="0.5" />

      {/* Right thigh */}
      <path d="M 222 396 Q 232 408 234 432 Q 236 455 232 472 L 228 482 Q 220 488 202 488 Q 188 488 182 480 L 180 470 Q 178 452 180 430 Q 182 408 190 396 Z"
            fill="url(#skin-grad-v)" stroke="#c4a882" strokeWidth="1.4" />
      {/* Right knee */}
      <ellipse cx="206" cy="488" rx="22" ry="12" fill="url(#skin-grad)" stroke="#c4a882" strokeWidth="1.2" />
      {/* Right calf */}
      <path d="M 226 496 Q 230 516 229 540 Q 228 556 220 562 L 194 562 Q 184 556 184 540 Q 184 516 188 496 Q 194 490 206 488 Q 218 490 226 496 Z"
            fill="url(#skin-grad-v)" stroke="#c4a882" strokeWidth="1.3" />
      {/* Right foot */}
      <ellipse cx="207" cy="564" rx="20" ry="8" fill="url(#skin-grad)" stroke="#c4a882" strokeWidth="1" />
      <path d="M 190 566 Q 190 572 188 574 M 198 568 Q 198 574 196 576 M 207 569 Q 207 575 205 577 M 216 568 Q 216 574 214 576 M 224 566 Q 224 572 222 574"
            stroke="#c4a882" strokeWidth="1" strokeLinecap="round" fill="none" strokeOpacity="0.5" />

      {/* ── INTERNAL ORGANS ──────────────────────────────────────── */}

      {/* Left Lung */}
      <path d="M 100 150 Q 92 168 90 196 Q 88 222 96 240 Q 106 254 122 256 Q 134 254 138 242 Q 142 228 140 196 L 140 150 Z"
            fill="#93c5fd" fillOpacity="0.28" stroke="#3b82f6" strokeWidth="1.2" strokeOpacity="0.55" />
      {/* Right Lung */}
      <path d="M 220 150 Q 228 168 230 196 Q 232 222 224 240 Q 214 254 198 256 Q 186 254 182 242 Q 178 228 180 196 L 180 150 Z"
            fill="#93c5fd" fillOpacity="0.28" stroke="#3b82f6" strokeWidth="1.2" strokeOpacity="0.55" />
      {/* Bronchi / airway */}
      <path d="M 160 134 L 160 158 M 160 158 Q 150 162 140 162 M 160 158 Q 170 162 180 162"
            stroke="#60a5fa" strokeWidth="1.2" fill="none" strokeOpacity="0.5" />

      {/* Heart — more realistic double-lobe shape */}
      <path d="M 152 174 Q 144 164 148 158 Q 154 154 160 160 Q 166 154 172 158 Q 176 164 168 174 Q 164 184 160 196 Q 156 184 152 174 Z"
            fill="#f87171" fillOpacity="0.55" stroke="#dc2626" strokeWidth="1.2" strokeOpacity="0.7" />
      {/* Aorta stub */}
      <path d="M 160 158 Q 158 150 162 144 Q 166 140 168 136"
            stroke="#dc2626" strokeWidth="1.2" fill="none" strokeOpacity="0.45" />

      {/* Liver — right lobe larger */}
      <path d="M 160 228 Q 164 220 200 220 Q 218 222 218 244 Q 216 264 196 270 Q 176 274 162 264 Q 154 256 156 242 Q 156 234 160 228 Z"
            fill="#fb923c" fillOpacity="0.35" stroke="#ea580c" strokeWidth="1.2" strokeOpacity="0.6" />
      {/* Gallbladder */}
      <ellipse cx="182" cy="272" rx="9" ry="6" fill="#fde68a" fillOpacity="0.55" stroke="#d97706" strokeWidth="0.8" />

      {/* Stomach */}
      <path d="M 140 232 Q 134 240 134 258 Q 134 272 142 278 Q 154 282 162 274 Q 168 266 166 250 Q 164 234 156 228 Q 148 226 140 232 Z"
            fill="#a3e635" fillOpacity="0.30" stroke="#65a30d" strokeWidth="1" strokeOpacity="0.55" />

      {/* Spleen */}
      <path d="M 96 246 Q 88 250 88 262 Q 88 276 96 280 Q 106 284 114 278 Q 120 272 118 260 Q 116 248 106 244 Q 100 242 96 246 Z"
            fill="#c084fc" fillOpacity="0.35" stroke="#9333ea" strokeWidth="1.1" strokeOpacity="0.55" />

      {/* Pancreas */}
      <path d="M 138 278 Q 150 274 170 276 Q 182 278 188 282 Q 178 288 162 288 Q 148 288 138 284 Z"
            fill="#fdba74" fillOpacity="0.40" stroke="#f97316" strokeWidth="0.9" strokeOpacity="0.5" />

      {/* Left Kidney */}
      <path d="M 96 282 Q 88 288 88 302 Q 88 318 96 324 Q 106 330 114 326 Q 122 320 122 306 Q 122 290 114 284 Q 106 280 96 282 Z"
            fill="#fde68a" fillOpacity="0.45" stroke="#ca8a04" strokeWidth="1.1" strokeOpacity="0.6" />
      {/* Right Kidney */}
      <path d="M 224 282 Q 232 288 232 302 Q 232 318 224 324 Q 214 330 206 326 Q 198 320 198 306 Q 198 290 206 284 Q 214 280 224 282 Z"
            fill="#fde68a" fillOpacity="0.45" stroke="#ca8a04" strokeWidth="1.1" strokeOpacity="0.6" />
      {/* Adrenal glands */}
      <ellipse cx="104" cy="280" rx="7" ry="5" fill="#fbbf24" fillOpacity="0.5" stroke="#d97706" strokeWidth="0.8" />
      <ellipse cx="216" cy="280" rx="7" ry="5" fill="#fbbf24" fillOpacity="0.5" stroke="#d97706" strokeWidth="0.8" />

      {/* Large intestine (colon frame) */}
      <path d="M 106 294 Q 102 310 104 332 Q 106 342 120 344 L 200 344 Q 214 342 216 332 Q 218 310 214 294 Q 210 282 200 282 Q 196 294 192 306 Q 182 318 160 318 Q 138 318 128 306 Q 124 294 120 282 Q 110 282 106 294 Z"
            fill="#86efac" fillOpacity="0.22" stroke="#22c55e" strokeWidth="0.9" strokeOpacity="0.45" />

      {/* Bladder */}
      <path d="M 142 328 Q 136 334 136 346 Q 136 360 144 366 Q 152 372 168 372 Q 184 372 190 366 Q 198 360 198 346 Q 198 334 190 328 Q 180 322 160 322 Q 150 322 142 328 Z"
            fill="#6ee7b7" fillOpacity="0.40" stroke="#10b981" strokeWidth="1.2" strokeOpacity="0.65" />

      {/* Uterus / Prostate placeholder (subtle) */}
      <ellipse cx="160" cy="378" rx="14" ry="9" fill="#c4b5fd" fillOpacity="0.25" stroke="#8b5cf6" strokeWidth="0.8" strokeOpacity="0.4" />

      {/* ── SPINE ────────────────────────────────────────────────── */}
      <rect x="155" y="138" width="10" height="194" rx="4" fill="#cbd5e1" fillOpacity="0.5" stroke="#94a3b8" strokeWidth="0.7" />
      {/* Vertebrae */}
      {[142, 157, 172, 187, 202, 217, 232, 247, 262, 277, 292, 306, 318].map((y, i) => (
        <rect key={i} x="155.5" y={y} width="9" height="7" rx="2" fill="#f0f4f8" stroke="#94a3b8" strokeWidth="0.5" />
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
          viewBox="0 0 320 590"
          width={272}
          height={500}
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
