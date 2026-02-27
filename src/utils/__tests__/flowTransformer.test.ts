import { describe, it, expect, vi } from 'vitest';
import {
  transformComponents,
  transformDataFlows,
  transformBoundaries,
  transformThreatModel,
  sortNodesByRenderOrder,
} from '../flowTransformer';
import type { Component, DataFlow, Boundary, ThreatModel } from '../../types/threatModel';

describe('flowTransformer', () => {
  describe('transformComponents', () => {
    it('should transform components into React Flow nodes', () => {
      const components: Component[] = [
        {
          ref: 'comp-1',
          name: 'Web Server',
          component_type: 'internal',
          description: 'Main server',
          x: 100,
          y: 200,
        },
        {
          ref: 'comp-2',
          name: 'Database',
          component_type: 'data_store',
          x: 300,
          y: 200,
        },
      ];

      const result = transformComponents(components);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'comp-1',
        type: 'threatModelNode',
        position: { x: 100, y: 200 },
        data: {
          label: 'Web Server',
          ref: 'comp-1',
          description: 'Main server',
          componentType: 'internal',
          assets: [],
        },
      });
      expect(result[1]).toMatchObject({
        id: 'comp-2',
        type: 'threatModelNode',
        position: { x: 300, y: 200 },
        data: {
          label: 'Database',
          ref: 'comp-2',
          componentType: 'data_store',
          assets: [],
        },
      });
    });

    it('should handle components without positions', () => {
      const components: Component[] = [
        {
          ref: 'comp-1',
          name: 'Component 1',
          component_type: 'internal',
        },
        {
          ref: 'comp-2',
          name: 'Component 2',
          component_type: 'external',
        },
      ];

      const result = transformComponents(components);

      // Should use default positions with spacing
      expect(result[0].position).toEqual({ x: 100, y: 100 });
      expect(result[1].position).toEqual({ x: 250, y: 250 }); // 100 + 150 spacing
    });

    it('should include component assets', () => {
      const components: Component[] = [
        {
          ref: 'comp-1',
          name: 'Component 1',
          component_type: 'internal',
          assets: ['asset-1', 'asset-2'],
        },
      ];

      const result = transformComponents(components);

      expect(result[0].data.assets).toEqual(['asset-1', 'asset-2']);
    });

    it('should handle empty components array', () => {
      const result = transformComponents([]);
      expect(result).toEqual([]);
    });

    it('should handle undefined components', () => {
      const result = transformComponents(undefined);
      expect(result).toEqual([]);
    });

    it('should handle components with partial positions', () => {
      const components: Component[] = [
        {
          ref: 'comp-1',
          name: 'Component 1',
          component_type: 'internal',
          x: 200,
          // y is missing
        },
      ];

      const result = transformComponents(components);
      expect(result[0].position.x).toBe(200);
      expect(result[0].position.y).toBe(100); // Default y
    });

    it('should handle all component types', () => {
      const components: Component[] = [
        {
          ref: 'comp-1',
          name: 'Internal',
          component_type: 'internal',
        },
        {
          ref: 'comp-2',
          name: 'External',
          component_type: 'external',
        },
        {
          ref: 'comp-3',
          name: 'Store',
          component_type: 'data_store',
        },
      ];

      const result = transformComponents(components);
      expect(result[0].data.componentType).toBe('internal');
      expect(result[1].data.componentType).toBe('external');
      expect(result[2].data.componentType).toBe('data_store');
    });
  });

  describe('transformDataFlows', () => {
    it('should transform unidirectional data flows into edges', () => {
      const dataFlows: DataFlow[] = [
        {
          ref: 'flow-1',
          source: 'comp-1',
          destination: 'comp-2',
          direction: 'unidirectional',
          label: 'HTTP Request',
        },
      ];

      const result = transformDataFlows(dataFlows);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'flow-1',
        type: 'editableEdge',
        source: 'comp-1',
        target: 'comp-2',
        label: 'HTTP Request',
        animated: false,
        markerEnd: { type: 'arrowclosed' },
      });
      expect(result[0].markerStart).toBeUndefined();
      expect(result[0].data.direction).toBe('unidirectional');
    });

    it('should transform bidirectional data flows with arrows on both ends', () => {
      const dataFlows: DataFlow[] = [
        {
          ref: 'flow-1',
          source: 'comp-1',
          destination: 'comp-2',
          direction: 'bidirectional',
          label: 'RPC',
        },
      ];

      const result = transformDataFlows(dataFlows);

      expect(result[0]).toMatchObject({
        id: 'flow-1',
        markerStart: { type: 'arrowclosed' },
        markerEnd: { type: 'arrowclosed' },
      });
    });

    it('should handle data flows without labels', () => {
      const dataFlows: DataFlow[] = [
        {
          ref: 'flow-1',
          source: 'comp-1',
          destination: 'comp-2',
        },
      ];

      const result = transformDataFlows(dataFlows);

      expect(result[0].label).toBeUndefined();
      expect(result[0].data.label).toBeUndefined();
    });

    it('should handle source and destination points', () => {
      const dataFlows: DataFlow[] = [
        {
          ref: 'flow-1',
          source: 'comp-1',
          destination: 'comp-2',
          source_point: 'right',
          destination_point: 'left',
        },
      ];

      const result = transformDataFlows(dataFlows);

      expect(result[0].sourceHandle).toBe('right');
      expect(result[0].targetHandle).toBe('target-left');
    });

    it('should handle empty data flows array', () => {
      const result = transformDataFlows([]);
      expect(result).toEqual([]);
    });

    it('should handle undefined data flows', () => {
      const result = transformDataFlows(undefined);
      expect(result).toEqual([]);
    });

    it('should include onLabelChange callback when provided', () => {
      const onLabelChange = vi.fn();
      const dataFlows: DataFlow[] = [
        {
          ref: 'flow-1',
          source: 'comp-1',
          destination: 'comp-2',
          label: 'Test',
        },
      ];

      const result = transformDataFlows(dataFlows, onLabelChange);

      expect(result[0].data.onLabelChange).toBeDefined();
      
      // Test the callback
      result[0].data.onLabelChange('New Label');
      expect(onLabelChange).toHaveBeenCalledWith('flow-1', 'New Label');
    });

    it('should not include onLabelChange when not provided', () => {
      const dataFlows: DataFlow[] = [
        {
          ref: 'flow-1',
          source: 'comp-1',
          destination: 'comp-2',
        },
      ];

      const result = transformDataFlows(dataFlows);
      expect(result[0].data.onLabelChange).toBeUndefined();
    });

    it('should handle multiple data flows', () => {
      const dataFlows: DataFlow[] = [
        {
          ref: 'flow-1',
          source: 'comp-1',
          destination: 'comp-2',
          direction: 'unidirectional',
        },
        {
          ref: 'flow-2',
          source: 'comp-2',
          destination: 'comp-3',
          direction: 'bidirectional',
        },
        {
          ref: 'flow-3',
          source: 'comp-3',
          destination: 'comp-1',
        },
      ];

      const result = transformDataFlows(dataFlows);
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('flow-1');
      expect(result[1].id).toBe('flow-2');
      expect(result[2].id).toBe('flow-3');
    });
  });

  describe('transformBoundaries', () => {
    it('should transform boundaries with explicit dimensions', () => {
      const boundaries: Boundary[] = [
        {
          ref: 'boundary-1',
          name: 'Trust Boundary',
          description: 'External boundary',
          x: 50,
          y: 50,
          width: 500,
          height: 400,
        },
      ];

      const result = transformBoundaries(boundaries);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'boundary-1',
        type: 'boundaryNode',
        position: { x: 50, y: 50 },
        style: {
          width: 500,
          height: 400,
        },
        data: {
          label: 'Trust Boundary',
          description: 'External boundary',
        },
      });
      // No zIndex in style — ordering is controlled by DOM order via sortNodesByRenderOrder
      expect(result[0].style.zIndex).toBeUndefined();
    });

    it('should calculate boundary dimensions from contained components', () => {
      const boundaries: Boundary[] = [
        {
          ref: 'boundary-1',
          name: 'System Boundary',
          components: ['comp-1', 'comp-2'],
        },
      ];
      const components: Component[] = [
        {
          ref: 'comp-1',
          name: 'Component 1',
          component_type: 'internal',
          x: 100,
          y: 100,
        },
        {
          ref: 'comp-2',
          name: 'Component 2',
          component_type: 'internal',
          x: 300,
          y: 200,
        },
      ];

      const result = transformBoundaries(boundaries, components);

      expect(result[0].position.x).toBeLessThan(100); // Should include padding
      expect(result[0].position.y).toBeLessThan(100);
      expect(result[0].style.width).toBeGreaterThan(200); // Should encompass both components + padding
      expect(result[0].style.height).toBeGreaterThan(100);
    });

    it('should use default dimensions for boundaries without components', () => {
      const boundaries: Boundary[] = [
        {
          ref: 'boundary-1',
          name: 'Empty Boundary',
          components: [],
        },
      ];

      const result = transformBoundaries(boundaries);

      expect(result[0].position).toEqual({ x: 100, y: 100 }); // Default position
      expect(result[0].style.width).toBe(400); // Default width
      expect(result[0].style.height).toBe(300); // Default height
    });

    it('should handle empty boundaries array', () => {
      const result = transformBoundaries([]);
      expect(result).toEqual([]);
    });

    it('should handle undefined boundaries', () => {
      const result = transformBoundaries(undefined);
      expect(result).toEqual([]);
    });

    it('should not include zIndex in boundary style', () => {
      const boundaries: Boundary[] = [
        {
          ref: 'boundary-1',
          name: 'Large Boundary',
          components: ['comp-1', 'comp-2', 'comp-3'],
          x: 0,
          y: 0,
          width: 800,
          height: 600,
        },
        {
          ref: 'boundary-2',
          name: 'Small Boundary',
          components: ['comp-1'],
          x: 100,
          y: 100,
          width: 300,
          height: 200,
        },
      ];

      const result = transformBoundaries(boundaries);

      // zIndex should not be set — DOM ordering handles layering
      expect(result[0].style.zIndex).toBeUndefined();
      expect(result[1].style.zIndex).toBeUndefined();
    });

    it('should handle boundaries with components without positions', () => {
      const boundaries: Boundary[] = [
        {
          ref: 'boundary-1',
          name: 'Auto Boundary',
          components: ['comp-1', 'comp-2'],
        },
      ];
      const components: Component[] = [
        {
          ref: 'comp-1',
          name: 'Component 1',
          component_type: 'internal',
          // No x, y
        },
        {
          ref: 'comp-2',
          name: 'Component 2',
          component_type: 'internal',
          // No x, y
        },
      ];

      const result = transformBoundaries(boundaries, components);

      // Should still calculate dimensions using default positions
      expect(result[0].position).toBeDefined();
      expect(result[0].style.width).toBeGreaterThan(0);
      expect(result[0].style.height).toBeGreaterThan(0);
    });

    it('should handle boundaries referencing non-existent components', () => {
      const boundaries: Boundary[] = [
        {
          ref: 'boundary-1',
          name: 'Boundary',
          components: ['non-existent-comp'],
        },
      ];
      const components: Component[] = [];

      const result = transformBoundaries(boundaries, components);

      // Should use default dimensions when no valid components found
      expect(result[0].style.width).toBe(400);
      expect(result[0].style.height).toBe(300);
    });

    it('should handle mixed explicit and calculated dimensions', () => {
      const boundaries: Boundary[] = [
        {
          ref: 'boundary-1',
          name: 'Explicit',
          x: 50,
          y: 50,
          width: 500,
          height: 400,
        },
        {
          ref: 'boundary-2',
          name: 'Calculated',
          components: ['comp-1'],
        },
      ];
      const components: Component[] = [
        {
          ref: 'comp-1',
          name: 'Component',
          component_type: 'internal',
          x: 200,
          y: 200,
        },
      ];

      const result = transformBoundaries(boundaries, components);

      expect(result[0].position).toEqual({ x: 50, y: 50 });
      expect(result[0].style.width).toBe(500);
      
      expect(result[1].position.x).toBeLessThan(200); // Calculated with padding
      expect(result[1].style.width).toBeGreaterThan(140); // Component width + padding
    });
  });

  describe('transformThreatModel', () => {
    it('should transform complete threat model', () => {
      const threatModel: ThreatModel = {
        schema_version: '1.0',
        name: 'Test Model',
        components: [
          {
            ref: 'comp-1',
            name: 'Component 1',
            component_type: 'internal',
            x: 100,
            y: 100,
          },
        ],
        data_flows: [
          {
            ref: 'flow-1',
            source: 'comp-1',
            destination: 'comp-2',
          },
        ],
        boundaries: [
          {
            ref: 'boundary-1',
            name: 'Boundary',
            x: 50,
            y: 50,
            width: 500,
            height: 400,
          },
        ],
      };

      const result = transformThreatModel(threatModel);

      expect(result.nodes).toHaveLength(2); // 1 boundary + 1 component
      expect(result.edges).toHaveLength(1);
      
      // Boundaries should come first (rendered behind in DOM)
      expect(result.nodes[0].type).toBe('boundaryNode');
      expect(result.nodes[1].type).toBe('threatModelNode');
    });

    it('should handle minimal threat model', () => {
      const threatModel: ThreatModel = {
        schema_version: '1.0',
        name: 'Minimal Model',
        components: [],
      };

      const result = transformThreatModel(threatModel);

      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });

    it('should handle threat model without boundaries', () => {
      const threatModel: ThreatModel = {
        schema_version: '1.0',
        name: 'No Boundaries',
        components: [
          {
            ref: 'comp-1',
            name: 'Component',
            component_type: 'internal',
          },
        ],
      };

      const result = transformThreatModel(threatModel);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].type).toBe('threatModelNode');
    });

    it('should handle threat model without data flows', () => {
      const threatModel: ThreatModel = {
        schema_version: '1.0',
        name: 'No Data Flows',
        components: [
          {
            ref: 'comp-1',
            name: 'Component',
            component_type: 'internal',
          },
        ],
      };

      const result = transformThreatModel(threatModel);

      expect(result.nodes).toHaveLength(1);
      expect(result.edges).toEqual([]);
    });

    it('should pass onLabelChange callback to edges', () => {
      const onLabelChange = vi.fn();
      const threatModel: ThreatModel = {
        schema_version: '1.0',
        name: 'Test Model',
        components: [],
        data_flows: [
          {
            ref: 'flow-1',
            source: 'comp-1',
            destination: 'comp-2',
            label: 'Test',
          },
        ],
      };

      const result = transformThreatModel(threatModel, onLabelChange);

      expect(result.edges[0].data.onLabelChange).toBeDefined();
      result.edges[0].data.onLabelChange('New Label');
      expect(onLabelChange).toHaveBeenCalledWith('flow-1', 'New Label');
    });

    it('should handle complex threat model with multiple elements', () => {
      const threatModel: ThreatModel = {
        schema_version: '1.0',
        name: 'Complex Model',
        components: [
          {
            ref: 'comp-1',
            name: 'Component 1',
            component_type: 'internal',
            x: 100,
            y: 100,
          },
          {
            ref: 'comp-2',
            name: 'Component 2',
            component_type: 'external',
            x: 300,
            y: 100,
          },
          {
            ref: 'comp-3',
            name: 'Component 3',
            component_type: 'data_store',
            x: 200,
            y: 300,
          },
        ],
        data_flows: [
          {
            ref: 'flow-1',
            source: 'comp-1',
            destination: 'comp-2',
            direction: 'unidirectional',
          },
          {
            ref: 'flow-2',
            source: 'comp-2',
            destination: 'comp-3',
            direction: 'bidirectional',
          },
        ],
        boundaries: [
          {
            ref: 'boundary-1',
            name: 'Internal',
            components: ['comp-1', 'comp-3'],
          },
          {
            ref: 'boundary-2',
            name: 'External',
            components: ['comp-2'],
          },
        ],
      };

      const result = transformThreatModel(threatModel);

      expect(result.nodes).toHaveLength(5); // 2 boundaries + 3 components
      expect(result.edges).toHaveLength(2);
      
      // Verify boundaries come first
      expect(result.nodes[0].type).toBe('boundaryNode');
      expect(result.nodes[1].type).toBe('boundaryNode');
      
      // Verify all components are present
      const componentNodes = result.nodes.filter(n => n.type === 'threatModelNode');
      expect(componentNodes).toHaveLength(3);
    });

    it('should maintain node order (boundaries first, then components)', () => {
      const threatModel: ThreatModel = {
        schema_version: '1.0',
        name: 'Order Test',
        components: [
          { ref: 'comp-1', name: 'Comp 1', component_type: 'internal' },
          { ref: 'comp-2', name: 'Comp 2', component_type: 'internal' },
        ],
        boundaries: [
          { ref: 'boundary-1', name: 'Boundary 1', x: 0, y: 0, width: 300, height: 300 },
        ],
      };

      const result = transformThreatModel(threatModel);

      const types = result.nodes.map(n => n.type);
      expect(types[0]).toBe('boundaryNode');
      expect(types[1]).toBe('threatModelNode');
      expect(types[2]).toBe('threatModelNode');
    });
  });

  describe('sortNodesByRenderOrder', () => {
    it('should place bigger boundaries before smaller ones', () => {
      const nodes = [
        { id: 'small', type: 'boundaryNode', style: { width: 200, height: 100 } },
        { id: 'big', type: 'boundaryNode', style: { width: 800, height: 600 } },
        { id: 'medium', type: 'boundaryNode', style: { width: 400, height: 300 } },
      ];

      const sorted = sortNodesByRenderOrder(nodes);
      const ids = sorted.map((n: any) => n.id);

      // Biggest first (rendered behind), smallest last (rendered on top)
      expect(ids).toEqual(['big', 'medium', 'small']);
    });

    it('should place components after all boundaries', () => {
      const nodes = [
        { id: 'comp-1', type: 'threatModelNode' },
        { id: 'boundary-1', type: 'boundaryNode', style: { width: 400, height: 300 } },
        { id: 'comp-2', type: 'threatModelNode' },
      ];

      const sorted = sortNodesByRenderOrder(nodes);
      const types = sorted.map((n: any) => n.type);

      expect(types[0]).toBe('boundaryNode');
      expect(types[1]).toBe('threatModelNode');
      expect(types[2]).toBe('threatModelNode');
    });

    it('should move selected boundaries after unselected ones', () => {
      const nodes = [
        { id: 'big-selected', type: 'boundaryNode', style: { width: 800, height: 600 }, selected: true },
        { id: 'small', type: 'boundaryNode', style: { width: 200, height: 100 } },
        { id: 'medium', type: 'boundaryNode', style: { width: 400, height: 300 } },
      ];

      const sorted = sortNodesByRenderOrder(nodes);
      const ids = sorted.map((n: any) => n.id);

      // Unselected boundaries first (by area desc), then selected
      expect(ids).toEqual(['medium', 'small', 'big-selected']);
    });

    it('should maintain area-based sorting among selected boundaries', () => {
      const nodes = [
        { id: 'small-sel', type: 'boundaryNode', style: { width: 200, height: 100 }, selected: true },
        { id: 'big-sel', type: 'boundaryNode', style: { width: 800, height: 600 }, selected: true },
        { id: 'unsel', type: 'boundaryNode', style: { width: 400, height: 300 } },
      ];

      const sorted = sortNodesByRenderOrder(nodes);
      const ids = sorted.map((n: any) => n.id);

      // Unselected first, then selected by area desc
      expect(ids).toEqual(['unsel', 'big-sel', 'small-sel']);
    });

    it('should handle nodes without style dimensions', () => {
      const nodes = [
        { id: 'no-style', type: 'boundaryNode' },
        { id: 'with-style', type: 'boundaryNode', style: { width: 400, height: 300 } },
      ];

      const sorted = sortNodesByRenderOrder(nodes);
      const ids = sorted.map((n: any) => n.id);

      // Node with dimensions has bigger area, should come first
      expect(ids).toEqual(['with-style', 'no-style']);
    });

    it('should handle empty array', () => {
      expect(sortNodesByRenderOrder([])).toEqual([]);
    });

    it('should preserve component order', () => {
      const nodes = [
        { id: 'comp-1', type: 'threatModelNode' },
        { id: 'comp-2', type: 'threatModelNode' },
        { id: 'comp-3', type: 'threatModelNode' },
      ];

      const sorted = sortNodesByRenderOrder(nodes);
      const ids = sorted.map((n: any) => n.id);

      expect(ids).toEqual(['comp-1', 'comp-2', 'comp-3']);
    });

    it('should place selected boundaries after components', () => {
      const nodes = [
        { id: 'comp-1', type: 'threatModelNode' },
        { id: 'boundary-sel', type: 'boundaryNode', style: { width: 400, height: 300 }, selected: true },
        { id: 'boundary-unsel', type: 'boundaryNode', style: { width: 600, height: 400 } },
        { id: 'comp-2', type: 'threatModelNode' },
      ];

      const sorted = sortNodesByRenderOrder(nodes);
      const ids = sorted.map((n: any) => n.id);

      // Unselected boundaries → components → selected boundaries
      expect(ids).toEqual(['boundary-unsel', 'comp-1', 'comp-2', 'boundary-sel']);
    });
  });
});
