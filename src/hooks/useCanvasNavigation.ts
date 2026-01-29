/**
 * Custom hook for navigating between nodes and edges using Option/Alt + arrow keys
 * Switches selection to the closest node or edge in the direction of the arrow key pressed
 * Supports diagonal navigation when multiple arrow keys are pressed simultaneously
 * Also provides Shift+F hotkey to fit all nodes in view
 */

import { useEffect, useCallback, useRef } from 'react';
import { Position } from '@xyflow/react';
import { findClosestInDirection } from '../utils/navigationHelpers';

interface Handle {
  id: string;
  position: Position;
  offset: number;
}

// All nodes use the same handle configuration (12 handles - 3 per side)
export const HANDLES: Handle[] = [
  { position: Position.Top, id: 'top-1', offset: 0 },
  { position: Position.Top, id: 'top-2', offset: 0.33 },
  { position: Position.Top, id: 'top-3', offset: 0.66 },
  { position: Position.Right, id: 'right-1', offset: 0 },
  { position: Position.Right, id: 'right-2', offset: 0.33 },
  { position: Position.Right, id: 'right-3', offset: 0.66 },
  { position: Position.Bottom, id: 'bottom-1', offset: 0 },
  { position: Position.Bottom, id: 'bottom-2', offset: 0.33 },
  { position: Position.Bottom, id: 'bottom-3', offset: 0.66 },
  { position: Position.Left, id: 'left-1', offset: 0 },
  { position: Position.Left, id: 'left-2', offset: 0.33 },
  { position: Position.Left, id: 'left-3', offset: 0.66 },
];

/**
 * Get the next handle in a given direction
 */
export function getNextHandle(currentHandleId: string, direction: 'left' | 'right' | 'up' | 'down'): string {
  const currentIndex = HANDLES.findIndex(h => h.id === currentHandleId);
  if (currentIndex === -1) return HANDLES[0].id;
  
  // Define corner handles
  const corners = ['top-1', 'top-3', 'bottom-1', 'bottom-3'];
  const isCorner = corners.includes(currentHandleId);
  
  // Handle corner cases with specific navigation
  if (isCorner) {
    switch (currentHandleId) {
      case 'top-1': // top-left corner
        if (direction === 'up') return 'bottom-1'; // wrap around
        if (direction === 'down') return 'left-1'; // closest below
        if (direction === 'left') return 'left-1'; // closest left
        if (direction === 'right') return 'top-2'; // closest right
        break;
      case 'top-3': // top-right corner
        if (direction === 'up') return 'bottom-3'; // wrap around
        if (direction === 'down') return 'right-1'; // closest below
        if (direction === 'left') return 'top-2'; // closest left
        if (direction === 'right') return 'right-1'; // closest right
        break;
      case 'bottom-1': // bottom-left corner
        if (direction === 'up') return 'left-3'; // closest above
        if (direction === 'down') return 'top-1'; // wrap around
        if (direction === 'left') return 'left-3'; // closest left
        if (direction === 'right') return 'bottom-2'; // closest right
        break;
      case 'bottom-3': // bottom-right corner
        if (direction === 'up') return 'right-3'; // closest above
        if (direction === 'down') return 'top-3'; // wrap around
        if (direction === 'left') return 'bottom-2'; // closest left
        if (direction === 'right') return 'right-3'; // closest right
        break;
    }
  }
  
  // Handle middle handles (top-2, bottom-2, left-2, right-2)
  if (currentHandleId === 'top-2') {
    if (direction === 'up') return 'bottom-2'; // wrap around
    if (direction === 'down') return 'bottom-2'; // go to opposite
    if (direction === 'left') return 'top-1';
    if (direction === 'right') return 'top-3';
  }
  
  if (currentHandleId === 'bottom-2') {
    if (direction === 'up') return 'top-2'; // go to opposite
    if (direction === 'down') return 'top-2'; // wrap around
    if (direction === 'left') return 'bottom-1';
    if (direction === 'right') return 'bottom-3';
  }
  
  if (currentHandleId === 'left-2') {
    if (direction === 'up') return 'left-1';
    if (direction === 'down') return 'left-3';
    if (direction === 'left') return 'right-2'; // wrap around
    if (direction === 'right') return 'right-2'; // go to opposite
  }
  
  if (currentHandleId === 'right-2') {
    if (direction === 'up') return 'right-1';
    if (direction === 'down') return 'right-3';
    if (direction === 'left') return 'left-2'; // go to opposite
    if (direction === 'right') return 'left-2'; // wrap around
  }
  
  // Handle edge handles (left-1, left-3, right-1, right-3) - not corners
  if (currentHandleId === 'left-1') {
    if (direction === 'up') return 'top-1'; // to corner
    if (direction === 'down') return 'left-2';
    if (direction === 'left') return 'right-1'; // wrap around
    if (direction === 'right') return 'top-1'; // closest to the right
  }
  
  if (currentHandleId === 'left-3') {
    if (direction === 'up') return 'left-2';
    if (direction === 'down') return 'bottom-1'; // to corner
    if (direction === 'left') return 'right-3'; // wrap around
    if (direction === 'right') return 'bottom-1'; // closest to the right
  }
  
  if (currentHandleId === 'right-1') {
    if (direction === 'up') return 'top-3'; // to corner
    if (direction === 'down') return 'right-2';
    if (direction === 'left') return 'top-3'; // closest to the left
    if (direction === 'right') return 'left-1'; // wrap around
  }
  
  if (currentHandleId === 'right-3') {
    if (direction === 'up') return 'right-2';
    if (direction === 'down') return 'bottom-3'; // to corner
    if (direction === 'left') return 'bottom-3'; // closest to the left
    if (direction === 'right') return 'left-3'; // wrap around
  }
  
  return currentHandleId;
}

