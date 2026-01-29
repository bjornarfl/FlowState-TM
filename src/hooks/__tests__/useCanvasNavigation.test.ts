/**
 * Tests for useCanvasNavigation hook
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCanvasNavigation } from '../useCanvasNavigation';

describe('useCanvasNavigation', () => {
  // Helper to wait for requestAnimationFrame callbacks
  const waitForAnimationFrames = async () => {
    await act(async () => {
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      });
    });
  };
  
  // Mock ReactFlow instance
  const createMockReactFlowInstance = () => ({
    getViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
    setCenter: vi.fn(),
  });
  
  const createNode = (id: string, x: number, y: number, selected = false, type = 'threatModelNode') => ({
    id,
    type,
    position: { x, y },
    width: 100,
    height: 80,
    selected,
    data: {},
  });

  const createEdge = (id: string, source: string, target: string, selected = false) => ({
    id,
    source,
    target,
    selected,
    sourceHandle: undefined,
    targetHandle: undefined,
  });

  describe('Node to Node Navigation', () => {
    it('should switch selection to the closest node on the left when Alt+ArrowLeft is pressed', async () => {
      const nodes = [
        createNode('node1', 100, 100, true), // Selected node in the middle
        createNode('node2', 0, 100),         // Node to the left
        createNode('node3', 200, 100),       // Node to the right
      ];

      let currentNodes = nodes;
      let currentEdges: any[] = [];
      
      const setNodes = vi.fn((updater: any) => {
        if (typeof updater === 'function') {
          currentNodes = updater(currentNodes);
        } else {
          currentNodes = updater;
        }
      });

      const setEdges = vi.fn((updater: any) => {
        if (typeof updater === 'function') {
          currentEdges = updater(currentEdges);
        } else {
          currentEdges = updater;
        }
      });

      renderHook(() => useCanvasNavigation({
        nodes: currentNodes,
        edges: currentEdges,
        setNodes,
        setEdges,
        isEditingMode: false,
        reactFlowInstance: createMockReactFlowInstance(),
      }));

      // Simulate Alt+ArrowLeft
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'ArrowLeft',
          altKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      // Wait for requestAnimationFrame callbacks
      await waitForAnimationFrames();

      expect(setNodes).toHaveBeenCalled();
      expect(currentNodes.find((n: any) => n.id === 'node2')?.selected).toBe(true);
      expect(currentNodes.find((n: any) => n.id === 'node1')?.selected).toBe(false);
    });

    it('should switch selection to the closest node on the right when Alt+ArrowRight is pressed', async () => {
      const nodes = [
        createNode('node1', 100, 100, true), // Selected node
        createNode('node2', 0, 100),         // Node to the left
        createNode('node3', 200, 100),       // Node to the right
      ];

      let currentNodes = nodes;
      let currentEdges: any[] = [];
      
      const setNodes = vi.fn((updater: any) => {
        if (typeof updater === 'function') {
          currentNodes = updater(currentNodes);
        } else {
          currentNodes = updater;
        }
      });

      const setEdges = vi.fn((updater: any) => {
        if (typeof updater === 'function') {
          currentEdges = updater(currentEdges);
        } else {
          currentEdges = updater;
        }
      });

      renderHook(() => useCanvasNavigation({
        nodes: currentNodes,
        edges: currentEdges,
        setNodes,
        setEdges,
        isEditingMode: false,
        reactFlowInstance: createMockReactFlowInstance(),
      }));

      // Simulate Alt+ArrowRight
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          altKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      // Wait for requestAnimationFrame callbacks
      await waitForAnimationFrames();

      expect(setNodes).toHaveBeenCalled();
      expect(currentNodes.find((n: any) => n.id === 'node3')?.selected).toBe(true);
      expect(currentNodes.find((n: any) => n.id === 'node1')?.selected).toBe(false);
    });

    it('should switch selection to the closest node above when Alt+ArrowUp is pressed', async () => {
      const nodes = [
        createNode('node1', 100, 100, true), // Selected node
        createNode('node2', 100, 0),         // Node above
        createNode('node3', 100, 200),       // Node below
      ];

      let currentNodes = nodes;
      let currentEdges: any[] = [];
      
      const setNodes = vi.fn((updater: any) => {
        if (typeof updater === 'function') {
          currentNodes = updater(currentNodes);
        } else {
          currentNodes = updater;
        }
      });

      const setEdges = vi.fn((updater: any) => {
        if (typeof updater === 'function') {
          currentEdges = updater(currentEdges);
        } else {
          currentEdges = updater;
        }
      });

      renderHook(() => useCanvasNavigation({
        nodes: currentNodes,
        edges: currentEdges,
        setNodes,
        setEdges,
        isEditingMode: false,
        reactFlowInstance: createMockReactFlowInstance(),
      }));

      // Simulate Alt+ArrowUp
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'ArrowUp',
          altKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      // Wait for requestAnimationFrame callbacks
      await waitForAnimationFrames();

      expect(setNodes).toHaveBeenCalled();
      expect(currentNodes.find((n: any) => n.id === 'node2')?.selected).toBe(true);
      expect(currentNodes.find((n: any) => n.id === 'node1')?.selected).toBe(false);
    });

    it('should switch selection to the closest node below when Alt+ArrowDown is pressed', async () => {
      const nodes = [
        createNode('node1', 100, 100, true), // Selected node
        createNode('node2', 100, 0),         // Node above
        createNode('node3', 100, 200),       // Node below
      ];

      let currentNodes = nodes;
      let currentEdges: any[] = [];
      
      const setNodes = vi.fn((updater: any) => {
        if (typeof updater === 'function') {
          currentNodes = updater(currentNodes);
        } else {
          currentNodes = updater;
        }
      });

      const setEdges = vi.fn((updater: any) => {
        if (typeof updater === 'function') {
          currentEdges = updater(currentEdges);
        } else {
          currentEdges = updater;
        }
      });

      renderHook(() => useCanvasNavigation({
        nodes: currentNodes,
        edges: currentEdges,
        setNodes,
        setEdges,
        isEditingMode: false,
        reactFlowInstance: createMockReactFlowInstance(),
      }));

      // Simulate Alt+ArrowDown
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          altKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      // Wait for requestAnimationFrame callbacks
      await waitForAnimationFrames();

      expect(setNodes).toHaveBeenCalled();
      expect(currentNodes.find((n: any) => n.id === 'node3')?.selected).toBe(true);
      expect(currentNodes.find((n: any) => n.id === 'node1')?.selected).toBe(false);
    });
  });

  describe('Edge to Edge Navigation', () => {
    it('should switch selection between edges', async () => {
      const nodes = [
        createNode('node1', 0, 100),
        createNode('node2', 100, 100),
        createNode('node3', 200, 100),
      ];

      const edges = [
        createEdge('edge1', 'node1', 'node2', true), // Selected, connects nodes at x=0 to x=100
        createEdge('edge2', 'node2', 'node3'),       // Connects nodes at x=100 to x=200
      ];

      let currentNodes = nodes;
      let currentEdges = edges;
      
      const setNodes = vi.fn((updater: any) => {
        if (typeof updater === 'function') {
          currentNodes = updater(currentNodes);
        } else {
          currentNodes = updater;
        }
      });

      const setEdges = vi.fn((updater: any) => {
        if (typeof updater === 'function') {
          currentEdges = updater(currentEdges);
        } else {
          currentEdges = updater;
        }
      });

      renderHook(() => useCanvasNavigation({
        nodes: currentNodes,
        edges: currentEdges,
        setNodes,
        setEdges,
        isEditingMode: false,
        reactFlowInstance: createMockReactFlowInstance(),
      }));

      // Simulate Alt+ArrowRight to go from edge1 to edge2
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          altKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      // Wait for requestAnimationFrame callbacks
      await waitForAnimationFrames();

      expect(setEdges).toHaveBeenCalled();
      expect(currentEdges.find((e: any) => e.id === 'edge2')?.selected).toBe(true);
      expect(currentEdges.find((e: any) => e.id === 'edge1')?.selected).toBe(false);
    });
  });

  describe('Node to Edge Navigation', () => {
    it('should switch selection from node to edge', async () => {
      const nodes = [
        createNode('node1', 0, 100, true),   // Selected node on the left
        createNode('node2', 200, 100),        // Node on the right
      ];

      const edges = [
        createEdge('edge1', 'node1', 'node2'), // Edge between the two nodes
      ];

      let currentNodes = nodes;
      let currentEdges = edges;
      
      const setNodes = vi.fn((updater: any) => {
        if (typeof updater === 'function') {
          currentNodes = updater(currentNodes);
        } else {
          currentNodes = updater;
        }
      });

      const setEdges = vi.fn((updater: any) => {
        if (typeof updater === 'function') {
          currentEdges = updater(currentEdges);
        } else {
          currentEdges = updater;
        }
      });

      renderHook(() => useCanvasNavigation({
        nodes: currentNodes,
        edges: currentEdges,
        setNodes,
        setEdges,
        isEditingMode: false,
        reactFlowInstance: createMockReactFlowInstance(),
      }));

      // Simulate Alt+ArrowRight to navigate from node1 to the edge
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          altKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      // Wait for requestAnimationFrame callbacks
      await waitForAnimationFrames();

      // The edge should now be selected
      expect(setEdges).toHaveBeenCalled();
      expect(currentEdges.find((e: any) => e.id === 'edge1')?.selected).toBe(true);
      expect(currentNodes.find((n: any) => n.id === 'node1')?.selected).toBe(false);
    });
  });

  describe('Edge to Node Navigation', () => {
    it('should switch selection from edge to node', async () => {
      const nodes = [
        createNode('node1', 0, 100),
        createNode('node2', 100, 100),
        createNode('node3', 200, 100), // Node to the right of the edge
      ];

      const edges = [
        createEdge('edge1', 'node1', 'node2', true), // Selected edge
      ];

      let currentNodes = nodes;
      let currentEdges = edges;
      
      const setNodes = vi.fn((updater: any) => {
        if (typeof updater === 'function') {
          currentNodes = updater(currentNodes);
        } else {
          currentNodes = updater;
        }
      });

      const setEdges = vi.fn((updater: any) => {
        if (typeof updater === 'function') {
          currentEdges = updater(currentEdges);
        } else {
          currentEdges = updater;
        }
      });

      renderHook(() => useCanvasNavigation({
        nodes: currentNodes,
        edges: currentEdges,
        setNodes,
        setEdges,
        isEditingMode: false,
        reactFlowInstance: createMockReactFlowInstance(),
      }));

      // Simulate Alt+ArrowRight to navigate from edge to node3
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          altKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      // Wait for requestAnimationFrame callbacks
      await waitForAnimationFrames();

      // node3 should now be selected
      expect(setNodes).toHaveBeenCalled();
      expect(currentNodes.find((n: any) => n.id === 'node3')?.selected).toBe(true);
      expect(currentEdges.find((e: any) => e.id === 'edge1')?.selected).toBe(false);
    });
  });

  describe('Mixed Navigation Scenarios', () => {
    it('should navigate between nodes and edges in complex layouts', async () => {
      const nodes = [
        createNode('node1', 0, 100, true),
        createNode('node2', 100, 100),
        createNode('node3', 200, 100),
        createNode('node4', 100, 200),
      ];

      const edges = [
        createEdge('edge1', 'node1', 'node2'),
        createEdge('edge2', 'node2', 'node3'),
        createEdge('edge3', 'node2', 'node4'),
      ];

      let currentNodes = nodes;
      let currentEdges = edges;
      
      const setNodes = vi.fn((updater: any) => {
        if (typeof updater === 'function') {
          currentNodes = updater(currentNodes);
        } else {
          currentNodes = updater;
        }
      });

      const setEdges = vi.fn((updater: any) => {
        if (typeof updater === 'function') {
          currentEdges = updater(currentEdges);
        } else {
          currentEdges = updater;
        }
      });

      renderHook(() => useCanvasNavigation({
        nodes: currentNodes,
        edges: currentEdges,
        setNodes,
        setEdges,
        isEditingMode: false,
        reactFlowInstance: createMockReactFlowInstance(),
      }));

      // Navigate right from node1 - should go to edge1 or node2 (whichever is closer)
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          altKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      // Wait for requestAnimationFrame callbacks
      await waitForAnimationFrames();

      expect(setNodes).toHaveBeenCalled();
      const hasSelection = currentNodes.some((n: any) => n.selected) || currentEdges.some((e: any) => e.selected);
      expect(hasSelection).toBe(true);
    });
  });

  describe('Edge Cases and Constraints', () => {
    it('should not switch selection when in editing mode', () => {
      const nodes = [
        createNode('node1', 100, 100, true),
        createNode('node2', 0, 100),
      ];

      const setNodes = vi.fn();
      const setEdges = vi.fn();

      renderHook(() => useCanvasNavigation({
        nodes,
        edges: [],
        setNodes,
        setEdges,
        isEditingMode: true, // Editing mode enabled
        reactFlowInstance: createMockReactFlowInstance(),
      }));

      // Simulate Alt+ArrowLeft
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'ArrowLeft',
          altKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(setNodes).not.toHaveBeenCalled();
      expect(setEdges).not.toHaveBeenCalled();
    });

    it('should not switch selection when Alt key is not pressed', () => {
      const nodes = [
        createNode('node1', 100, 100, true),
        createNode('node2', 0, 100),
      ];

      const setNodes = vi.fn();
      const setEdges = vi.fn();

      renderHook(() => useCanvasNavigation({
        nodes,
        edges: [],
        setNodes,
        setEdges,
        isEditingMode: false,
        reactFlowInstance: createMockReactFlowInstance(),
      }));

      // Simulate ArrowLeft without Alt
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'ArrowLeft',
          altKey: false,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(setNodes).not.toHaveBeenCalled();
      expect(setEdges).not.toHaveBeenCalled();
    });

    it('should not switch selection when nothing is selected', () => {
      const nodes = [
        createNode('node1', 100, 100, false), // No selection
        createNode('node2', 0, 100, false),
      ];

      const edges = [
        createEdge('edge1', 'node1', 'node2', false),
      ];

      const setNodes = vi.fn();
      const setEdges = vi.fn();

      renderHook(() => useCanvasNavigation({
        nodes,
        edges,
        setNodes,
        setEdges,
        isEditingMode: false,
        reactFlowInstance: createMockReactFlowInstance(),
      }));

      // Simulate Alt+ArrowLeft
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'ArrowLeft',
          altKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(setNodes).not.toHaveBeenCalled();
      expect(setEdges).not.toHaveBeenCalled();
    });

    it('should navigate to boundary nodes (they are not skipped)', async () => {
      const nodes = [
        createNode('node1', 100, 100, true, 'threatModelNode'),  // Selected component
        createNode('boundary1', 0, 100, false, 'boundaryNode'),  // Boundary to the left (not skipped)
        createNode('node2', -100, 100, false, 'threatModelNode'), // Component further left
      ];

      let currentNodes = nodes;
      let currentEdges: any[] = [];
      
      const setNodes = vi.fn((updater: any) => {
        if (typeof updater === 'function') {
          currentNodes = updater(currentNodes);
        } else {
          currentNodes = updater;
        }
      });

      const setEdges = vi.fn((updater: any) => {
        if (typeof updater === 'function') {
          currentEdges = updater(currentEdges);
        } else {
          currentEdges = updater;
        }
      });

      renderHook(() => useCanvasNavigation({
        nodes: currentNodes,
        edges: currentEdges,
        setNodes,
        setEdges,
        isEditingMode: false,
        reactFlowInstance: createMockReactFlowInstance(),
      }));

      // Simulate Alt+ArrowLeft
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'ArrowLeft',
          altKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      // Wait for requestAnimationFrame callbacks
      await waitForAnimationFrames();

      expect(setNodes).toHaveBeenCalled();
      // Should select boundary1 since it's closer
      expect(currentNodes.find((n: any) => n.id === 'boundary1')?.selected).toBe(true);
      expect(currentNodes.find((n: any) => n.id === 'node1')?.selected).toBe(false);
    });

    it('should handle diagonal node positions with tolerance zones', async () => {
      const nodes = [
        createNode('node1', 100, 100, true),    // Selected node at x=100, y=100
        createNode('node2', 50, 60),            // Node to top-left (x=50, y=60) - primary distance = 50px, perpendicular = 40px
        createNode('node3', 0, 100),            // Node directly to the left (x=0, y=100) - primary distance = 100px, perpendicular = 0px
      ];

      let currentNodes = nodes;
      let currentEdges: any[] = [];
      
      const setNodes = vi.fn((updater: any) => {
        if (typeof updater === 'function') {
          currentNodes = updater(currentNodes);
        } else {
          currentNodes = updater;
        }
      });

      const setEdges = vi.fn((updater: any) => {
        if (typeof updater === 'function') {
          currentEdges = updater(currentEdges);
        } else {
          currentEdges = updater;
        }
      });

      renderHook(() => useCanvasNavigation({
        nodes: currentNodes,
        edges: currentEdges,
        setNodes,
        setEdges,
        isEditingMode: false,
        reactFlowInstance: createMockReactFlowInstance(),
      }));

      // Simulate Alt+ArrowLeft - should select node2 (closest in primary direction)
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'ArrowLeft',
          altKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      // Wait for requestAnimationFrame callbacks
      await waitForAnimationFrames();

      expect(setNodes).toHaveBeenCalled();
      // node2 is closer (50px primary distance) than node3 (100px primary distance)
      expect(currentNodes.find((n: any) => n.id === 'node2')?.selected).toBe(true);
    });

    it('should do nothing when there is no item in the specified direction', () => {
      const nodes = [
        createNode('node1', 100, 100, true), // Selected node
        createNode('node2', 200, 100),       // Node to the right only
      ];

      let currentNodes = nodes;
      let currentEdges: any[] = [];
      
      const setNodes = vi.fn((updater: any) => {
        if (typeof updater === 'function') {
          currentNodes = updater(currentNodes);
        } else {
          currentNodes = updater;
        }
      });

      const setEdges = vi.fn((updater: any) => {
        if (typeof updater === 'function') {
          currentEdges = updater(currentEdges);
        } else {
          currentEdges = updater;
        }
      });

      renderHook(() => useCanvasNavigation({
        nodes: currentNodes,
        edges: currentEdges,
        setNodes,
        setEdges,
        isEditingMode: false,
        reactFlowInstance: createMockReactFlowInstance(),
      }));

      // Simulate Alt+ArrowLeft - no node to the left
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'ArrowLeft',
          altKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      // setNodes should not be called since no valid target found
      expect(setNodes).not.toHaveBeenCalled();
      expect(setEdges).not.toHaveBeenCalled();
      expect(currentNodes.find((n: any) => n.id === 'node1')?.selected).toBe(true);
    });

    it('should find items with progressive tolerance expansion', async () => {
      const nodes = [
        createNode('node1', 100, 100, true),    // Selected node
        createNode('node2', 0, 200),            // Node to left with 100px perpendicular offset
      ];

      let currentNodes = nodes;
      let currentEdges: any[] = [];
      
      const setNodes = vi.fn((updater: any) => {
        if (typeof updater === 'function') {
          currentNodes = updater(currentNodes);
        } else {
          currentNodes = updater;
        }
      });

      const setEdges = vi.fn((updater: any) => {
        if (typeof updater === 'function') {
          currentEdges = updater(currentEdges);
        } else {
          currentEdges = updater;
        }
      });

      renderHook(() => useCanvasNavigation({
        nodes: currentNodes,
        edges: currentEdges,
        setNodes,
        setEdges,
        isEditingMode: false,
        reactFlowInstance: createMockReactFlowInstance(),
      }));

      // Simulate Alt+ArrowLeft
      // With 100px perpendicular offset, should be found at tolerance=100 or 150
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'ArrowLeft',
          altKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      // Wait for requestAnimationFrame callbacks
      await waitForAnimationFrames();

      expect(setNodes).toHaveBeenCalled();
      expect(currentNodes.find((n: any) => n.id === 'node2')?.selected).toBe(true);
    });

    it('should prioritize items found at lower tolerance levels', async () => {
      const nodes = [
        createNode('node1', 100, 100, true),    // Selected node
        createNode('node2', 50, 110),           // 10px perpendicular offset (found at tolerance 50)
        createNode('node3', 0, 150),            // 50px perpendicular offset (found at tolerance 50)
      ];

      let currentNodes = nodes;
      let currentEdges: any[] = [];
      
      const setNodes = vi.fn((updater: any) => {
        if (typeof updater === 'function') {
          currentNodes = updater(currentNodes);
        } else {
          currentNodes = updater;
        }
      });

      const setEdges = vi.fn((updater: any) => {
        if (typeof updater === 'function') {
          currentEdges = updater(currentEdges);
        } else {
          currentEdges = updater;
        }
      });

      renderHook(() => useCanvasNavigation({
        nodes: currentNodes,
        edges: currentEdges,
        setNodes,
        setEdges,
        isEditingMode: false,
        reactFlowInstance: createMockReactFlowInstance(),
      }));

      // Simulate Alt+ArrowLeft - should select node2 (closer in primary direction)
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'ArrowLeft',
          altKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      // Wait for requestAnimationFrame callbacks
      await waitForAnimationFrames();

      expect(setNodes).toHaveBeenCalled();
      // node2 is closer (50px primary distance) than node3 (100px primary distance)
      expect(currentNodes.find((n: any) => n.id === 'node2')?.selected).toBe(true);
    });
  });
});
