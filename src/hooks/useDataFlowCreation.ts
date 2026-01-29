/**
 * Custom hook for creating data flows using keyboard navigation
 * Implements a multi-phase process:
 * - Phase 1: Select source handle from currently selected node
 * - Phase 2: Select target node
 * - Phase 3: Select target handle from target node
 * - Creates the data flow connection on completion
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { findClosestNode, HANDLES, getNextHandle, panToNode } from './useCanvasNavigation';
import { findClosestNodeInDirection } from '../utils/navigationHelpers';

export type DataFlowCreationPhase = 'idle' | 'source-handle' | 'target-node' | 'target-handle';

interface UseDataFlowCreationParams {
  nodes: any[];
  edges: any[];
  setNodes: React.Dispatch<React.SetStateAction<any[]>>;
  isEditingMode: boolean;
  onConnect: (connection: any) => void;
  reactFlowInstance?: any;
}

export interface DataFlowCreationState {
  phase: DataFlowCreationPhase;
  sourceNodeId: string | null;
  sourceHandleId: string | null;
  focusedHandleId: string | null;
  targetNodeId: string | null;
  focusedNodeId: string | null;
}

export interface UseDataFlowCreationResult {
  creationState: DataFlowCreationState;
  cancelCreation: () => void;
}

export function useDataFlowCreation({
  nodes,
  isEditingMode,
  onConnect,
  setNodes,
  reactFlowInstance,
}: UseDataFlowCreationParams): UseDataFlowCreationResult {
  const [phase, setPhase] = useState<DataFlowCreationPhase>('idle');
  const [sourceNodeId, setSourceNodeId] = useState<string | null>(null);
  const [sourceHandleId, setSourceHandleId] = useState<string | null>(null);
  const [focusedHandleId, setFocusedHandleId] = useState<string | null>(null);
  const [targetNodeId, setTargetNodeId] = useState<string | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  
  const stateRef = useRef({ phase, sourceNodeId, sourceHandleId, focusedHandleId, targetNodeId, focusedNodeId });
  
  // Keep ref in sync with state
  useEffect(() => {
    stateRef.current = { phase, sourceNodeId, sourceHandleId, focusedHandleId, targetNodeId, focusedNodeId };
  }, [phase, sourceNodeId, sourceHandleId, focusedHandleId, targetNodeId, focusedNodeId]);
  
  const resetState = useCallback(() => {
    setPhase('idle');
    setSourceNodeId(null);
    setSourceHandleId(null);
    setFocusedHandleId(null);
    setTargetNodeId(null);
    setFocusedNodeId(null);
  }, []);
  
  const startPhase1 = useCallback(() => {
    // Get the currently selected node
    const selectedNode = nodes.find(node => node.selected && node.type === 'threatModelNode');
    if (!selectedNode) return;
    
    // Check if source node would be under the overlay and pan if needed
    if (reactFlowInstance) {
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
        x: selectedNode.position.x,
        y: selectedNode.position.y,
      });
      
      // Node dimensions
      const nodeFlowHeight = selectedNode.measured?.height || selectedNode.height || 100;
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
    
    setPhase('source-handle');
    setSourceNodeId(selectedNode.id);
    setFocusedHandleId(HANDLES[0].id); // Start with first handle
  }, [nodes, reactFlowInstance]);
  
  const confirmPhase1 = useCallback(() => {
    // Move to phase 2 - select target node
    setSourceHandleId(focusedHandleId);
    setPhase('target-node');
    setFocusedHandleId(null);
    
    // Find the closest node to pre-select
    const sourceNode = nodes.find(n => n.id === sourceNodeId);
    if (sourceNode) {
      const sourceX = sourceNode.position.x + (sourceNode.width || 0) / 2;
      const sourceY = sourceNode.position.y + (sourceNode.height || 0) / 2;
      
      const selectableNodes = nodes.filter(
        n => n.id !== sourceNodeId && n.type === 'threatModelNode'
      );
      
      const closestNode = findClosestNode(sourceX, sourceY, selectableNodes, [sourceNodeId!]);
      if (closestNode) {
        setFocusedNodeId(closestNode.id);
      }
    }
  }, [focusedHandleId, sourceNodeId, nodes]);
  
  const confirmPhase2 = useCallback(() => {
    // Move to phase 3 - select target handle
    setTargetNodeId(focusedNodeId);
    setPhase('target-handle');
    setFocusedNodeId(null);
    setFocusedHandleId(HANDLES[0].id); // Start with first handle
  }, [focusedNodeId]);
  
  const confirmPhase3 = useCallback(() => {
    // Create the data flow connection
    if (sourceNodeId && sourceHandleId && targetNodeId && focusedHandleId) {
      // Call onConnect with the connection details
      // Note: React Flow expects target-prefixed handle for target
      onConnect({
        source: targetNodeId,
        target: sourceNodeId,
        sourceHandle: focusedHandleId,
        targetHandle: `target-${sourceHandleId}`,
      });
    }
    
    // Reset state
    resetState();
  }, [sourceNodeId, sourceHandleId, targetNodeId, focusedHandleId, onConnect, resetState]);
  
  const goBackPhase = useCallback(() => {
    switch (phase) {
      case 'source-handle':
        resetState();
        break;
      case 'target-node':
        setPhase('source-handle');
        setSourceHandleId(null);
        setFocusedNodeId(null);
        setFocusedHandleId(sourceHandleId); // Restore previous handle selection
        break;
      case 'target-handle':
        setPhase('target-node');
        setTargetNodeId(null);
        setFocusedHandleId(null);
        setFocusedNodeId(targetNodeId); // Restore previous node selection
        break;
    }
  }, [phase, sourceHandleId, targetNodeId, resetState]);
  
  const handleArrowKey = useCallback((direction: 'left' | 'right' | 'up' | 'down') => {
    const state = stateRef.current;
    
    if (state.phase === 'source-handle' || state.phase === 'target-handle') {
      // Navigate between handles
      if (state.focusedHandleId) {
        const nextHandleId = getNextHandle(state.focusedHandleId, direction);
        setFocusedHandleId(nextHandleId);
      }
    } else if (state.phase === 'target-node') {
      // Navigate between nodes
      if (state.focusedNodeId && state.sourceNodeId) {
        const currentNode = nodes.find(n => n.id === state.focusedNodeId);
        if (currentNode) {
          const currentX = currentNode.position.x + (currentNode.width || 0) / 2;
          const currentY = currentNode.position.y + (currentNode.height || 0) / 2;
          
          // Filter to only include threat model nodes (exclude boundaries)
          const selectableNodes = nodes.filter(
            node => node.type === 'threatModelNode'
          );
          
          const nextNode = findClosestNodeInDirection(
            currentX,
            currentY,
            direction,
            selectableNodes,
            [state.sourceNodeId]
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
      
      // Start data flow creation with 'd' key when a node is selected
      if (event.key === 'd' && state.phase === 'idle') {
        const selectedNode = nodes.find(node => node.selected && node.type === 'threatModelNode');
        if (selectedNode) {
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
          case 'source-handle':
            confirmPhase1();
            break;
          case 'target-node':
            if (state.focusedNodeId) {
              confirmPhase2();
            }
            break;
          case 'target-handle':
            confirmPhase3();
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
    nodes,
    startPhase1,
    confirmPhase1,
    confirmPhase2,
    confirmPhase3,
    goBackPhase,
    resetState,
    handleArrowKey,
  ]);
  
  // Visual feedback: highlight focused node during phase 2
  useEffect(() => {
    if (phase === 'target-node' && focusedNodeId) {
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
      // Clear focus highlighting when not in phase 2
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
    creationState: {
      phase,
      sourceNodeId,
      sourceHandleId,
      focusedHandleId,
      targetNodeId,
      focusedNodeId,
    },
    cancelCreation: resetState,
  };
}
