import { describe, it, expect, vi } from 'vitest';
import { addCallbacksToNodesAndEdges, type NodeEdgeCallbackHandlers } from '../nodeEdgeCallbackBuilder';
import type { ThreatModel } from '../../types/threatModel';

function createHandlers(): NodeEdgeCallbackHandlers {
  return {
    handleComponentNameChange: vi.fn(),
    handleEditModeChange: vi.fn(),
    handleComponentTypeChange: vi.fn(),
    handleComponentDescriptionChange: vi.fn(),
    handleComponentAssetsChange: vi.fn(),
    handleCreateAsset: vi.fn(),
    handleSelectNode: vi.fn(),
    handleBoundaryNameChange: vi.fn(),
    handleBoundaryResizeEnd: vi.fn(),
    handleDataFlowLabelChange: vi.fn(),
    handleDataFlowDirectionChange: vi.fn(),
    handleToggleDirectionAndReverse: vi.fn(),
  };
}

const baseModel: ThreatModel = {
  schema_version: '0.1.0',
  name: 'Test Model',
  components: [
    { ref: 'comp-1', name: 'Web App', component_type: 'internal' },
    { ref: 'comp-2', name: 'Database', component_type: 'data_store' },
  ],
  assets: [
    { ref: 'A01', name: 'User data' },
    { ref: 'A02', name: 'Credentials' },
  ],
  data_flows: [
    { ref: 'df-1', source: 'comp-1', destination: 'comp-2', label: 'Queries' },
  ],
  boundaries: [
    { ref: 'boundary-1', name: 'Internal Zone' },
  ],
};

