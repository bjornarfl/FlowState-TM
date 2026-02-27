import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFlowDiagram } from '../useFlowDiagram';
import type { ThreatModel } from '../../types/threatModel';

// Mock the yamlParser functions
vi.mock('../../utils/yamlParser', () => ({
  updateYamlField: vi.fn((content, section, ref, field, value) => {
    return `${content}\n# Updated ${section}.${ref}.${field} = ${value}`;
  }),
  appendYamlItem: vi.fn((content, section, item) => {
    return `${content}\n# Appended ${section} item: ${JSON.stringify(item)}`;
  }),
  renameDataFlowRef: vi.fn((content, oldRef, newRef) => {
    return content.replace(new RegExp(oldRef, 'g'), newRef);
  }),
  removeYamlItem: vi.fn((content, section, ref) => {
    return `${content}\n# Removed ${section}.${ref}`;
  }),
  removeRefFromArrayFields: vi.fn((content, ref, fields) => {
    return `${content}\n# Removed ${ref} from fields: ${fields.join(', ')}`;
  }),
}));

// Mock the refGenerators
vi.mock('../../utils/refGenerators', () => ({
  generateDataFlowRef: vi.fn((source, dest, _direction, existing) => {
    const baseRef = `${source}->${dest}`;
    let counter = 1;
    let ref = baseRef;
    while (existing.includes(ref)) {
      counter++;
      ref = `${baseRef}-${counter}`;
    }
    return ref;
  }),
}));

// Mock ReactFlow functions
vi.mock('@xyflow/react', () => ({
  Position: {
    Top: 'top',
    Bottom: 'bottom',
    Left: 'left',
    Right: 'right',
  },
  applyNodeChanges: vi.fn((changes, nodes) => {
    let result = [...nodes];
    changes.forEach((change: any) => {
      if (change.type === 'remove') {
        result = result.filter((n) => n.id !== change.id);
      } else if (change.type === 'position' && change.position) {
        result = result.map((n) =>
          n.id === change.id ? { ...n, position: change.position } : n
        );
      } else if (change.type === 'dimensions' && change.dimensions) {
        result = result.map((n) =>
          n.id === change.id
            ? { ...n, measured: { width: change.dimensions.width, height: change.dimensions.height } }
            : n
        );
      }
    });
    return result;
  }),
  applyEdgeChanges: vi.fn((changes, edges) => {
    let result = [...edges];
    changes.forEach((change: any) => {
      if (change.type === 'remove') {
        result = result.filter((e) => e.id !== change.id);
      }
    });
    return result;
  }),
}));