interface UseCanvasNavigationParams {
  nodes: any[];
  edges: any[];
  setNodes: React.Dispatch<React.SetStateAction<any[]>>;
  setEdges: React.Dispatch<React.SetStateAction<any[]>>;
  isEditingMode: boolean;
  reactFlowInstance: any;
}

export interface SelectableItem {
  id: string;
  x: number;
  y: number;
  type: 'node' | 'edge';
}

type Direction = 'left' | 'right' | 'up' | 'down' | 'up-left' | 'up-right' | 'down-left' | 'down-right';

/**
 * Calculate the label position for an edge based on its source and target nodes
 */
export function getEdgeLabelPosition(edge: any, nodes: any[]): { x: number; y: number } {
  // Find source and target nodes
  const sourceNode = nodes.find(n => n.id === edge.source);
  const targetNode = nodes.find(n => n.id === edge.target);
  
  if (!sourceNode || !targetNode) {
    return { x: 0, y: 0 };
  }
  
  // Helper function to get Position from handle ID
  const getPositionFromHandle = (handleId: string | undefined): Position => {
    if (!handleId) return Position.Right;
    
    // Remove 'target-' prefix if present
    const cleanId = handleId.replace('target-', '');
    
    // Extract position from handle ID (e.g., 'top-1', 'right-2', 'bottom-3', 'left-1')
    if (cleanId.startsWith('top-')) return Position.Top;
    if (cleanId.startsWith('right-')) return Position.Right;
    if (cleanId.startsWith('bottom-')) return Position.Bottom;
    if (cleanId.startsWith('left-')) return Position.Left;
    
    return Position.Right; // Default
  };
  
  // Calculate edge endpoints (center of nodes by default)
  const sourceX = sourceNode.position.x + (sourceNode.width || 0) / 2;
  const sourceY = sourceNode.position.y + (sourceNode.height || 0) / 2;
  const targetX = targetNode.position.x + (targetNode.width || 0) / 2;
  const targetY = targetNode.position.y + (targetNode.height || 0) / 2;
  
  // Get control points using the same logic as EditableEdge
  const CONTROL_OFFSET = 50;
  
  const getControlPoint = (x: number, y: number, position?: Position): { x: number; y: number } => {
    switch (position) {
      case Position.Top:
        return { x, y: y - CONTROL_OFFSET };
      case Position.Bottom:
        return { x, y: y + CONTROL_OFFSET };
      case Position.Left:
        return { x: x - CONTROL_OFFSET, y };
      case Position.Right:
        return { x: x + CONTROL_OFFSET, y };
      default:
        return { x, y };
    }
  };
  
  // Determine source and target positions from handle IDs
  const sourcePosition = getPositionFromHandle(edge.sourceHandle);
  const targetPosition = getPositionFromHandle(edge.targetHandle);
  
  const sourceControl = getControlPoint(sourceX, sourceY, sourcePosition);
  const targetControl = getControlPoint(targetX, targetY, targetPosition);
  
  // Calculate label position at the actual midpoint (t=0.5) of the cubic bezier curve
  // Using the cubic bezier formula: B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
  // At t=0.5: B(0.5) = 0.125*P0 + 0.375*P1 + 0.375*P2 + 0.125*P3
  const labelX = 0.125 * sourceX + 0.375 * sourceControl.x + 0.375 * targetControl.x + 0.125 * targetX;
  const labelY = 0.125 * sourceY + 0.375 * sourceControl.y + 0.375 * targetControl.y + 0.125 * targetY;
  
  return { x: labelX, y: labelY };
}

