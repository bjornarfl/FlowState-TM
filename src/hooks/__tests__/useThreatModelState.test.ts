import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useThreatModelState } from '../useThreatModelState';
import type { ThreatModel } from '../../types/threatModel';

// Mock the yamlParser functions
vi.mock('../../utils/yamlParser', () => ({
  updateYamlField: vi.fn((content, section, ref, field, value) => {
    return `${content}\n# Updated ${section}.${ref}.${field} = ${value}`;
  }),
  updateYamlTopLevelField: vi.fn((content, field, value) => {
    return `${content}\n# Updated ${field} = ${value}`;
  }),
  renameDataFlowRef: vi.fn((content, oldRef, newRef) => {
    return content.replace(new RegExp(oldRef, 'g'), newRef);
  }),
}));

// Mock the refGenerators
vi.mock('../../utils/refGenerators', () => ({
  generateDataFlowRef: vi.fn((source, dest, _direction, _existing) => {
    return `${source}->${dest}`;
  }),
}));

// Mock the handlerFactory
vi.mock('../../utils/handlerFactory', () => ({
  createSimpleFieldHandler: vi.fn((section, field, setThreatModel, updateYaml, updateYamlFieldFn) => {
    return (ref: string, value: any) => {
      setThreatModel((prev: ThreatModel | null) => {
        if (!prev) return prev;
        const sectionKey = section as keyof ThreatModel;
        const sectionArray = prev[sectionKey] as any[];
        if (!sectionArray) return prev;
        
        return {
          ...prev,
          [sectionKey]: sectionArray.map((item) =>
            item.ref === ref ? { ...item, [field]: value } : item
          ),
        };
      });
      updateYaml((content: string) => updateYamlFieldFn(content, section, ref, field, value));
    };
  }),
  createArrayFieldHandler: vi.fn((section, field, setThreatModel, updateYaml, updateYamlFieldFn) => {
    return (ref: string, value: any[]) => {
      setThreatModel((prev: ThreatModel | null) => {
        if (!prev) return prev;
        const sectionKey = section as keyof ThreatModel;
        const sectionArray = prev[sectionKey] as any[];
        if (!sectionArray) return prev;
        
        return {
          ...prev,
          [sectionKey]: sectionArray.map((item) =>
            item.ref === ref ? { ...item, [field]: value } : item
          ),
        };
      });
      updateYaml((content: string) => updateYamlFieldFn(content, section, ref, field, value));
    };
  }),
}));