describe('addCallbacksToNodesAndEdges', () => {
  it('attaches callbacks to threatModelNode nodes', () => {
    const handlers = createHandlers();
    const nodes = [
      { id: 'comp-1', type: 'threatModelNode', data: { label: 'Web App', ref: 'comp-1' } },
    ];
    const edges: any[] = [];

    const result = addCallbacksToNodesAndEdges(nodes, edges, baseModel, handlers);

    const node = result.nodes[0];
    expect(node.data.availableAssets).toEqual([
      { ref: 'A01', name: 'User data' },
      { ref: 'A02', name: 'Credentials' },
    ]);
    expect(node.data.onEditModeChange).toBe(handlers.handleEditModeChange);
    expect(node.data.onCreateAsset).toBe(handlers.handleCreateAsset);
    // Verify bound callbacks exist as functions
    expect(typeof node.data.onNameChange).toBe('function');
    expect(typeof node.data.onTypeChange).toBe('function');
    expect(typeof node.data.onDescriptionChange).toBe('function');
    expect(typeof node.data.onAssetsChange).toBe('function');
    expect(typeof node.data.onSelectNode).toBe('function');
  });

  it('calls handleComponentNameChange with correct nodeId when onNameChange is invoked', () => {
    const handlers = createHandlers();
    const nodes = [
      { id: 'comp-1', type: 'threatModelNode', data: { label: 'Web App' } },
    ];

    const result = addCallbacksToNodesAndEdges(nodes, [], baseModel, handlers);
    result.nodes[0].data.onNameChange('New Name');

    expect(handlers.handleComponentNameChange).toHaveBeenCalledWith('comp-1', 'New Name');
  });

  it('calls handleComponentTypeChange with correct nodeId when onTypeChange is invoked', () => {
    const handlers = createHandlers();
    const nodes = [
      { id: 'comp-1', type: 'threatModelNode', data: { label: 'Web App' } },
    ];

    const result = addCallbacksToNodesAndEdges(nodes, [], baseModel, handlers);
    result.nodes[0].data.onTypeChange('external');

    expect(handlers.handleComponentTypeChange).toHaveBeenCalledWith('comp-1', 'external');
  });

  it('calls handleComponentDescriptionChange with correct nodeId', () => {
    const handlers = createHandlers();
    const nodes = [
      { id: 'comp-1', type: 'threatModelNode', data: { label: 'Web App' } },
    ];

    const result = addCallbacksToNodesAndEdges(nodes, [], baseModel, handlers);
    result.nodes[0].data.onDescriptionChange('A web application');

    expect(handlers.handleComponentDescriptionChange).toHaveBeenCalledWith('comp-1', 'A web application');
  });

  it('calls handleComponentAssetsChange with correct nodeId', () => {
    const handlers = createHandlers();
    const nodes = [
      { id: 'comp-1', type: 'threatModelNode', data: { label: 'Web App' } },
    ];

    const result = addCallbacksToNodesAndEdges(nodes, [], baseModel, handlers);
    result.nodes[0].data.onAssetsChange(['A01', 'A02']);

    expect(handlers.handleComponentAssetsChange).toHaveBeenCalledWith('comp-1', ['A01', 'A02']);
  });

  it('calls handleSelectNode with correct nodeId when onSelectNode is invoked', () => {
    const handlers = createHandlers();
    const nodes = [
      { id: 'comp-1', type: 'threatModelNode', data: { label: 'Web App' } },
    ];

    const result = addCallbacksToNodesAndEdges(nodes, [], baseModel, handlers);
    result.nodes[0].data.onSelectNode();

    expect(handlers.handleSelectNode).toHaveBeenCalledWith('comp-1');
  });

  it('attaches callbacks to boundaryNode nodes', () => {
    const handlers = createHandlers();
    const nodes = [
      { id: 'boundary-1', type: 'boundaryNode', data: { label: 'Internal Zone' } },
    ];

    const result = addCallbacksToNodesAndEdges(nodes, [], baseModel, handlers);

    const node = result.nodes[0];
    expect(node.data.onEditModeChange).toBe(handlers.handleEditModeChange);
    expect(typeof node.data.onNameChange).toBe('function');
    expect(typeof node.data.onResizeEnd).toBe('function');
  });

  it('calls handleBoundaryNameChange with correct nodeId', () => {
    const handlers = createHandlers();
    const nodes = [
      { id: 'boundary-1', type: 'boundaryNode', data: { label: 'Zone' } },
    ];

    const result = addCallbacksToNodesAndEdges(nodes, [], baseModel, handlers);
    result.nodes[0].data.onNameChange('New Zone');

    expect(handlers.handleBoundaryNameChange).toHaveBeenCalledWith('boundary-1', 'New Zone');
  });

  it('calls handleBoundaryResizeEnd with correct nodeId and dimensions', () => {
    const handlers = createHandlers();
    const nodes = [
      { id: 'boundary-1', type: 'boundaryNode', data: { label: 'Zone' } },
    ];

    const result = addCallbacksToNodesAndEdges(nodes, [], baseModel, handlers);
    result.nodes[0].data.onResizeEnd(300, 200, 10, 20);

    expect(handlers.handleBoundaryResizeEnd).toHaveBeenCalledWith('boundary-1', 300, 200, 10, 20);
  });

  it('passes through unknown node types unchanged', () => {
    const handlers = createHandlers();
    const nodes = [
      { id: 'other-1', type: 'customNode', data: { label: 'Custom' } },
    ];

    const result = addCallbacksToNodesAndEdges(nodes, [], baseModel, handlers);

    expect(result.nodes[0]).toEqual(nodes[0]);
  });

  it('attaches callbacks to edges', () => {
    const handlers = createHandlers();
    const edges = [
      { id: 'df-1', source: 'comp-1', target: 'comp-2', data: { label: 'Queries', direction: 'unidirectional' } },
    ];

    const result = addCallbacksToNodesAndEdges([], edges, baseModel, handlers);

    const edge = result.edges[0];
    expect(edge.data.edgeRef).toBe('df-1');
    expect(edge.data.onLabelChange).toBe(handlers.handleDataFlowLabelChange);
    expect(edge.data.onDirectionChange).toBe(handlers.handleDataFlowDirectionChange);
    expect(edge.data.onToggleDirectionAndReverse).toBe(handlers.handleToggleDirectionAndReverse);
    expect(edge.data.onEditModeChange).toBe(handlers.handleEditModeChange);
  });

  it('preserves existing edge data fields', () => {
    const handlers = createHandlers();
    const edges = [
      { id: 'df-1', source: 'comp-1', target: 'comp-2', data: { label: 'Queries', direction: 'bidirectional', extra: 'field' } },
    ];

    const result = addCallbacksToNodesAndEdges([], edges, baseModel, handlers);

    expect(result.edges[0].data.label).toBe('Queries');
    expect(result.edges[0].data.direction).toBe('bidirectional');
    expect(result.edges[0].data.extra).toBe('field');
  });

  it('preserves existing node data fields', () => {
    const handlers = createHandlers();
    const nodes = [
      { id: 'comp-1', type: 'threatModelNode', data: { label: 'Web App', ref: 'comp-1', description: 'A web app', componentType: 'internal' } },
    ];

    const result = addCallbacksToNodesAndEdges(nodes, [], baseModel, handlers);

    expect(result.nodes[0].data.label).toBe('Web App');
    expect(result.nodes[0].data.ref).toBe('comp-1');
    expect(result.nodes[0].data.description).toBe('A web app');
    expect(result.nodes[0].data.componentType).toBe('internal');
  });

  it('handles model with no assets', () => {
    const handlers = createHandlers();
    const modelNoAssets: ThreatModel = { ...baseModel, assets: undefined };
    const nodes = [
      { id: 'comp-1', type: 'threatModelNode', data: { label: 'Web App' } },
    ];

    const result = addCallbacksToNodesAndEdges(nodes, [], modelNoAssets, handlers);

    expect(result.nodes[0].data.availableAssets).toEqual([]);
  });

  it('handles mixed node types correctly', () => {
    const handlers = createHandlers();
    const nodes = [
      { id: 'boundary-1', type: 'boundaryNode', data: { label: 'Zone' } },
      { id: 'comp-1', type: 'threatModelNode', data: { label: 'Web App' } },
      { id: 'other-1', type: 'customNode', data: { label: 'Custom' } },
    ];

    const result = addCallbacksToNodesAndEdges(nodes, [], baseModel, handlers);

    // Boundary node has boundary callbacks
    expect(typeof result.nodes[0].data.onResizeEnd).toBe('function');
    expect(result.nodes[0].data.availableAssets).toBeUndefined();

    // Threat model node has component callbacks
    expect(typeof result.nodes[1].data.onAssetsChange).toBe('function');
    expect(result.nodes[1].data.availableAssets).toHaveLength(2);

    // Unknown node is unchanged
    expect(result.nodes[2].data.onResizeEnd).toBeUndefined();
    expect(result.nodes[2].data.onNameChange).toBeUndefined();
  });

  it('handles empty arrays', () => {
    const handlers = createHandlers();
    const result = addCallbacksToNodesAndEdges([], [], baseModel, handlers);

    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });
});