/**
 * Get all selectable items (nodes and edges) with their positions
 */
export function getSelectableItems(nodes: any[], edges: any[]): SelectableItem[] {
  const items: SelectableItem[] = [];
  
  // Add all nodes
  nodes.forEach(node => {
    items.push({
      id: node.id,
      x: node.position.x + (node.width || 0) / 2,
      y: node.position.y + (node.height || 0) / 2,
      type: 'node'
    });
  });
  
  // Add all edges based on their label position
  edges.forEach(edge => {
    const pos = getEdgeLabelPosition(edge, nodes);
    items.push({
      id: edge.id,
      x: pos.x,
      y: pos.y,
      type: 'edge'
    });
  });
  
  return items;
}

/**
 * Find the closest node to a given position
 * @param x - X coordinate of the reference position
 * @param y - Y coordinate of the reference position
 * @param nodes - Array of nodes to search
 * @param excludeIds - Optional array of node IDs to exclude from the search
 * @returns The closest node or null if no nodes available
 */
export function findClosestNode(
  x: number,
  y: number,
  nodes: any[],
  excludeIds: string[] = []
): any | null {
  let closestNode: any | null = null;
  let closestDistance = Infinity;
  
  for (const node of nodes) {
    // Skip excluded nodes
    if (excludeIds.includes(node.id)) {
      continue;
    }
    
    // Calculate distance from the reference position to the node center
    const nodeX = node.position.x + (node.width || 0) / 2;
    const nodeY = node.position.y + (node.height || 0) / 2;
    const distance = Math.sqrt(Math.pow(nodeX - x, 2) + Math.pow(nodeY - y, 2));
    
    if (distance < closestDistance) {
      closestNode = node;
      closestDistance = distance;
    }
  }
  
  return closestNode;
}

/**
 * Pan the viewport to bring a node into view if it's outside the current viewport
 * @param node - The node to pan to
 * @param reactFlowInstance - The ReactFlow instance
 */
export function panToNode(node: any, reactFlowInstance: any): void {
  if (!reactFlowInstance) return;
  
  try {
    const viewport = reactFlowInstance.getViewport();
    
    // Calculate node position in screen space
    const nodeWidth = node.width || 200;
    const nodeHeight = node.height || 100;
    
    // Transform node position to screen coordinates
    const nodeScreenX = node.position.x * viewport.zoom + viewport.x;
    const nodeScreenY = node.position.y * viewport.zoom + viewport.y;
    const nodeScreenWidth = nodeWidth * viewport.zoom;
    const nodeScreenHeight = nodeHeight * viewport.zoom;
    
    // Get the viewport dimensions from the DOM
    const viewportElement = document.querySelector('.react-flow__viewport');
    if (!viewportElement) return;
    
    const containerElement = viewportElement.parentElement;
    if (!containerElement) return;
    
    const containerRect = containerElement.getBoundingClientRect();
    const padding = 50; // padding in pixels
    
    // Check if node is outside viewport
    const isOutsideLeft = nodeScreenX < padding;
    const isOutsideRight = nodeScreenX + nodeScreenWidth > containerRect.width - padding;
    const isOutsideTop = nodeScreenY < padding;
    const isOutsideBottom = nodeScreenY + nodeScreenHeight > containerRect.height - padding;
    
    if (isOutsideLeft || isOutsideRight || isOutsideTop || isOutsideBottom) {
      // Calculate the center of the viewport in flow coordinates
      const centerX = node.position.x + nodeWidth / 2;
      const centerY = node.position.y + nodeHeight / 2;
      
      // Pan to center the node with animation
      reactFlowInstance.setCenter(centerX, centerY+100, { zoom: viewport.zoom, duration: 400 });
    }
  } catch (error) {
    console.error('Error panning to node:', error);
  }
}

