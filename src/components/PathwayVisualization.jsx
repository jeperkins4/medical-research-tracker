import { useState, useEffect, useCallback } from 'react';
// Packaged Electron app: no pathway-graph HTTP endpoint — use IPC mutation network instead.
const isElectron = typeof window !== 'undefined' && !!window.electron?.genomics?.getMutationNetwork;
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';

export default function PathwayVisualization() {
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    fetchPathwayGraph();
  }, []);

  const fetchPathwayGraph = async () => {
    if (isElectron) {
      // window.electron: use IPC mutation network (closest available in packaged app)
      try {
        const data = await window.electron.genomics.getMutationNetwork();
        setGraphData(data);
        if (data) buildGraph(data);
      } catch (error) {
        console.error('IPC getMutationNetwork failed:', error);
      } finally {
        setLoading(false);
      }
      return;
    }
    try {
      const response = await fetch('/api/genomics/pathway-graph', {
        credentials: 'include'
      });
      const data = await response.json();
      setGraphData(data);
      buildGraph(data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch pathway graph:', error);
      setLoading(false);
    }
  };

  const buildGraph = (data) => {
    const newNodes = [];
    const newEdges = [];
    let yOffset = 0;
    
    // Column 1: Mutations (left)
    data.mutations.forEach((mutation, idx) => {
      newNodes.push({
        id: `mutation-${mutation.id}`,
        type: 'default',
        data: {
          label: (
            <div className="text-center">
              <div className="font-bold text-sm">{mutation.gene}</div>
              <div className="text-xs text-gray-600">{mutation.alteration}</div>
              {mutation.variant_allele_frequency && (
                <div className="text-xs text-red-600">
                  VAF: {mutation.variant_allele_frequency}%
                </div>
              )}
            </div>
          )
        },
        position: { x: 50, y: yOffset + (idx * 150) },
        style: {
          background: '#fee2e2',
          border: '2px solid #dc2626',
          borderRadius: '8px',
          padding: '10px',
          width: 140
        }
      });
    });

    // Column 2: Pathways (middle)
    data.pathways.forEach((pathway, idx) => {
      newNodes.push({
        id: `pathway-${pathway.id}`,
        type: 'default',
        data: {
          label: (
            <div className="text-center">
              <div className="font-bold text-xs">{pathway.pathway_name}</div>
              <div className="text-xs text-gray-500 italic">{pathway.pathway_category}</div>
            </div>
          )
        },
        position: { x: 350, y: yOffset + (idx * 120) },
        style: {
          background: '#dbeafe',
          border: '2px solid #2563eb',
          borderRadius: '8px',
          padding: '12px',
          width: 180
        }
      });
    });

    // Column 3: Treatments (right)
    data.treatments.forEach((treatment, idx) => {
      newNodes.push({
        id: `treatment-${treatment.id}`,
        type: 'default',
        data: {
          label: (
            <div className="text-center">
              <div className="font-bold text-xs">{treatment.treatment_name}</div>
              <div className="text-xs text-gray-500">{treatment.treatment_type}</div>
              {treatment.dosage && (
                <div className="text-xs text-green-700">{treatment.dosage}</div>
              )}
            </div>
          )
        },
        position: { x: 650, y: yOffset + (idx * 100) },
        style: {
          background: '#d1fae5',
          border: '2px solid #059669',
          borderRadius: '8px',
          padding: '10px',
          width: 160
        }
      });
    });

    // Edges: Mutations → Pathways
    data.mutationPathways.forEach((mp) => {
      newEdges.push({
        id: `mutation-${mp.mutation_id}-pathway-${mp.pathway_id}`,
        source: `mutation-${mp.mutation_id}`,
        target: `pathway-${mp.pathway_id}`,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#dc2626', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#dc2626',
        },
      });
    });

    // Edges: Pathways → Treatments
    data.pathwayTreatments.forEach((pt) => {
      newEdges.push({
        id: `pathway-${pt.pathway_id}-treatment-${pt.treatment_id}`,
        source: `pathway-${pt.pathway_id}`,
        target: `treatment-${pt.treatment_id}`,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#2563eb', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#2563eb',
        },
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  };

  const onNodeClick = useCallback((event, node) => {
    // Extract node type and id from node.id (e.g., "mutation-1" → type="mutation", id=1)
    const [nodeType, nodeId] = node.id.split('-');
    
    let details = null;
    if (nodeType === 'mutation') {
      details = graphData.mutations.find(m => m.id === parseInt(nodeId));
    } else if (nodeType === 'pathway') {
      details = graphData.pathways.find(p => p.id === parseInt(nodeId));
    } else if (nodeType === 'treatment') {
      details = graphData.treatments.find(t => t.id === parseInt(nodeId));
    }
    
    setSelectedNode({ type: nodeType, data: details });
  }, [graphData]);

  if (loading) {
    return <div className="p-8">Loading pathway visualization...</div>;
  }

  if (!graphData) {
    return <div className="p-8">No genomic pathway data available.</div>;
  }

  return (
    <div className="h-screen flex">
      {/* Main Graph View */}
      <div className="flex-1" style={{ height: '100%' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          fitView
          attributionPosition="bottom-right"
        >
          <Controls />
          <MiniMap 
            nodeColor={(node) => {
              if (node.id.startsWith('mutation')) return '#dc2626';
              if (node.id.startsWith('pathway')) return '#2563eb';
              if (node.id.startsWith('treatment')) return '#059669';
              return '#9ca3af';
            }}
          />
          <Background variant="dots" gap={12} size={1} />
        </ReactFlow>
      </div>

      {/* Side Panel for Node Details */}
      {selectedNode && (
        <div className="w-96 bg-white border-l border-gray-300 p-6 overflow-y-auto">
          <button
            onClick={() => setSelectedNode(null)}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>

          {selectedNode.type === 'mutation' && (
            <div>
              <h3 className="text-xl font-bold mb-4 text-red-600">
                {selectedNode.data.gene} Mutation
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <strong>Alteration:</strong> {selectedNode.data.alteration}
                </div>
                {selectedNode.data.variant_allele_frequency && (
                  <div>
                    <strong>VAF:</strong> {selectedNode.data.variant_allele_frequency}%
                  </div>
                )}
                {selectedNode.data.clinical_significance && (
                  <div>
                    <strong>Clinical Significance:</strong><br/>
                    {selectedNode.data.clinical_significance}
                  </div>
                )}
                {selectedNode.data.coding_effect && (
                  <div>
                    <strong>Coding Effect:</strong> {selectedNode.data.coding_effect}
                  </div>
                )}
                {selectedNode.data.notes && (
                  <div className="mt-4 p-3 bg-gray-50 rounded">
                    <strong>Notes:</strong><br/>
                    {selectedNode.data.notes}
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedNode.type === 'pathway' && (
            <div>
              <h3 className="text-xl font-bold mb-4 text-blue-600">
                {selectedNode.data.pathway_name}
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <strong>Category:</strong><br/>
                  <span className="text-gray-600">{selectedNode.data.pathway_category}</span>
                </div>
                {selectedNode.data.description && (
                  <div>
                    <strong>Description:</strong><br/>
                    <p className="text-gray-700 mt-1">{selectedNode.data.description}</p>
                  </div>
                )}
                {selectedNode.data.clinical_relevance && (
                  <div className="mt-4 p-3 bg-blue-50 rounded">
                    <strong>Clinical Relevance:</strong><br/>
                    <p className="text-gray-700 mt-1">{selectedNode.data.clinical_relevance}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedNode.type === 'treatment' && (
            <div>
              <h3 className="text-xl font-bold mb-4 text-green-600">
                {selectedNode.data.treatment_name}
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <strong>Type:</strong> {selectedNode.data.treatment_type}
                </div>
                {selectedNode.data.dosage && (
                  <div>
                    <strong>Dosage:</strong> {selectedNode.data.dosage}
                  </div>
                )}
                {selectedNode.data.frequency && (
                  <div>
                    <strong>Frequency:</strong> {selectedNode.data.frequency}
                  </div>
                )}
                {selectedNode.data.mechanism_of_action && (
                  <div className="mt-4">
                    <strong>Mechanism of Action:</strong><br/>
                    <p className="text-gray-700 mt-1">{selectedNode.data.mechanism_of_action}</p>
                  </div>
                )}
                {selectedNode.data.supporting_evidence && (
                  <div className="mt-4 p-3 bg-green-50 rounded">
                    <strong>Evidence:</strong><br/>
                    <p className="text-gray-700 mt-1">{selectedNode.data.supporting_evidence}</p>
                  </div>
                )}
                {selectedNode.data.priority_level && (
                  <div>
                    <strong>Priority:</strong>{' '}
                    <span className={
                      selectedNode.data.priority_level === 'Critical' ? 'text-red-600 font-bold' :
                      selectedNode.data.priority_level === 'High' ? 'text-orange-600 font-semibold' :
                      'text-gray-600'
                    }>
                      {selectedNode.data.priority_level}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
