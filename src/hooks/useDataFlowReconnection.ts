/**
 * Custom hook for reconnecting existing data flows using keyboard navigation
 * Implements a multi-phase process:
 * - Phase 1: Select source node (starts with original source)
 * - Phase 2: Select source handle (starts with original source handle)
 * - Phase 3: Select target node (starts with original target)
 * - Phase 4: Select target handle (starts with original target handle)
 * - Updates the data flow connection on completion
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { HANDLES, getNextHandle, panToNode } from './useCanvasNavigation';
import { findClosestNodeInDirection } from '../utils/navigationHelpers';

export type DataFlowReconnectionPhase = 'idle' | 'source-node' | 'source-handle' | 'target-node' | 'target-handle';

interface UseDataFlowReconnectionParams {
  nodes: any[];
  edges: any[];
  setNodes: React.Dispatch<React.SetStateAction<any[]>>;
  setEdges: React.Dispatch<React.SetStateAction<any[]>>;
  isEditingMode: boolean;
  reactFlowInstance?: any;
}

export interface DataFlowReconnectionState {
  phase: DataFlowReconnectionPhase;
  edgeId: string | null;
  sourceNodeId: string | null;
  sourceHandleId: string | null;
  targetNodeId: string | null;
  targetHandleId: string | null;
  focusedNodeId: string | null;
  focusedHandleId: string | null;
}

export interface UseDataFlowReconnectionResult {
  reconnectionState: DataFlowReconnectionState;
  cancelReconnection: () => void;
}

export function useDataFlowReconnection({
  nodes,
  edges,
  isEditingMode,
  setNodes,
  setEdges,
  reactFlowInstance,
}: UseDataFlowReconnectionParams): UseDataFlowReconnectionResult {
  const [phase, setPhase] = useState<DataFlowReconnectionPhase>('idle');
  const [edgeId, setEdgeId] = useState<string | null>(null);
  const [sourceNodeId, setSourceNodeId] = useState<string | null>(null);
  const [sourceHandleId, setSourceHandleId] = useState<string | null>(null);
  const [targetNodeId, setTargetNodeId] = useState<string | null>(null);
  const [targetHandleId, setTargetHandleId] = useState<string | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [focusedHandleId, setFocusedHandleId] = useState<string | null>(null);
  
  const stateRef = useRef({ 
    phase, 
    edgeId, 
    sourceNodeId, 
    sourceHandleId, 
    targetNodeId, 
    targetHandleId, 
    focusedNodeId, 
    focusedHandleId 
  });
  
  // Keep ref in sync with state
  useEffect(() => {
    stateRef.current = { 
      phase, 
      edgeId, 
      sourceNodeId, 
      sourceHandleId, 
      targetNodeId, 
      targetHandleId, 
      focusedNodeId, 
      focusedHandleId 
    };
  }, [phase, edgeId, sourceNodeId, sourceHandleId, targetNodeId, targetHandleId, focusedNodeId, focusedHandleId]);
  
  const resetState = useCallback(() => {
    setPhase('idle');
    setEdgeId(null);
    setSourceNodeId(null);
    setSourceHandleId(null);
    setTargetNodeId(null);
    setTargetHandleId(null);
    setFocusedNodeId(null);
    setFocusedHandleId(null);
  }, []);
  
  const startPhase1 = useCallback(() => {
    // Get the currently selected edge
    const selectedEdge = edges.find(edge => edge.selected);
    if (!selectedEdge) return;
    
    // Extract handle IDs (remove 'target-' prefix from targetHandle if present)
    const cleanTargetHandleId = selectedEdge.targetHandle?.replace('target-', '') || null;
    
    // Check if source node would be under the overlay and pan if needed
    if (reactFlowInstance) {
      const sourceNode = nodes.find(n => n.id === selectedEdge.source);
      if (sourceNode) {
        // Overlay dimensions from CanvasOverlay.css (fixed screen pixels)
        const overlayHeight = 80;
        const overlayTopMargin = 16;
        const overlayBottom = overlayTopMargin + overlayHeight;
        
        // Get current viewport and canvas dimensions
        const viewport = reactFlowInstance.getViewport();
        const canvasElement = document.querySelector('.react-flow__viewport')?.parentElement;
        const canvasHeight = canvasElement?.clientHeight || window.innerHeight;
        
        // Convert node position to screen coordinates
        const nodeScreenPos = reactFlowInstance.flowToScreenPosition({
          x: sourceNode.position.x,
          y: sourceNode.position.y,
        });
        
        // Node dimensions
        const nodeFlowHeight = sourceNode.measured?.height || sourceNode.height || 100;
        const nodeScreenHeight = nodeFlowHeight * viewport.zoom;
        
        // Calculate node center in screen coordinates
        const nodeCenterY = nodeScreenPos.y + nodeScreenHeight / 2;
        
        // Determine if node is in problematic area (upper portion of screen)
        const baseTriggerZone = 150;
        const zoomScaledTriggerZone = baseTriggerZone * Math.max(1, viewport.zoom);
        const triggerZone = overlayBottom + zoomScaledTriggerZone;
        
        if (nodeScreenPos.y < triggerZone) {
          // Target position: slightly above middle vertically (40% down from top)
          const targetY = canvasHeight * 0.4;
          
          // Calculate pan amount to move node center to target position vertically
          const panY = targetY - nodeCenterY;
          
          // Apply the pan by adjusting viewport position (only vertical)
          // Convert screen pixel delta to flow coordinates
          reactFlowInstance.setViewport({
            x: viewport.x,
            y: viewport.y + panY / viewport.zoom,
            zoom: viewport.zoom,
          }, { duration: 300 });
        }
      }
    }
    
    setPhase('source-node');
    setEdgeId(selectedEdge.id);
    setSourceNodeId(selectedEdge.source);
    setSourceHandleId(selectedEdge.sourceHandle);
    setTargetNodeId(selectedEdge.target);
    setTargetHandleId(cleanTargetHandleId);
    
    // Start with the current source node focused
    setFocusedNodeId(selectedEdge.source);
  }, [edges, nodes, reactFlowInstance]);
  
  const confirmPhase1 = useCallback(() => {
    // Move to phase 2 - select source handle
    setSourceNodeId(focusedNodeId);
    setPhase('source-handle');
    
    // Start with the current source handle if the node hasn't changed
    if (focusedNodeId === sourceNodeId && sourceHandleId) {
      setFocusedHandleId(sourceHandleId);
    } else {
      setFocusedHandleId(HANDLES[0].id);
    }
    setFocusedNodeId(null);
  }, [focusedNodeId, sourceNodeId, sourceHandleId]);
  
  const confirmPhase2 = useCallback(() => {
    // Move to phase 3 - select target node
    setSourceHandleId(focusedHandleId);
    setPhase('target-node');
    setFocusedHandleId(null);
    
    // Start with the current target node focused
    setFocusedNodeId(targetNodeId);
  }, [focusedHandleId, targetNodeId]);
  
  const confirmPhase3 = useCallback(() => {
    // Move to phase 4 - select target handle
    setTargetNodeId(focusedNodeId);
    setPhase('target-handle');
    
    // Start with the current target handle if the node hasn't changed
    if (focusedNodeId === targetNodeId && targetHandleId) {
      setFocusedHandleId(targetHandleId);
    } else {
      setFocusedHandleId(HANDLES[0].id);
    }
    setFocusedNodeId(null);
  }, [focusedNodeId, targetNodeId, targetHandleId]);
  
  const confirmPhase4 = useCallback(() => {
    // Update the edge with new connection details
    if (edgeId && sourceNodeId && sourceHandleId && targetNodeId && focusedHandleId) {
      setEdges((currentEdges) =>
        currentEdges.map((edge) => {
          if (edge.id === edgeId) {
            return {
              ...edge,
              source: sourceNodeId,
              sourceHandle: sourceHandleId,
              target: targetNodeId,
              targetHandle: `target-${focusedHandleId}`,
            };
          }
          return edge;
        })
      );
    }
    
    // Reset state
    resetState();
  }, [edgeId, sourceNodeId, sourceHandleId, targetNodeId, focusedHandleId, setEdges, resetState]);
  
  const goBackPhase = useCallback(() => {
    switch (phase) {
      case 'source-node':
        resetState();
        break;
      case 'source-handle':
        setPhase('source-node');
        setFocusedHandleId(null);
        setFocusedNodeId(sourceNodeId);
        break;
      case 'target-node':
        setPhase('source-handle');
        setFocusedNodeId(null);
        setFocusedHandleId(sourceHandleId);
        break;
      case 'target-handle':
        setPhase('target-node');
        setFocusedHandleId(null);
        setFocusedNodeId(targetNodeId);
        break;
    }
  }, [phase, sourceNodeId, sourceHandleId, targetNodeId, resetState]);
  
  const handleArrowKey = useCallback((direction: 'left' | 'right' | 'up' | 'down') => {
    const state = stateRef.current;
    
    if (state.phase === 'source-handle' || state.phase === 'target-handle') {
      // Navigate between handles
      if (state.focusedHandleId) {
        const nextHandleId = getNextHandle(state.focusedHandleId, direction);
        setFocusedHandleId(nextHandleId);
      }
    } else if (state.phase === 'source-node' || state.phase === 'target-node') {
      // Navigate between nodes
      if (state.focusedNodeId) {
        const currentNode = nodes.find(n => n.id === state.focusedNodeId);
        if (currentNode) {
          const currentX = currentNode.position.x + (currentNode.width || 0) / 2;
          const currentY = currentNode.position.y + (currentNode.height || 0) / 2;
          
          // Filter to only include threat model nodes (exclude boundaries)
          const selectableNodes = nodes.filter(
            node => node.type === 'threatModelNode'
          );
          
          // For source-node phase, exclude the current target node
          // For target-node phase, exclude the current source node
          const excludedNodeIds = state.phase === 'source-node' 
            ? [state.targetNodeId].filter(Boolean) as string[]
            : [state.sourceNodeId].filter(Boolean) as string[];
          
          const nextNode = findClosestNodeInDirection(
            currentX,
            currentY,
            direction,
            selectableNodes,
            excludedNodeIds
          );
          
          if (nextNode) {
            setFocusedNodeId(nextNode.id);
            // Pan to the node if it's outside the viewport
            if (reactFlowInstance) {
              panToNode(nextNode, reactFlowInstance);
            }
          }
        }
      }
    }
  }, [nodes]);
  
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't process if in editing mode
      if (isEditingMode) return;
      
      const state = stateRef.current;
      
      // Start data flow reconnection with 'd' key when an edge is selected
      if (event.key === 'd' && state.phase === 'idle') {
        const selectedEdge = edges.find(edge => edge.selected);
        if (selectedEdge) {
          event.preventDefault();
          startPhase1();
        }
        return;
      }
      
      // Only process other keys if we're in an active phase
      if (state.phase === 'idle') return;
      
      // Handle escape key - cancel entire process
      if (event.key === 'Escape') {
        event.preventDefault();
        resetState();
        return;
      }
      
      // Handle backspace - go back to previous phase
      if (event.key === 'Backspace') {
        event.preventDefault();
        goBackPhase();
        return;
      }
      
      // Handle enter key - confirm current phase
      if (event.key === 'Enter') {
        event.preventDefault();
        
        switch (state.phase) {
          case 'source-node':
            if (state.focusedNodeId) {
              confirmPhase1();
            }
            break;
          case 'source-handle':
            if (state.focusedHandleId) {
              confirmPhase2();
            }
            break;
          case 'target-node':
            if (state.focusedNodeId) {
              confirmPhase3();
            }
            break;
          case 'target-handle':
            if (state.focusedHandleId) {
              confirmPhase4();
            }
            break;
        }
        return;
      }
      
      // Handle arrow keys - navigate within current phase
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        
        const direction = event.key.replace('Arrow', '').toLowerCase() as 'left' | 'right' | 'up' | 'down';
        handleArrowKey(direction);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    isEditingMode,
    edges,
    startPhase1,
    confirmPhase1,
    confirmPhase2,
    confirmPhase3,
    confirmPhase4,
    goBackPhase,
    resetState,
    handleArrowKey,
  ]);
  
  // Visual feedback: highlight focused node during node selection phases
  useEffect(() => {
    if ((phase === 'source-node' || phase === 'target-node') && focusedNodeId) {
      setNodes((currentNodes) =>
        currentNodes.map((node) => ({
          ...node,
          data: {
            ...node.data,
            isFocusedForConnection: node.id === focusedNodeId,
          },
        }))
      );
    } else {
      // Clear focus highlighting when not in node selection phases
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.data?.isFocusedForConnection) {
            return {
              ...node,
              data: {
                ...node.data,
                isFocusedForConnection: false,
              },
            };
          }
          return node;
        })
      );
    }
  }, [phase, focusedNodeId, setNodes]);
  
  return {
    reconnectionState: {
      phase,
      edgeId,
      sourceNodeId,
      sourceHandleId,
      targetNodeId,
      targetHandleId,
      focusedNodeId,
      focusedHandleId,
    },
    cancelReconnection: resetState,
  };
}