export function useCanvasNavigation({ 
  nodes,
  edges,
  setNodes,
  setEdges,
  isEditingMode,
  reactFlowInstance
}: UseCanvasNavigationParams): void {
  const minDistance = 20; // Minimum primary distance required
  const pressedKeys = useRef<Set<string>>(new Set());
  const navigationTimeoutRef = useRef<number | null>(null);
  
  /**
   * Pan the viewport to bring an edge label into view if it's outside the current viewport
   */
  const panToEdge = useCallback((edge: any) => {
    if (!reactFlowInstance) return;
    
    try {
      const viewport = reactFlowInstance.getViewport();
      
      // Get the edge label position
      const labelPos = getEdgeLabelPosition(edge, nodes);
      
      // Transform edge label position to screen coordinates
      const edgeLabelScreenX = labelPos.x * viewport.zoom + viewport.x;
      const edgeLabelScreenY = labelPos.y * viewport.zoom + viewport.y;
      
      // Get the viewport dimensions from the DOM
      const viewportElement = document.querySelector('.react-flow__viewport');
      if (!viewportElement) return;
      
      const containerElement = viewportElement.parentElement;
      if (!containerElement) return;
      
      const containerRect = containerElement.getBoundingClientRect();
      const padding = 15; // padding in pixels
      
      // Check if edge label is outside viewport
      const isOutsideLeft = edgeLabelScreenX < padding;
      const isOutsideRight = edgeLabelScreenX > containerRect.width - padding;
      const isOutsideTop = edgeLabelScreenY < padding;
      const isOutsideBottom = edgeLabelScreenY > containerRect.height - padding;
      
      if (isOutsideLeft || isOutsideRight || isOutsideTop || isOutsideBottom) {
        // Pan to center the edge label with animation
        reactFlowInstance.setCenter(labelPos.x, labelPos.y, { zoom: viewport.zoom, duration: 400 });
      }
    } catch (error) {
      console.error('Error panning to edge:', error);
    }
  }, [reactFlowInstance, nodes]);
  
  /**
   * Find the closest node or edge in a given direction from the currently selected item
   */
  const findClosestItemInDirection = useCallback(
    (direction: Direction): SelectableItem | null => {
      const items = getSelectableItems(nodes, edges);
      
      // Get currently selected item (node or edge)
      const selectedNodes = nodes.filter(node => node.selected);
      const selectedEdges = edges.filter(edge => edge.selected);
      
      let currentX: number;
      let currentY: number;
      let currentId: string;
      let currentType: 'node' | 'edge';
      
      if (selectedNodes.length > 0) {
        // Currently selected item is a node
        const currentNode = selectedNodes[0];
        currentX = currentNode.position.x + (currentNode.width || 0) / 2;
        currentY = currentNode.position.y + (currentNode.height || 0) / 2;
        currentId = currentNode.id;
        currentType = 'node';
      } else if (selectedEdges.length > 0) {
        // Currently selected item is an edge
        const currentEdge = selectedEdges[0];
        const pos = getEdgeLabelPosition(currentEdge, nodes);
        currentX = pos.x;
        currentY = pos.y;
        currentId = currentEdge.id;
        currentType = 'edge';
      } else {
        // Nothing selected
        return null;
      }
      
      // Filter out the current item
      const selectableItems = items.filter(
        item => !(item.id === currentId && item.type === currentType)
      );
      
      // Use shared utility for all directions (cardinal and diagonal)
      return findClosestInDirection(currentX, currentY, direction, selectableItems) || null;
    },
    [nodes, edges, minDistance]
  );
  
  const switchSelection = useCallback(
    (targetItem: SelectableItem) => {
      if (targetItem.type === 'node') {
        // Deselect all edges and select the target node
        setEdges((currentEdges) =>
          currentEdges.map((edge) => ({
            ...edge,
            selected: false,
          }))
        );
        setNodes((currentNodes) => {
          const updatedNodes = currentNodes.map((node) => ({
            ...node,
            selected: node.id === targetItem.id,
          }));
          
          // Pan to the selected node if it's outside the viewport
          const selectedNode = updatedNodes.find(node => node.id === targetItem.id);
          if (selectedNode && reactFlowInstance) {
            panToNode(selectedNode, reactFlowInstance);
          }
          
          return updatedNodes;
        });
      } else {
        // Deselect all nodes and select the target edge
        setNodes((currentNodes) =>
          currentNodes.map((node) => ({
            ...node,
            selected: false,
          }))
        );
        setEdges((currentEdges) => {
          const updatedEdges = currentEdges.map((edge) => ({
            ...edge,
            selected: edge.id === targetItem.id,
          }));
          
          // Pan to the selected edge if it's outside the viewport
          const selectedEdge = updatedEdges.find(edge => edge.id === targetItem.id);
          if (selectedEdge) {
            panToEdge(selectedEdge);
          }
          
          return updatedEdges;
        });
      }
    },
    [setNodes, setEdges, panToEdge, reactFlowInstance]
  );
  
  useEffect(() => {
    const performNavigation = () => {
      // Determine direction based on currently pressed keys
      let direction: Direction | null = null;
      
      const hasLeft = pressedKeys.current.has('ArrowLeft');
      const hasRight = pressedKeys.current.has('ArrowRight');
      const hasUp = pressedKeys.current.has('ArrowUp');
      const hasDown = pressedKeys.current.has('ArrowDown');
      
      // Check for diagonal combinations first
      if (hasUp && hasLeft) {
        direction = 'up-left';
      } else if (hasUp && hasRight) {
        direction = 'up-right';
      } else if (hasDown && hasLeft) {
        direction = 'down-left';
      } else if (hasDown && hasRight) {
        direction = 'down-right';
      }
      // Then check for cardinal directions
      else if (hasLeft) {
        direction = 'left';
      } else if (hasRight) {
        direction = 'right';
      } else if (hasUp) {
        direction = 'up';
      } else if (hasDown) {
        direction = 'down';
      }
      
      if (!direction) {
        return;
      }
      
      // Find the closest item (node or edge) in the specified direction
      const targetItem = findClosestItemInDirection(direction);
      
      // Switch selection if we found a target
      if (targetItem) {
        switchSelection(targetItem);
      }
    };
    
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only process if Option/Alt is held down and it's an arrow key
      if (!event.altKey || isEditingMode) {
        return;
      }
      
      // Track which arrow keys are pressed
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        pressedKeys.current.add(event.key);
        
        // Cancel any pending navigation
        if (navigationTimeoutRef.current !== null) {
          cancelAnimationFrame(navigationTimeoutRef.current);
        }
        
        // Schedule navigation for two animation frames
        // This gives more time for multiple keys to be registered before navigation executes
        navigationTimeoutRef.current = requestAnimationFrame(() => {
          navigationTimeoutRef.current = requestAnimationFrame(() => {
            performNavigation();
            navigationTimeoutRef.current = null;
          });
        });
      }
    };
    
    const handleKeyUp = (event: KeyboardEvent) => {
      // Remove key from pressed keys when released
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        pressedKeys.current.delete(event.key);
        
        // Cancel any pending navigation when key is released
        if (navigationTimeoutRef.current !== null) {
          cancelAnimationFrame(navigationTimeoutRef.current);
          navigationTimeoutRef.current = null;
        }
      }
    };
    
    const handleFitView = (event: KeyboardEvent) => {
      // Check if user is typing in an input field
      const target = event.target as HTMLElement;
      const isTypingInInput = target.tagName === 'INPUT' || 
                              target.tagName === 'TEXTAREA' || 
                              target.isContentEditable;
      
      // Shift+F to fit all nodes in view (but not when typing in input fields)
      if (event.shiftKey && event.key === 'F' && !isEditingMode && !isTypingInInput && reactFlowInstance) {
        event.preventDefault();
        reactFlowInstance.fitView({ padding: 0.2, duration: 400 });
      }
    };
    
    // Add keyboard event listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keydown', handleFitView);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keydown', handleFitView);
      window.removeEventListener('keyup', handleKeyUp);
      pressedKeys.current.clear();
      if (navigationTimeoutRef.current !== null) {
        cancelAnimationFrame(navigationTimeoutRef.current);
      }
    };
  }, [findClosestItemInDirection, switchSelection, isEditingMode, reactFlowInstance]);
}