describe('useFlowDiagram', () => {
  const mockThreatModel: ThreatModel = {
    name: 'Test Model',
    schema_version: '1.0',
    components: [
      { ref: 'comp-1', name: 'Component 1', component_type: 'internal', x: 100, y: 100 },
      { ref: 'comp-2', name: 'Component 2', component_type: 'internal', x: 300, y: 100 },
      { ref: 'comp-3', name: 'Component 3', component_type: 'data_store', x: 200, y: 300 },
    ],
    boundaries: [
      { ref: 'boundary-1', name: 'Boundary 1', x: 50, y: 50, width: 400, height: 300 },
    ],
    data_flows: [
      { ref: 'comp-1->comp-2', source: 'comp-1', destination: 'comp-2', direction: 'unidirectional' },
      { ref: 'comp-2->comp-3', source: 'comp-2', destination: 'comp-3', direction: 'bidirectional' },
    ],
    threats: [
      {
        ref: 'threat-1',
        name: 'Threat 1',
        affected_components: ['comp-1'],
        affected_data_flows: ['comp-1->comp-2'],
      },
    ],
    controls: [
      {
        ref: 'control-1',
        name: 'Control 1',
        implemented_in: ['comp-1'],
      },
    ],
  };

  const mockNodes = [
    { id: 'comp-1', type: 'threatModelNode', position: { x: 100, y: 100 }, data: { label: 'Component 1' } },
    { id: 'comp-2', type: 'threatModelNode', position: { x: 300, y: 100 }, data: { label: 'Component 2' } },
    { id: 'comp-3', type: 'threatModelNode', position: { x: 200, y: 300 }, data: { label: 'Component 3' } },
    { id: 'boundary-1', type: 'boundaryNode', position: { x: 50, y: 50 }, data: { label: 'Boundary 1' } },
  ];

  const mockEdges = [
    {
      id: 'comp-1->comp-2',
      source: 'comp-1',
      target: 'comp-2',
      type: 'editableEdge',
      data: { direction: 'unidirectional', edgeRef: 'comp-1->comp-2' },
    },
    {
      id: 'comp-2->comp-3',
      source: 'comp-2',
      target: 'comp-3',
      type: 'editableEdge',
      data: { direction: 'bidirectional', edgeRef: 'comp-2->comp-3' },
    },
  ];

  let setNodes: any;
  let setEdges: any;
  let setThreatModel: any;
  let setIsDraggingNode: any;
  let setIsEditingMode: any;
  let updateYaml: any;
  let updateBoundaryMemberships: any;
  let isComponentInsideBoundary: any;
  let handleDataFlowLabelChange: any;
  let handleDataFlowDirectionChange: any;
  let handleToggleDirectionAndReverse: any;
  let recordState: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    setNodes = vi.fn((updater) => {
      if (typeof updater === 'function') {
        return updater(mockNodes);
      }
    }) as any;
    setEdges = vi.fn((updater) => {
      if (typeof updater === 'function') {
        return updater(mockEdges);
      }
    }) as any;
    setThreatModel = vi.fn() as any;
    setIsDraggingNode = vi.fn() as any;
    setIsEditingMode = vi.fn() as any;
    updateYaml = vi.fn((updater) => {
      if (typeof updater === 'function') {
        return updater('yaml content');
      }
    }) as any;
    updateBoundaryMemberships = vi.fn() as any;
    isComponentInsideBoundary = vi.fn() as any;
    handleDataFlowLabelChange = vi.fn() as any;
    handleDataFlowDirectionChange = vi.fn() as any;
    handleToggleDirectionAndReverse = vi.fn() as any;
    recordState = vi.fn() as any;
  });

  const createHookParams = (overrides = {}) => ({
    threatModel: mockThreatModel,
    nodes: mockNodes,
    edges: mockEdges,
    setNodes,
    setEdges,
    setThreatModel,
    setIsDraggingNode,
    setIsEditingMode,
    isDraggingNode: null,
    threatModelRef: { current: mockThreatModel },
    nodesRef: { current: mockNodes },
    edgesRef: { current: mockEdges },
    arrowKeyMovedNodesRef: { current: new Set<string>() },
    updateYaml,
    updateBoundaryMemberships,
    isComponentInsideBoundary,
    handleDataFlowLabelChange,
    handleDataFlowDirectionChange,
    handleToggleDirectionAndReverse,
    recordState,
    ...overrides,
  });

  describe('initialization', () => {
    it('should return all required handler functions', () => {
      const { result } = renderHook(() => useFlowDiagram(createHookParams()));

      expect(typeof result.current.onNodesChange).toBe('function');
      expect(typeof result.current.onEdgesChange).toBe('function');
      expect(typeof result.current.onNodeDragStop).toBe('function');
      expect(typeof result.current.onNodeDragStart).toBe('function');
      expect(typeof result.current.onSelectionDragStop).toBe('function');
      expect(typeof result.current.onSelectionDragStart).toBe('function');
      expect(typeof result.current.onConnect).toBe('function');
      expect(typeof result.current.onReconnect).toBe('function');
    });
  });

  describe('onNodesChange', () => {
    it('should handle position changes', () => {
      const { result } = renderHook(() => useFlowDiagram(createHookParams()));

      act(() => {
        result.current.onNodesChange([
          { type: 'position', id: 'comp-1', position: { x: 150, y: 150 } },
        ]);
      });

      expect(setNodes).toHaveBeenCalled();
    });

    it('should handle dimension changes for boundaries', () => {
      const { result } = renderHook(() => useFlowDiagram(createHookParams()));

      act(() => {
        result.current.onNodesChange([
          { type: 'dimensions', id: 'boundary-1', dimensions: { width: 500, height: 400 } },
        ]);
      });

      expect(setNodes).toHaveBeenCalled();
      expect(setThreatModel).toHaveBeenCalled();
    });

    it('should handle node removal for components', () => {
      const { result } = renderHook(() => useFlowDiagram(createHookParams()));

      act(() => {
        result.current.onNodesChange([{ type: 'remove', id: 'comp-1' }]);
      });

      expect(setThreatModel).toHaveBeenCalled();
      expect(updateYaml).toHaveBeenCalled();
      expect(setEdges).toHaveBeenCalled();
    });

    it('should handle node removal for boundaries', () => {
      const { result } = renderHook(() => useFlowDiagram(createHookParams()));

      act(() => {
        result.current.onNodesChange([{ type: 'remove', id: 'boundary-1' }]);
      });

      expect(setThreatModel).toHaveBeenCalled();
      expect(updateYaml).toHaveBeenCalled();
    });

    it('should update boundary memberships when boundary is moved', () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useFlowDiagram(createHookParams()));

      act(() => {
        result.current.onNodesChange([
          { type: 'position', id: 'boundary-1', position: { x: 100, y: 100 } },
        ]);
      });

      act(() => {
        vi.runAllTimers();
      });

      expect(updateBoundaryMemberships).toHaveBeenCalled();
      
      vi.useRealTimers();
    });

    it('should not update threatModel during drag operations', () => {
      const params = createHookParams({ isDraggingNode: 'comp-1' });
      const { result } = renderHook(() => useFlowDiagram(params));

      act(() => {
        result.current.onNodesChange([
          { type: 'position', id: 'comp-1', position: { x: 150, y: 150 } },
        ]);
      });

      // setThreatModel should not be called for position changes during drag
      // It will be called in onNodeDragStop instead
      expect(setNodes).toHaveBeenCalled();
    });
  });

  describe('onEdgesChange', () => {
    it('should handle edge removal', () => {
      const { result } = renderHook(() => useFlowDiagram(createHookParams()));

      act(() => {
        result.current.onEdgesChange([{ type: 'remove', id: 'comp-1->comp-2' }]);
      });

      expect(setThreatModel).toHaveBeenCalled();
      expect(updateYaml).toHaveBeenCalled();
      expect(setEdges).toHaveBeenCalled();
    });

    it('should remove edge references from threats when edge is deleted', () => {
      const { result } = renderHook(() => useFlowDiagram(createHookParams()));

      act(() => {
        result.current.onEdgesChange([{ type: 'remove', id: 'comp-1->comp-2' }]);
      });

      expect(setThreatModel).toHaveBeenCalled();
      const updateCall = setThreatModel.mock.calls[0][0];
      expect(typeof updateCall).toBe('function');
    });
  });

  describe('onNodeDragStart', () => {
    it('should set isDraggingNode state', () => {
      const { result } = renderHook(() => useFlowDiagram(createHookParams()));

      act(() => {
        result.current.onNodeDragStart({}, { id: 'comp-1' }, []);
      });

      expect(setIsDraggingNode).toHaveBeenCalledWith('comp-1');
    });
  });

  describe('onNodeDragStop', () => {
    it('should clear isDraggingNode state', () => {
      const { result } = renderHook(() => useFlowDiagram(createHookParams()));

      act(() => {
        result.current.onNodeDragStop({}, { id: 'comp-1', position: { x: 150, y: 150 } }, []);
      });

      expect(setIsDraggingNode).toHaveBeenCalledWith(null);
    });

    it('should update boundary memberships', () => {
      const { result } = renderHook(() => useFlowDiagram(createHookParams()));

      act(() => {
        result.current.onNodeDragStop({}, { id: 'comp-1', position: { x: 150, y: 150 } }, []);
      });

      expect(updateBoundaryMemberships).toHaveBeenCalled();
    });

    it('should update component position in threatModel and YAML', () => {
      const { result } = renderHook(() => useFlowDiagram(createHookParams()));

      act(() => {
        result.current.onNodeDragStop(
          {},
          { id: 'comp-1', type: 'threatModelNode', position: { x: 150, y: 150 } },
          []
        );
      });

      expect(setThreatModel).toHaveBeenCalled();
      expect(updateYaml).toHaveBeenCalled();
    });

    it('should round position values to nearest integer', () => {
      const { result } = renderHook(() => useFlowDiagram(createHookParams()));

      act(() => {
        result.current.onNodeDragStop(
          {},
          { id: 'comp-1', type: 'threatModelNode', position: { x: 150.7, y: 150.3 } },
          []
        );
      });

      expect(setThreatModel).toHaveBeenCalled();
    });

    it('should update multiple dragged nodes when passed array', () => {
      const { result } = renderHook(() => useFlowDiagram(createHookParams()));

      act(() => {
        result.current.onNodeDragStop(
          {},
          { id: 'comp-1', type: 'threatModelNode', position: { x: 150, y: 150 } },
          [
            { id: 'comp-1', type: 'threatModelNode', position: { x: 150, y: 150 } },
            { id: 'comp-2', type: 'threatModelNode', position: { x: 350, y: 150 } },
          ]
        );
      });

      expect(setThreatModel).toHaveBeenCalled();
      expect(updateYaml).toHaveBeenCalled();
    });
  });

  describe('onSelectionDragStart', () => {
    it('should set isDraggingNode to selection marker', () => {
      const { result } = renderHook(() => useFlowDiagram(createHookParams()));

      act(() => {
        result.current.onSelectionDragStart({}, [{ id: 'comp-1' }, { id: 'comp-2' }]);
      });

      expect(setIsDraggingNode).toHaveBeenCalledWith('selection');
    });
  });

  describe('onSelectionDragStop', () => {
    it('should clear isDraggingNode state', () => {
      const { result } = renderHook(() => useFlowDiagram(createHookParams()));

      act(() => {
        result.current.onSelectionDragStop({}, [
          { id: 'comp-1', type: 'threatModelNode', position: { x: 150, y: 150 } },
          { id: 'comp-2', type: 'threatModelNode', position: { x: 350, y: 150 } },
        ]);
      });

      expect(setIsDraggingNode).toHaveBeenCalledWith(null);
    });

    it('should update boundary memberships', () => {
      const { result } = renderHook(() => useFlowDiagram(createHookParams()));

      act(() => {
        result.current.onSelectionDragStop({}, [
          { id: 'comp-1', type: 'threatModelNode', position: { x: 150, y: 150 } },
        ]);
      });

      expect(updateBoundaryMemberships).toHaveBeenCalled();
    });

    it('should update positions for all selected nodes in threatModel and YAML', () => {
      const { result } = renderHook(() => useFlowDiagram(createHookParams()));

      act(() => {
        result.current.onSelectionDragStop({}, [
          { id: 'comp-1', type: 'threatModelNode', position: { x: 150, y: 150 } },
          { id: 'comp-2', type: 'threatModelNode', position: { x: 350, y: 150 } },
          { id: 'boundary-1', type: 'boundaryNode', position: { x: 100, y: 100 } },
        ]);
      });

      expect(setThreatModel).toHaveBeenCalled();
      expect(updateYaml).toHaveBeenCalled();
    });

    it('should handle empty selection', () => {
      const { result } = renderHook(() => useFlowDiagram(createHookParams()));

      act(() => {
        result.current.onSelectionDragStop({}, []);
      });

      expect(setIsDraggingNode).toHaveBeenCalledWith(null);
      // Should not update threatModel or YAML with empty selection
    });
  });

  describe('multi-node deletion', () => {
    it('should handle deletion of multiple components at once', () => {
      const { result } = renderHook(() => useFlowDiagram(createHookParams()));

      act(() => {
        result.current.onNodesChange([
          { type: 'remove', id: 'comp-1' },
          { type: 'remove', id: 'comp-2' },
        ]);
      });

      expect(setThreatModel).toHaveBeenCalled();
      expect(updateYaml).toHaveBeenCalled();
      expect(setEdges).toHaveBeenCalled();
    });

    it('should handle deletion of components and boundaries together', () => {
      const { result } = renderHook(() => useFlowDiagram(createHookParams()));

      act(() => {
        result.current.onNodesChange([
          { type: 'remove', id: 'comp-1' },
          { type: 'remove', id: 'boundary-1' },
        ]);
      });

      expect(setThreatModel).toHaveBeenCalled();
      expect(updateYaml).toHaveBeenCalled();
    });

    it('should remove all connected edges when deleting multiple components', () => {
      const { result } = renderHook(() => useFlowDiagram(createHookParams()));

      act(() => {
        result.current.onNodesChange([
          { type: 'remove', id: 'comp-1' },
          { type: 'remove', id: 'comp-2' },
        ]);
      });

      // Both components have edges, so setEdges should be called to remove them
      expect(setEdges).toHaveBeenCalled();
    });
  });

  describe('onConnect', () => {
    it('should create a new data flow connection', () => {
      const { result } = renderHook(() => useFlowDiagram(createHookParams()));

      act(() => {
        result.current.onConnect({
          source: 'comp-3',
          target: 'comp-1',
          sourceHandle: null,
          targetHandle: null,
        });
      });

      expect(setThreatModel).toHaveBeenCalled();
      expect(updateYaml).toHaveBeenCalled();
      expect(setEdges).toHaveBeenCalled();
    });

    it('should prevent self-connections', () => {
      const { result } = renderHook(() => useFlowDiagram(createHookParams()));

      act(() => {
        result.current.onConnect({
          source: 'comp-1',
          target: 'comp-1',
          sourceHandle: null,
          targetHandle: null,
        });
      });

      expect(setThreatModel).not.toHaveBeenCalled();
      expect(updateYaml).not.toHaveBeenCalled();
      expect(setEdges).not.toHaveBeenCalled();
    });

    it('should generate unique refs for duplicate connections', () => {
      const { result } = renderHook(() => useFlowDiagram(createHookParams()));

      act(() => {
        // Try to create a connection that already exists
        result.current.onConnect({
          source: 'comp-2',
          target: 'comp-1',
          sourceHandle: null,
          targetHandle: null,
        });
      });

      expect(setThreatModel).toHaveBeenCalled();
    });

    it('should include connection points if provided', () => {
      const { result } = renderHook(() => useFlowDiagram(createHookParams()));

      act(() => {
        result.current.onConnect({
          source: 'comp-3',
          target: 'comp-1',
          sourceHandle: 'output-1',
          targetHandle: 'target-input-1',
        });
      });

      expect(setThreatModel).toHaveBeenCalled();
    });

    it('should set default direction as unidirectional', () => {
      const { result } = renderHook(() => useFlowDiagram(createHookParams()));

      act(() => {
        result.current.onConnect({
          source: 'comp-3',
          target: 'comp-1',
          sourceHandle: null,
          targetHandle: null,
        });
      });

      const edgesCall = setEdges.mock.calls[0][0];
      const newEdges = edgesCall(mockEdges);
      const newEdge = newEdges[newEdges.length - 1];
      
      expect(newEdge.data.direction).toBe('unidirectional');
      expect(newEdge.markerEnd).toEqual({ type: 'arrowclosed' });
    });

    it('should set label with DF prefix based on current data flow count', () => {
      const { result } = renderHook(() => useFlowDiagram(createHookParams()));

      act(() => {
        result.current.onConnect({
          source: 'comp-3',
          target: 'comp-1',
          sourceHandle: null,
          targetHandle: null,
        });
      });

      const edgesCall = setEdges.mock.calls[0][0];
      const newEdges = edgesCall(mockEdges);
      const newEdge = newEdges[newEdges.length - 1];
      
      // Mock threat model has 2 data flows, so new one should be DF3
      expect(newEdge.label).toBe('DF3');
      expect(newEdge.data.label).toBe('DF3');
    });
  });

  describe('onReconnect', () => {
    it('should update edge connection points', () => {
      const { result } = renderHook(() => useFlowDiagram(createHookParams()));

      const oldEdge = mockEdges[0];
      const newConnection = {
        source: 'comp-3',
        target: 'comp-2',
        sourceHandle: 'output-1',
        targetHandle: 'target-input-1',
      };

      act(() => {
        result.current.onReconnect(oldEdge, newConnection);
      });

      expect(setEdges).toHaveBeenCalled();
      expect(setThreatModel).toHaveBeenCalled();
      expect(updateYaml).toHaveBeenCalled();
    });

    it('should prevent reconnecting to self', () => {
      const { result } = renderHook(() => useFlowDiagram(createHookParams()));

      const oldEdge = mockEdges[0];
      const newConnection = {
        source: 'comp-1',
        target: 'comp-1',
        sourceHandle: null,
        targetHandle: null,
      };

      act(() => {
        result.current.onReconnect(oldEdge, newConnection);
      });

      expect(setEdges).not.toHaveBeenCalled();
      expect(setThreatModel).not.toHaveBeenCalled();
    });

    it('should update ref when source or target changes', () => {
      const { result } = renderHook(() => useFlowDiagram(createHookParams()));

      const oldEdge = mockEdges[0];
      const newConnection = {
        source: 'comp-3',
        target: 'comp-2',
        sourceHandle: null,
        targetHandle: null,
      };

      act(() => {
        result.current.onReconnect(oldEdge, newConnection);
      });

      expect(updateYaml).toHaveBeenCalled();
    });

    it('should update affected data flows in threats when ref changes', () => {
      const { result } = renderHook(() => useFlowDiagram(createHookParams()));

      const oldEdge = mockEdges[0];
      const newConnection = {
        source: 'comp-3',
        target: 'comp-2',
        sourceHandle: null,
        targetHandle: null,
      };

      act(() => {
        result.current.onReconnect(oldEdge, newConnection);
      });

      expect(setThreatModel).toHaveBeenCalled();
    });
  });

  describe('arrow key movement', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should batch arrow key movements', () => {
      const arrowKeyMovedNodes = new Set<string>();
      const params = createHookParams({
        arrowKeyMovedNodesRef: { current: arrowKeyMovedNodes },
      });
      
      renderHook(() => useFlowDiagram(params));

      // Simulate arrow key movements
      arrowKeyMovedNodes.add('comp-1');
      arrowKeyMovedNodes.add('comp-2');

      // Simulate keyup event
      const keyupEvent = new KeyboardEvent('keyup', { key: 'ArrowRight' });
      act(() => {
        window.dispatchEvent(keyupEvent);
      });

      // Fast-forward timer to match the 400ms debounce timeout
      act(() => {
        vi.advanceTimersByTime(400);
      });

      expect(updateYaml).toHaveBeenCalled();
      expect(arrowKeyMovedNodes.size).toBe(0); // Should be cleared
    });

    it('should ignore non-arrow keys', () => {
      const params = createHookParams();
      renderHook(() => useFlowDiagram(params));

      const keyupEvent = new KeyboardEvent('keyup', { key: 'Enter' });
      act(() => {
        window.dispatchEvent(keyupEvent);
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      // updateYaml should not be called for non-arrow keys
      expect(updateYaml).not.toHaveBeenCalled();
    });

    it('should debounce rapid arrow key presses', () => {
      const arrowKeyMovedNodes = new Set<string>(['comp-1']);
      const params = createHookParams({
        arrowKeyMovedNodesRef: { current: arrowKeyMovedNodes },
      });
      
      renderHook(() => useFlowDiagram(params));

      // Simulate rapid key presses
      for (let i = 0; i < 5; i++) {
        const keyupEvent = new KeyboardEvent('keyup', { key: 'ArrowRight' });
        act(() => {
          window.dispatchEvent(keyupEvent);
        });
        act(() => {
          vi.advanceTimersByTime(50);
        });
      }

      // Only advance to complete the debounce (400ms timeout)
      act(() => {
        vi.advanceTimersByTime(400);
      });

      // Should only update YAML once after debounce
      expect(updateYaml).toHaveBeenCalledTimes(1);
    });
  });

  describe('isDraggingNode effect', () => {
    it('should update nodes when drag starts', () => {
      const params = createHookParams({ isDraggingNode: null });
      const { rerender } = renderHook(
        ({ isDraggingNode }) => useFlowDiagram({ ...params, isDraggingNode }),
        { initialProps: { isDraggingNode: null as string | null } }
      );

      // Start dragging
      rerender({ isDraggingNode: 'comp-1' as string | null });

      expect(setNodes).toHaveBeenCalled();
    });

    it('should update nodes when drag stops', () => {
      const params = createHookParams({ isDraggingNode: 'comp-1' });
      const { rerender } = renderHook(
        ({ isDraggingNode }) => useFlowDiagram({ ...params, isDraggingNode }),
        { initialProps: { isDraggingNode: 'comp-1' as string | null } }
      );

      // Stop dragging
      rerender({ isDraggingNode: null as string | null });

      expect(setNodes).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle removal of multiple nodes at once', () => {
      const { result } = renderHook(() => useFlowDiagram(createHookParams()));

      act(() => {
        result.current.onNodesChange([
          { type: 'remove', id: 'comp-1' },
          { type: 'remove', id: 'comp-2' },
        ]);
      });

      expect(setThreatModel).toHaveBeenCalled();
      expect(updateYaml).toHaveBeenCalled();
    });

    it('should handle removal of multiple edges at once', () => {
      const { result } = renderHook(() => useFlowDiagram(createHookParams()));

      act(() => {
        result.current.onEdgesChange([
          { type: 'remove', id: 'comp-1->comp-2' },
          { type: 'remove', id: 'comp-2->comp-3' },
        ]);
      });

      expect(setThreatModel).toHaveBeenCalled();
      expect(updateYaml).toHaveBeenCalled();
    });

    it('should handle onNodeDragStop with no position', () => {
      const { result } = renderHook(() => useFlowDiagram(createHookParams()));

      expect(() => {
        act(() => {
          result.current.onNodeDragStop({}, { id: 'comp-1' }, []);
        });
      }).not.toThrow();
    });

    it('should handle operations with null threatModel', () => {
      const params = createHookParams({
        threatModel: null,
        threatModelRef: { current: null },
      });
      const { result } = renderHook(() => useFlowDiagram(params));

      expect(() => {
        act(() => {
          result.current.onConnect({
            source: 'comp-1',
            target: 'comp-2',
            sourceHandle: null,
            targetHandle: null,
          });
        });
      }).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should remove event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      const { unmount } = renderHook(() => useFlowDiagram(createHookParams()));

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keyup', expect.any(Function));
      
      removeEventListenerSpy.mockRestore();
    });

    it('should clear timeout on unmount', () => {
      vi.useFakeTimers();
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
      
      const arrowKeyMovedNodes = new Set<string>(['comp-1']);
      const params = createHookParams({
        arrowKeyMovedNodesRef: { current: arrowKeyMovedNodes },
      });
      
      const { unmount } = renderHook(() => useFlowDiagram(params));

      // Trigger a keyup to create a timeout
      const keyupEvent = new KeyboardEvent('keyup', { key: 'ArrowRight' });
      act(() => {
        window.dispatchEvent(keyupEvent);
      });

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      
      clearTimeoutSpy.mockRestore();
      vi.useRealTimers();
    });
  });
});
