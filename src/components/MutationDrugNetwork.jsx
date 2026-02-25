import React, { useState, useEffect, useRef } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';

const isElectron = typeof window !== 'undefined' && window.electron?.genomics?.getMutationNetwork;

const CATEGORY_META = {
  chemo:         { label: 'Chemotherapy',    emoji: '💊', bg: '#f5f3ff', border: '#8b5cf6', text: '#5b21b6', pill: '#8b5cf6' },
  immunotherapy: { label: 'Immunotherapy',   emoji: '🛡️', bg: '#eff6ff', border: '#3b82f6', text: '#1e40af', pill: '#3b82f6' },
  targeted:      { label: 'Targeted Therapy',emoji: '🎯', bg: '#fff7ed', border: '#f59e0b', text: '#92400e', pill: '#d97706' },
  supplement:    { label: 'Supplement',      emoji: '🌿', bg: '#f0fdf4', border: '#22c55e', text: '#166534', pill: '#16a34a' },
};

const EVIDENCE_BADGE = {
  FDA_approved:  { label: 'FDA Approved', bg: '#dcfce7', text: '#166534' },
  standard:      { label: 'Standard Care', bg: '#dbeafe', text: '#1e40af' },
  Phase_3:       { label: 'Phase 3',       bg: '#fef3c7', text: '#92400e' },
  Phase_2:       { label: 'Phase 2',       bg: '#fef9c3', text: '#78350f' },
  Phase_1:       { label: 'Phase 1',       bg: '#e0e7ff', text: '#3730a3' },
  preclinical:   { label: 'Preclinical',    bg: '#f1f5f9', text: '#475569' },
};

// ── Cytoscape styles ───────────────────────────────────────────────────────