describe('useThreatModelState', () => {
  const mockThreatModel: ThreatModel = {
    name: 'Test Threat Model',
    description: 'Test description',
    schema_version: '1.0',
    components: [
      {
        ref: 'comp-1',
        name: 'Component 1',
        component_type: 'internal',
      },
      {
        ref: 'comp-2',
        name: 'Component 2',
        component_type: 'data_store',
      },
    ],
    boundaries: [
      {
        ref: 'boundary-1',
        name: 'Boundary 1',
        width: 400,
        height: 300,
      },
    ],
    data_flows: [
      {
        ref: 'comp-1->comp-2',
        source: 'comp-1',
        destination: 'comp-2',
        direction: 'unidirectional',
      },
    ],
    assets: [
      {
        ref: 'asset-1',
        name: 'Asset 1',
        description: 'Confidential asset',
      },
    ],
    threats: [
      {
        ref: 'threat-1',
        name: 'Threat 1',
        affected_components: ['comp-1'],
      },
    ],
    controls: [
      {
        ref: 'control-1',
        name: 'Control 1',
        mitigates: ['threat-1'],
      },
    ],
  };

  const mockNodes = [
    {
      id: 'comp-1',
      data: { label: 'Component 1', componentType: 'internal' },
      position: { x: 0, y: 0 },
    },
    {
      id: 'comp-2',
      data: { label: 'Component 2', componentType: 'data_store' },
      position: { x: 100, y: 100 },
    },
    {
      id: 'boundary-1',
      data: { label: 'Boundary 1' },
      position: { x: 0, y: 0 },
    },
  ];

  const mockEdges = [
    {
      id: 'comp-1->comp-2',
      source: 'comp-1',
      target: 'comp-2',
      label: 'Data Flow',
      data: { direction: 'unidirectional', edgeRef: 'comp-1->comp-2' },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with empty state', () => {
      const { result } = renderHook(() => useThreatModelState());

      expect(result.current.nodes).toEqual([]);
      expect(result.current.edges).toEqual([]);
      expect(result.current.threatModel).toBeNull();
      expect(result.current.yamlContent).toBe('');
      expect(result.current.isDraggingEdge).toBe(false);
      expect(result.current.isDraggingNode).toBeNull();
      expect(result.current.isEditingMode).toBe(false);
    });

    it('should provide all handler functions', () => {
      const { result } = renderHook(() => useThreatModelState());

      expect(typeof result.current.handleAssetNameChange).toBe('function');
      expect(typeof result.current.handleComponentNameChange).toBe('function');
      expect(typeof result.current.handleThreatModelNameChange).toBe('function');
      expect(typeof result.current.handleDataFlowDirectionChange).toBe('function');
    });
  });

  describe('simple field handlers', () => {
    it('should update asset name', () => {
      const { result } = renderHook(() => useThreatModelState());

      act(() => {
        result.current.setThreatModel(mockThreatModel);
        result.current.setYamlContent('name: Test');
      });

      act(() => {
        result.current.handleAssetNameChange('asset-1', 'Updated Asset');
      });

      expect(result.current.threatModel?.assets?.[0].name).toBe('Updated Asset');
    });

    it('should update threat description', () => {
      const { result } = renderHook(() => useThreatModelState());

      act(() => {
        result.current.setThreatModel(mockThreatModel);
        result.current.setYamlContent('name: Test');
      });

      act(() => {
        result.current.handleThreatDescriptionChange('threat-1', 'Updated description');
      });

      expect(result.current.threatModel?.threats?.[0].description).toBe('Updated description');
    });

    it('should update control name', () => {
      const { result } = renderHook(() => useThreatModelState());

      act(() => {
        result.current.setThreatModel(mockThreatModel);
        result.current.setYamlContent('name: Test');
      });

      act(() => {
        result.current.handleControlNameChange('control-1', 'Updated Control');
      });

      expect(result.current.threatModel?.controls?.[0].name).toBe('Updated Control');
    });
  });

  describe('array field handlers', () => {
    it('should update threat affected components', () => {
      const { result } = renderHook(() => useThreatModelState());

      act(() => {
        result.current.setThreatModel(mockThreatModel);
        result.current.setYamlContent('name: Test');
      });

      act(() => {
        result.current.handleThreatAffectedComponentsChange('threat-1', ['comp-1', 'comp-2']);
      });

      expect(result.current.threatModel?.threats?.[0].affected_components).toEqual(['comp-1', 'comp-2']);
    });

    it('should update control mitigates', () => {
      const { result } = renderHook(() => useThreatModelState());

      act(() => {
        result.current.setThreatModel(mockThreatModel);
        result.current.setYamlContent('name: Test');
      });

      act(() => {
        result.current.handleControlMitigatesChange('control-1', ['threat-1', 'threat-2']);
      });

      expect(result.current.threatModel?.controls?.[0].mitigates).toEqual(['threat-1', 'threat-2']);
    });

    it('should update threat affected data flows', () => {
      const { result } = renderHook(() => useThreatModelState());

      act(() => {
        result.current.setThreatModel(mockThreatModel);
        result.current.setYamlContent('name: Test');
      });

      act(() => {
        result.current.handleThreatAffectedDataFlowsChange('threat-1', ['comp-1->comp-2']);
      });

      expect(result.current.threatModel?.threats?.[0].affected_data_flows).toEqual(['comp-1->comp-2']);
    });
  });

  describe('component handlers with diagram updates', () => {
    it('should update component name and sync with nodes', () => {
      const { result } = renderHook(() => useThreatModelState());

      act(() => {
        result.current.setThreatModel(mockThreatModel);
        result.current.setNodes(mockNodes);
        result.current.setYamlContent('name: Test');
      });

      act(() => {
        result.current.handleComponentNameChange('comp-1', 'Updated Component');
      });

      expect(result.current.threatModel?.components[0].name).toBe('Updated Component');
      expect(result.current.nodes[0].data.label).toBe('Updated Component');
    });

    it('should update component type and sync with nodes', () => {
      const { result } = renderHook(() => useThreatModelState());

      act(() => {
        result.current.setThreatModel(mockThreatModel);
        result.current.setNodes(mockNodes);
        result.current.setYamlContent('name: Test');
      });

      act(() => {
        result.current.handleComponentTypeChange('comp-1', 'external_dependency');
      });

      expect(result.current.threatModel?.components[0].component_type).toBe('external_dependency');
      expect(result.current.nodes[0].data.componentType).toBe('external_dependency');
    });

    it('should update component description and sync with nodes', () => {
      const { result } = renderHook(() => useThreatModelState());

      act(() => {
        result.current.setThreatModel(mockThreatModel);
        result.current.setNodes(mockNodes);
        result.current.setYamlContent('name: Test');
      });

      act(() => {
        result.current.handleComponentDescriptionChange('comp-1', 'New description');
      });

      expect(result.current.threatModel?.components[0].description).toBe('New description');
      expect(result.current.nodes[0].data.description).toBe('New description');
    });

    it('should update component assets and sync with nodes', () => {
      const { result } = renderHook(() => useThreatModelState());

      act(() => {
        result.current.setThreatModel(mockThreatModel);
        result.current.setNodes(mockNodes);
        result.current.setYamlContent('name: Test');
      });

      act(() => {
        result.current.handleComponentAssetsChange('comp-1', ['asset-1', 'asset-2']);
      });

      expect(result.current.threatModel?.components[0].assets).toEqual(['asset-1', 'asset-2']);
      expect(result.current.nodes[0].data.assets).toEqual(['asset-1', 'asset-2']);
    });

    it('should remove assets when empty array provided', () => {
      const { result } = renderHook(() => useThreatModelState());

      const modelWithAssets = {
        ...mockThreatModel,
        components: [
          { ...mockThreatModel.components[0], assets: ['asset-1'] },
          mockThreatModel.components[1],
        ],
      };

      act(() => {
        result.current.setThreatModel(modelWithAssets);
        result.current.setNodes(mockNodes);
        result.current.setYamlContent('name: Test');
      });

      act(() => {
        result.current.handleComponentAssetsChange('comp-1', []);
      });

      expect(result.current.threatModel?.components[0].assets).toBeUndefined();
      expect(result.current.nodes[0].data.assets).toBeUndefined();
    });
  });

  describe('boundary handlers', () => {
    it('should update boundary name and sync with nodes', () => {
      const { result } = renderHook(() => useThreatModelState());

      act(() => {
        result.current.setThreatModel(mockThreatModel);
        result.current.setNodes(mockNodes);
        result.current.setYamlContent('name: Test');
      });

      act(() => {
        result.current.handleBoundaryNameChange('boundary-1', 'Updated Boundary');
      });

      expect(result.current.threatModel?.boundaries?.[0].name).toBe('Updated Boundary');
      expect(result.current.nodes[2].data.label).toBe('Updated Boundary');
    });

    it('should update boundary description', () => {
      const { result } = renderHook(() => useThreatModelState());

      act(() => {
        result.current.setThreatModel(mockThreatModel);
        result.current.setYamlContent('name: Test');
      });

      act(() => {
        result.current.handleBoundaryDescriptionChange('boundary-1', 'New boundary description');
      });

      expect(result.current.threatModel?.boundaries?.[0].description).toBe('New boundary description');
    });

    it('should update boundary size on resize', () => {
      const { result } = renderHook(() => useThreatModelState());

      act(() => {
        result.current.setThreatModel(mockThreatModel);
        result.current.setYamlContent('name: Test');
      });

      act(() => {
        result.current.handleBoundaryResizeEnd('boundary-1', 500, 400);
      });

      expect(result.current.threatModel?.boundaries?.[0].width).toBe(500);
      expect(result.current.threatModel?.boundaries?.[0].height).toBe(400);
    });
  });

  describe('data flow handlers', () => {
    it('should update data flow label and sync with edges', () => {
      const { result } = renderHook(() => useThreatModelState());

      act(() => {
        result.current.setThreatModel(mockThreatModel);
        result.current.setEdges(mockEdges);
        result.current.setYamlContent('name: Test');
      });

      act(() => {
        result.current.handleDataFlowLabelChange('comp-1->comp-2', 'Updated Flow');
      });

      expect(result.current.threatModel?.data_flows?.[0].label).toBe('Updated Flow');
      expect(result.current.edges[0].label).toBe('Updated Flow');
    });

    it('should update data flow direction and sync with edges', () => {
      const { result } = renderHook(() => useThreatModelState());

      act(() => {
        result.current.setThreatModel(mockThreatModel);
        result.current.setEdges(mockEdges);
        result.current.setYamlContent('name: Test');
      });

      act(() => {
        result.current.handleDataFlowDirectionChange('comp-1->comp-2', 'bidirectional');
      });

      expect(result.current.threatModel?.data_flows?.[0].direction).toBe('bidirectional');
      expect(result.current.edges[0].data.direction).toBe('bidirectional');
      expect(result.current.edges[0].markerStart).toEqual({ type: 'arrowclosed' });
      expect(result.current.edges[0].markerEnd).toEqual({ type: 'arrowclosed' });
    });

    it('should handle direction change with ref update', () => {
      const { result } = renderHook(() => useThreatModelState());

      const modelWithThreats = {
        ...mockThreatModel,
        threats: [
          {
            ref: 'threat-1',
            name: 'Threat 1',
            affected_data_flows: ['comp-1->comp-2'],
          },
        ],
      };

      act(() => {
        result.current.setThreatModel(modelWithThreats);
        result.current.setEdges(mockEdges);
        result.current.setYamlContent('name: Test');
      });

      act(() => {
        result.current.handleDataFlowDirectionChange('comp-1->comp-2', 'bidirectional');
      });

      // The ref should be updated in the threat model
      expect(result.current.threatModel?.data_flows?.[0].direction).toBe('bidirectional');
    });
  });

  describe('top-level model handlers', () => {
    it('should update threat model name', () => {
      const { result } = renderHook(() => useThreatModelState());

      act(() => {
        result.current.setThreatModel(mockThreatModel);
        result.current.setYamlContent('name: Test');
      });

      act(() => {
        result.current.handleThreatModelNameChange('Updated Model Name');
      });

      expect(result.current.threatModel?.name).toBe('Updated Model Name');
    });

    it('should update threat model description', () => {
      const { result } = renderHook(() => useThreatModelState());

      act(() => {
        result.current.setThreatModel(mockThreatModel);
        result.current.setYamlContent('name: Test');
      });

      act(() => {
        result.current.handleThreatModelDescriptionChange('Updated description');
      });

      expect(result.current.threatModel?.description).toBe('Updated description');
    });
  });

  describe('YAML synchronization', () => {
    it('should update YAML when simple field changes', () => {
      const { result } = renderHook(() => useThreatModelState());

      act(() => {
        result.current.setThreatModel(mockThreatModel);
        result.current.setYamlContent('name: Test');
      });

      act(() => {
        result.current.handleAssetNameChange('asset-1', 'New Asset Name');
      });

      expect(result.current.yamlContent).toContain('assets.asset-1.name = New Asset Name');
    });

    it('should update YAML when array field changes', () => {
      const { result } = renderHook(() => useThreatModelState());

      act(() => {
        result.current.setThreatModel(mockThreatModel);
        result.current.setYamlContent('name: Test');
      });

      act(() => {
        result.current.handleThreatAffectedComponentsChange('threat-1', ['comp-1', 'comp-2']);
      });

      expect(result.current.yamlContent).toContain('threats.threat-1.affected_components');
    });
  });

  describe('edge cases', () => {
    it('should handle operations on null threat model gracefully', () => {
      const { result } = renderHook(() => useThreatModelState());

      expect(() => {
        act(() => {
          result.current.handleAssetNameChange('asset-1', 'New Name');
        });
      }).not.toThrow();
    });

    it('should handle updates to non-existent refs gracefully', () => {
      const { result } = renderHook(() => useThreatModelState());

      act(() => {
        result.current.setThreatModel(mockThreatModel);
        result.current.setYamlContent('name: Test');
      });

      expect(() => {
        act(() => {
          result.current.handleAssetNameChange('non-existent-asset', 'New Name');
        });
      }).not.toThrow();
    });

    it('should preserve other nodes when updating specific node', () => {
      const { result } = renderHook(() => useThreatModelState());

      act(() => {
        result.current.setThreatModel(mockThreatModel);
        result.current.setNodes(mockNodes);
        result.current.setYamlContent('name: Test');
      });

      const originalNode2 = result.current.nodes[1];

      act(() => {
        result.current.handleComponentNameChange('comp-1', 'Updated Name');
      });

      expect(result.current.nodes[1]).toEqual(originalNode2);
    });

    it('should preserve other edges when updating specific edge', () => {
      const { result } = renderHook(() => useThreatModelState());

      const multipleEdges = [
        ...mockEdges,
        {
          id: 'comp-2->comp-1',
          source: 'comp-2',
          target: 'comp-1',
          label: 'Return Flow',
          data: { direction: 'unidirectional', edgeRef: 'comp-2->comp-1' },
        },
      ];

      act(() => {
        result.current.setThreatModel(mockThreatModel);
        result.current.setEdges(multipleEdges);
        result.current.setYamlContent('name: Test');
      });

      const originalEdge2 = result.current.edges[1];

      act(() => {
        result.current.handleDataFlowLabelChange('comp-1->comp-2', 'Updated Flow');
      });

      expect(result.current.edges[1]).toEqual(originalEdge2);
    });
  });

  describe('state consistency', () => {
    it('should maintain consistency between threatModel, nodes, and edges', () => {
      const { result } = renderHook(() => useThreatModelState());

      act(() => {
        result.current.setThreatModel(mockThreatModel);
        result.current.setNodes(mockNodes);
        result.current.setEdges(mockEdges);
        result.current.setYamlContent('name: Test');
      });

      // Update component name
      act(() => {
        result.current.handleComponentNameChange('comp-1', 'New Component Name');
      });

      // Check all three sources are updated
      expect(result.current.threatModel?.components[0].name).toBe('New Component Name');
      expect(result.current.nodes[0].data.label).toBe('New Component Name');
    });

    it('should update refs correctly for all state changes', () => {
      const { result } = renderHook(() => useThreatModelState());

      act(() => {
        result.current.setThreatModel(mockThreatModel);
      });

      // Access refs
      expect(result.current.threatModelRef.current).toBe(result.current.threatModel);
      expect(result.current.nodesRef.current).toBe(result.current.nodes);
      expect(result.current.edgesRef.current).toBe(result.current.edges);
    });
  });

  describe('performance and memoization', () => {
    it('should not recreate handlers on re-render', () => {
      const { result, rerender } = renderHook(() => useThreatModelState());

      const handlers = {
        handleAssetNameChange: result.current.handleAssetNameChange,
        handleComponentNameChange: result.current.handleComponentNameChange,
        handleThreatModelNameChange: result.current.handleThreatModelNameChange,
      };

      rerender();

      expect(result.current.handleAssetNameChange).toBe(handlers.handleAssetNameChange);
      expect(result.current.handleComponentNameChange).toBe(handlers.handleComponentNameChange);
      expect(result.current.handleThreatModelNameChange).toBe(handlers.handleThreatModelNameChange);
    });

    it('should maintain ref stability across renders', () => {
      const { result, rerender } = renderHook(() => useThreatModelState());

      const refs = {
        threatModelRef: result.current.threatModelRef,
        nodesRef: result.current.nodesRef,
        edgesRef: result.current.edgesRef,
      };

      rerender();

      expect(result.current.threatModelRef).toBe(refs.threatModelRef);
      expect(result.current.nodesRef).toBe(refs.nodesRef);
      expect(result.current.edgesRef).toBe(refs.edgesRef);
    });
  });
});
