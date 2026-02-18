import React, { useState, useEffect, useRef } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';

const MutationDrugNetwork = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [elements, setElements] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const cyRef = useRef(null);

  useEffect(() => {
    fetchNetworkData();
  }, []);

  const fetchNetworkData = async () => {
    try {
      const response = await fetch('/api/genomics/mutation-drug-network', {
        credentials: 'include'
      });
      
      if (!response.ok) throw new Error('Failed to fetch network data');
      
      const data = await response.json();
      
      // Filter out isolated nodes (nodes with no edges)
      const connectedNodeIds = new Set();
      data.edges.forEach(edge => {
        connectedNodeIds.add(edge.data.source);
        connectedNodeIds.add(edge.data.target);
      });
      
      const filteredNodes = data.nodes.filter(node => connectedNodeIds.has(node.data.id));
      
      setElements([...filteredNodes, ...data.edges]);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Cytoscape stylesheet
  const stylesheet = [
    {
      selector: 'node',
      style: {
        'label': 'data(label)',
        'text-valign': 'center',
        'text-halign': 'center',
        'font-size': '14px',
        'font-weight': 'bold',
        'color': '#fff',
        'text-outline-color': '#000',
        'text-outline-width': 2,
        'width': 60,
        'height': 60
      }
    },
    {
      selector: 'node[type="mutation"]',
      style: {
        'background-color': '#e74c3c',
        'shape': 'hexagon',
        'width': 100,
        'height': 100,
        'font-weight': 'bold',
        'font-size': '18px',
        'color': '#fff',
        'text-outline-color': '#000',
        'text-outline-width': 3
      }
    },
    {
      selector: 'node[type="treatment"]',
      style: {
        'background-color': '#3498db',
        'shape': 'roundrectangle',
        'width': 140,
        'height': 70,
        'font-size': '14px',
        'font-weight': 'bold',
        'color': '#fff',
        'text-wrap': 'wrap',
        'text-max-width': 130,
        'text-outline-color': '#000',
        'text-outline-width': 2,
        'padding': 10
      }
    },
    {
      selector: 'node[treatment_type="Drug"]',
      style: {
        'background-color': '#9b59b6',
        'color': '#fff',
        'text-outline-color': '#000',
        'text-outline-width': 2
      }
    },
    {
      selector: 'node[treatment_type="Supplement"]',
      style: {
        'background-color': '#27ae60',
        'color': '#fff',
        'text-outline-color': '#000',
        'text-outline-width': 2
      }
    },
    {
      selector: 'node[priority="Critical"]',
      style: {
        'border-width': 4,
        'border-color': '#e74c3c'
      }
    },
    {
      selector: 'node[priority="High"]',
      style: {
        'border-width': 3,
        'border-color': '#f39c12'
      }
    },
    {
      selector: 'edge',
      style: {
        'width': 2,
        'line-color': '#95a5a6',
        'target-arrow-color': '#95a5a6',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'opacity': 0.6
      }
    },
    {
      selector: 'edge[impact="High"]',
      style: {
        'width': 4,
        'line-color': '#e74c3c',
        'opacity': 0.8
      }
    },
    {
      selector: 'edge[impact="Medium"]',
      style: {
        'width': 3,
        'line-color': '#f39c12',
        'opacity': 0.7
      }
    },
    {
      selector: ':selected',
      style: {
        'border-width': 4,
        'border-color': '#2ecc71',
        'z-index': 9999
      }
    }
  ];

  // Cytoscape layout configuration - using cose-bilkent for better biological network layouts
  const layout = {
    name: 'cose',
    idealEdgeLength: 150,
    nodeOverlap: 40,
    refresh: 20,
    fit: true,
    padding: 50,
    randomize: false,
    componentSpacing: 150,
    nodeRepulsion: 800000,
    edgeElasticity: 200,
    nestingFactor: 5,
    gravity: 100,
    numIter: 2000,
    initialTemp: 200,
    coolingFactor: 0.95,
    minTemp: 1.0,
    animate: false
  };

  const handleNodeTap = (event) => {
    const node = event.target;
    setSelectedNode(node.data());
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded">
        <strong>Error loading network:</strong> {error}
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Mutation-Drug Network</h2>
      <p className="text-gray-600 mb-4">
        Interactive visualization showing how your genomic mutations connect to treatments through biological pathways.
        Click on nodes to see details.
      </p>

      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}></div>
          <span className="text-sm text-gray-700">Mutations</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-purple-600 rounded"></div>
          <span className="text-sm text-gray-700">Drugs</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-600 rounded"></div>
          <span className="text-sm text-gray-700">Supplements</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-1 bg-red-500" style={{ height: '4px' }}></div>
          <span className="text-sm text-gray-700">High Impact</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-1 bg-orange-500" style={{ height: '3px' }}></div>
          <span className="text-sm text-gray-700">Medium Impact</span>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-grow bg-white border border-gray-300 rounded-lg shadow-sm" style={{ height: '600px' }}>
          <CytoscapeComponent
            elements={elements}
            stylesheet={stylesheet}
            layout={layout}
            style={{ width: '100%', height: '100%' }}
            cy={(cy) => {
              cyRef.current = cy;
              cy.on('tap', 'node', handleNodeTap);
            }}
          />
        </div>

        {selectedNode && (
          <div className="w-80 bg-white border border-gray-300 rounded-lg shadow-sm p-4">
            <h3 className="text-lg font-semibold mb-3">{selectedNode.label}</h3>
            
            {selectedNode.type === 'mutation' && (
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="font-semibold text-gray-700">Type:</span>
                  <span className="ml-2 text-gray-600">Genomic Mutation</span>
                </div>
                <div className="text-sm">
                  <span className="font-semibold text-gray-700">Alteration:</span>
                  <span className="ml-2 text-gray-600">{selectedNode.alteration}</span>
                </div>
                {selectedNode.vaf && (
                  <div className="text-sm">
                    <span className="font-semibold text-gray-700">VAF:</span>
                    <span className="ml-2 text-gray-600">{(selectedNode.vaf * 100).toFixed(1)}%</span>
                  </div>
                )}
              </div>
            )}

            {selectedNode.type === 'treatment' && (
              <div className="space-y-2">
                <div>
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                    selectedNode.treatment_type === 'Drug' 
                      ? 'bg-purple-100 text-purple-800' 
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {selectedNode.treatment_type}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="font-semibold text-gray-700">Priority:</span>
                  <span className="ml-2 text-gray-600">{selectedNode.priority || 'N/A'}</span>
                </div>
                <div className="text-sm">
                  <span className="font-semibold text-gray-700">Status:</span>
                  <span className="ml-2 text-gray-600">{selectedNode.status}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 bg-blue-50 border border-blue-300 rounded-lg p-4">
        <div className="font-semibold text-blue-900 mb-2">💡 How to read this network:</div>
        <ul className="text-sm text-blue-800 space-y-1 ml-4 list-disc">
          <li><strong>Red hexagons</strong> = Your genomic mutations (from Foundation One CDx)</li>
          <li><strong>Green/Purple boxes</strong> = Treatments (supplements/drugs) targeting those mutations</li>
          <li><strong>Arrows</strong> = Connection through biological pathways</li>
          <li><strong>Thicker red arrows</strong> = Higher impact on the pathway</li>
          <li><strong>Bold borders</strong> = Higher priority treatments (Critical/High)</li>
          <li className="text-gray-600 italic">Note: Isolated mutations (no pathway connections yet) are hidden</li>
        </ul>
      </div>
    </div>
  );
};

export default MutationDrugNetwork;