const STYLESHEET = [
  { selector: 'node', style: { 'label': 'data(label)', 'text-valign': 'center', 'text-halign': 'center', 'font-size': '11px', 'font-weight': 'bold', 'color': '#fff', 'text-outline-color': 'rgba(0,0,0,0.4)', 'text-outline-width': 1.5, 'text-wrap': 'wrap', 'text-max-width': 100 }},
  { selector: 'node[type="mutation"]', style: { 'background-color': '#dc2626', 'shape': 'hexagon', 'width': 80, 'height': 80, 'font-size': '14px', 'font-weight': 900 }},
  { selector: 'node[type="pathway"]',  style: { 'background-color': '#0369a1', 'shape': 'ellipse', 'width': 110, 'height': 50, 'font-size': '10px' }},
  { selector: 'node[category="chemo"]',         style: { 'background-color': '#7c3aed', 'shape': 'roundrectangle', 'width': 130, 'height': 50 }},
  { selector: 'node[category="immunotherapy"]', style: { 'background-color': '#1d4ed8', 'shape': 'roundrectangle', 'width': 130, 'height': 50 }},
  { selector: 'node[category="targeted"]',      style: { 'background-color': '#b45309', 'shape': 'roundrectangle', 'width': 130, 'height': 50 }},
  { selector: 'node[category="supplement"]',    style: { 'background-color': '#166534', 'shape': 'roundrectangle', 'width': 130, 'height': 50 }},
  { selector: 'edge', style: { 'width': 1.5, 'line-color': '#cbd5e1', 'target-arrow-color': '#cbd5e1', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier', 'opacity': 0.6 }},
  { selector: 'edge[rel="drives"]',       style: { 'line-color': '#dc2626', 'target-arrow-color': '#dc2626', 'opacity': 0.5 }},
  { selector: 'edge[category="targeted"]',      style: { 'line-color': '#d97706', 'target-arrow-color': '#d97706', 'opacity': 0.7 }},
  { selector: 'edge[category="immunotherapy"]', style: { 'line-color': '#3b82f6', 'target-arrow-color': '#3b82f6', 'opacity': 0.7 }},
  { selector: ':selected', style: { 'border-width': 3, 'border-color': '#10b981' }},
];

const LAYOUT = { name: 'cose', idealEdgeLength: 130, nodeOverlap: 30, fit: true, padding: 40, animate: false, nodeRepulsion: 600000, edgeElasticity: 100, gravity: 80, numIter: 1500 };

// ── PathwayCard: one mutation with treatments by category ──────────────────

function PathwayCard({ mutNode, treatmentNodes }) {
  const [expanded, setExpanded] = useState(false);
  const byCategory = { chemo: [], immunotherapy: [], targeted: [], supplement: [] };
  for (const tx of treatmentNodes) {
    const cat = tx.category;
    if (byCategory[cat]) byCategory[cat].push(tx);
  }
  const totalTx = treatmentNodes.length;
  const fdaApproved = treatmentNodes.filter(t => t.evidence === 'FDA_approved' || t.evidence === 'standard').length;

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px', background: '#fff' }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ padding: '14px 18px', background: '#fef2f2', borderBottom: expanded ? '1px solid #fecaca' : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
      >
        <div style={{ width: '44px', height: '44px', background: '#dc2626', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '15px', flexShrink: 0 }}>
          {mutNode.label}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '16px', color: '#1e293b' }}>
            {mutNode.label}
            {mutNode.alteration && <span style={{ fontWeight: 400, color: '#64748b', fontSize: '14px', marginLeft: '8px' }}>{mutNode.alteration}</span>}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
            {mutNode.vaf != null && <span style={{ marginRight: '12px' }}>VAF: <strong>{mutNode.vaf}%</strong></span>}
            <span style={{ marginRight: '12px' }}>{totalTx} treatment options</span>
            {fdaApproved > 0 && <span style={{ color: '#166534', fontWeight: 600 }}>✓ {fdaApproved} FDA-approved</span>}
          </div>
        </div>
        <div style={{ color: '#94a3b8', fontSize: '18px' }}>{expanded ? '▲' : '▼'}</div>
      </div>

      {expanded && (
        <div style={{ padding: '16px 18px' }}>
          {Object.entries(byCategory).map(([cat, txList]) => {
            if (!txList.length) return null;
            const meta = CATEGORY_META[cat];
            return (
              <div key={cat} style={{ marginBottom: '16px' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', color: meta.text, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{meta.emoji}</span> {meta.label}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {txList.map((tx, i) => {
                    const badge = EVIDENCE_BADGE[tx.evidence] || EVIDENCE_BADGE.preclinical;
                    return (
                      <div key={i} style={{ background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: '8px', padding: '8px 12px', minWidth: '200px', maxWidth: '280px' }}>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: meta.text, marginBottom: '4px' }}>{tx.label}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '5px', lineHeight: 1.4 }}>{tx.mechanism}</div>
                        <span style={{ display: 'inline-block', padding: '1px 7px', borderRadius: '99px', fontSize: '10px', fontWeight: 700, background: badge.bg, color: badge.text }}>
                          {badge.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

const MutationDrugNetwork = () => {
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [networkData, setNetworkData] = useState(null);
  const [viewMode, setViewMode]       = useState('pathways'); // 'pathways' | 'network'
  const [selectedNode, setSelectedNode] = useState(null);
  const cyRef = useRef(null);

  useEffect(() => { fetchNetworkData(); }, []);

  const fetchNetworkData = async () => {
    setLoading(true);
    setError(null);
    try {
      let data;
      if (isElectron) {
        data = await window.electron.genomics.getMutationNetwork();
        if (data.error) throw new Error(data.error);
      } else {
        const res = await fetch('/api/genomics/mutation-drug-network', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch network data');
        data = await res.json();
      }
      setNetworkData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <div style={{ textAlign: 'center', color: '#64748b' }}>
          <style>{`@keyframes ns{to{transform:rotate(360deg)}} .ns{width:40px;height:40px;border:3px solid #dbeafe;border-top-color:#2563eb;border-radius:50%;animation:ns 0.9s linear infinite;margin:0 auto 12px}`}</style>
          <div className="ns" />
          Building pathway network…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '16px 20px' }}>
        <strong style={{ color: '#dc2626' }}>Error loading network:</strong>
        <span style={{ color: '#b91c1c', marginLeft: '8px' }}>{error}</span>
        <button onClick={fetchNetworkData} style={{ marginLeft: '16px', padding: '4px 12px', fontSize: '12px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer' }}>Retry</button>
      </div>
    );
  }

  const nodes = networkData?.nodes || [];
  const edges = networkData?.edges || [];

  // Separate nodes by type for the card view
  const mutNodes    = nodes.filter(n => n.data.type === 'mutation').map(n => n.data);
  const treatNodes  = nodes.filter(n => n.data.type === 'treatment').map(n => n.data);

  // For each mutation, find its directly-connected treatments
  const edgeMap = {};
  for (const e of edges) {
    const src = e.data.source;
    const tgt = e.data.target;
    if (!edgeMap[src]) edgeMap[src] = [];
    edgeMap[src].push(tgt);
  }

  return (
    <div>
      {/* View toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', color: '#1e293b', fontSize: '20px', fontWeight: 700 }}>
            Mutation Pathway Disruption
          </h2>
          <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>
            How your genomic mutations can be targeted by chemotherapy, immunotherapy, targeted agents, and supplements
          </p>
        </div>
        <div style={{ display: 'flex', gap: '6px', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
          {[['pathways', '📋 Pathways'], ['network', '🔬 Network']].map(([mode, label]) => (
            <button key={mode} onClick={() => setViewMode(mode)} style={{
              padding: '6px 14px', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
              background: viewMode === mode ? '#fff' : 'transparent',
              color: viewMode === mode ? '#1e293b' : '#64748b',
              cursor: 'pointer',
              boxShadow: viewMode === mode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {Object.entries(CATEGORY_META).map(([cat, meta]) => (
          <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: meta.text }}>
            <div style={{ width: '12px', height: '12px', background: meta.pill, borderRadius: '3px' }} />
            {meta.emoji} {meta.label}
          </div>
        ))}
      </div>

      {/* Pathways card view */}
      {viewMode === 'pathways' && (
        <div>
          {mutNodes.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
              No mutations in the database yet. Upload a Foundation One CDx report to populate this view.
            </div>
          ) : (
            mutNodes.map(mut => {
              const connectedTxIds = new Set(edgeMap[mut.id] || []);
              const myTreatments = treatNodes.filter(tx => connectedTxIds.has(tx.id));
              return <PathwayCard key={mut.id} mutNode={mut} treatmentNodes={myTreatments} />;
            })
          )}
        </div>
      )}

      {/* Cytoscape network view */}
      {viewMode === 'network' && (
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', height: '600px', overflow: 'hidden' }}>
            {nodes.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                No network data to display. Upload a Foundation One CDx report first.
              </div>
            ) : (
              <CytoscapeComponent
                elements={[...nodes, ...edges]}
                stylesheet={STYLESHEET}
                layout={LAYOUT}
                style={{ width: '100%', height: '100%' }}
                cy={(cy) => {
                  cyRef.current = cy;
                  cy.on('tap', 'node', (e) => setSelectedNode(e.target.data()));
                  cy.on('tap', (e) => { if (e.target === cy) setSelectedNode(null); });
                }}
              />
            )}
          </div>

          {selectedNode && (
            <div style={{ width: '280px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', flexShrink: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '16px', color: '#1e293b', marginBottom: '10px' }}>{selectedNode.label}</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>
                <strong>Type:</strong> {selectedNode.type === 'mutation' ? '🔴 Mutation' : selectedNode.categoryLabel || 'Treatment'}
              </div>
              {selectedNode.alteration && <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}><strong>Alteration:</strong> {selectedNode.alteration}</div>}
              {selectedNode.vaf != null && <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}><strong>VAF:</strong> {selectedNode.vaf}%</div>}
              {selectedNode.mechanism && <div style={{ fontSize: '12px', color: '#475569', marginTop: '8px', lineHeight: 1.5 }}>{selectedNode.mechanism}</div>}
              {selectedNode.evidence && (() => {
                const b = EVIDENCE_BADGE[selectedNode.evidence] || EVIDENCE_BADGE.preclinical;
                return <span style={{ display: 'inline-block', marginTop: '8px', padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 700, background: b.bg, color: b.text }}>{b.label}</span>;
              })()}
            </div>
          )}
        </div>
      )}

      {/* Info footer */}
      <div style={{ marginTop: '20px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '14px 18px' }}>
        <div style={{ fontWeight: 700, color: '#0369a1', marginBottom: '6px', fontSize: '13px' }}>💡 How to use this view</div>
        <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#0c4a6e', lineHeight: 1.7 }}>
          <li><strong>Click a mutation card</strong> to expand its treatment landscape</li>
          <li><strong>FDA Approved</strong> = therapies with existing evidence in your mutation context</li>
          <li><strong>Supplements</strong> = evidence-based adjuncts; always discuss with your oncologist</li>
          <li>Switch to <strong>Network view</strong> to see the full Cytoscape graph</li>
        </ul>
      </div>
    </div>
  );
};

export default MutationDrugNetwork;
