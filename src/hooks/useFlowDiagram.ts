/**
 * Custom hook for managing ReactFlow diagram interactions (nodes, edges, connections)
 * Handles all node/edge changes, drag events, and connection management
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { produce } from 'immer';
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import type { ThreatModel, Direction } from '../types/threatModel';
import { updateYamlField, appendYamlItem, renameDataFlowRef, removeYamlItem, removeRefFromArrayFields } from '../utils/yamlParser';
import { generateDataFlowRef } from '../utils/refGenerators';
import { findClosestNode, getEdgeLabelPosition } from './useCanvasNavigation';
import { sortNodesByRenderOrder } from '../utils/flowTransformer';

export interface UseFlowDiagramParams {
  threatModel: ThreatModel | null;
  nodes: any[];
  edges: any[];
  setNodes: React.Dispatch<React.SetStateAction<any[]>>;
  setEdges: React.Dispatch<React.SetStateAction<any[]>>;
  setThreatModel: React.Dispatch<React.SetStateAction<ThreatModel | null>>;
  setIsDraggingNode: React.Dispatch<React.SetStateAction<string | null>>;
  setIsEditingMode: React.Dispatch<React.SetStateAction<boolean>>;
  isDraggingNode: string | null;
  threatModelRef: React.RefObject<ThreatModel | null>;
  nodesRef: React.RefObject<any[]>;
  edgesRef: React.RefObject<any[]>;
  arrowKeyMovedNodesRef: React.RefObject<Set<string>>;
  updateYaml: (updater: (content: string) => string) => void;
  updateBoundaryMemberships: (currentNodes: any[]) => void;
  isComponentInsideBoundary: (componentX: number, componentY: number, boundary: any) => boolean;
  handleDataFlowLabelChange: (ref: string, newLabel: string) => void;
  handleDataFlowDirectionChange: (ref: string, newDirection: Direction) => void;
  handleToggleDirectionAndReverse: (dataFlowRef: string, currentDirection: string) => void;
  recordState: () => void;
}

export interface UseFlowDiagramResult {
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
  onNodeDragStop: (_event: any, node: any, nodes: any[]) => void;
  onNodeDragStart: (_event: any, node: any, nodes: any[]) => void;
  onSelectionDragStop: (_event: any, nodes: any[]) => void;
  onSelectionDragStart: (_event: any, nodes: any[]) => void;
  onConnect: (connection: any) => void;
  onReconnect: (oldEdge: any, newConnection: any) => void;
}

export function useFlowDiagram({
  setNodes,
  setEdges,
  setThreatModel,
  setIsDraggingNode,
  setIsEditingMode,
  isDraggingNode,
  recordState,
  threatModelRef,
  nodesRef,
  edgesRef,
  arrowKeyMovedNodesRef,
  updateYaml,
  updateBoundaryMemberships,
  handleDataFlowLabelChange,
  handleDataFlowDirectionChange,
  handleToggleDirectionAndReverse,
}: UseFlowDiagramParams): UseFlowDiagramResult {
  const keyPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordStateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isShiftPressedRef = useRef<boolean>(false);
  const mouseDownPositionRef = useRef<{ x: number; y: number; time: number } | null>(null);
  
  // Track Shift key state and mouse position globally
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey) {
        isShiftPressedRef.current = true;
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.shiftKey) {
        isShiftPressedRef.current = false;
      }
    };
    
    const handleMouseDown = (e: MouseEvent) => {
      mouseDownPositionRef.current = {
        x: e.clientX,
        y: e.clientY,
        time: Date.now(),
      };
    };
    
    const handleMouseUp = () => {
      // Clear after a short delay to allow selection changes to process
      setTimeout(() => {
        mouseDownPositionRef.current = null;
      }, 50);
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);
  
  // Helper to record state with debouncing to avoid duplicate snapshots
  const debouncedRecordState = useCallback(() => {
    // Clear any pending record state timeout
    if (recordStateTimeoutRef.current) {
      clearTimeout(recordStateTimeoutRef.current);
    }
    
    // Schedule state recording after a short delay
    // This allows multiple related changes (node + edge deletions) to complete
    recordStateTimeoutRef.current = setTimeout(() => {
      recordState();
      recordStateTimeoutRef.current = null;
    }, 10);
  }, [recordState]);

  const onNodesChange = useCallback(
    (changes: any) => {
      // Filter out deselection changes when Shift is pressed (multi-select mode)
      // But only if we're likely in a click scenario (not a drag)
      const filteredChanges = isShiftPressedRef.current && mouseDownPositionRef.current
        ? changes.filter((change: any) => {
            // Allow all non-select changes
            if (change.type !== 'select') return true;
            
            // Check if this is likely a click vs a drag
            const mouseDown = mouseDownPositionRef.current;
            const timeSinceMouseDown = Date.now() - (mouseDown?.time || 0);
            
            // If mouse was pressed very recently (within 500ms), assume it's a click
            // This prevents deselection during the click event
            if (timeSinceMouseDown < 500) {
              // Allow selection (selected: true), but block deselection (selected: false)
              return change.selected !== false;
            }
            
            // Otherwise allow all selection changes (it's a drag or box select)
            return true;
          })
        : changes;
      
      // Handle node deletions first (before applying changes)
      const removeChanges = filteredChanges.filter((change: any) => change.type === 'remove');
      if (removeChanges.length > 0) {
        // Record state BEFORE deletion so undo can restore the deleted items
        recordState();
        // Collect all node IDs and their connected edges to be deleted
        const componentIdsToRemove: string[] = [];
        const boundaryIdsToRemove: string[] = [];
        const allConnectedEdgeIds: string[] = [];
        
        for (const change of removeChanges) {
          const nodeId = change.id;
          const node = nodesRef.current.find((n) => n.id === nodeId);
          const nodeType = node?.type;
          
          const connectedEdgeIds = edgesRef.current
            .filter((e) => e.source === nodeId || e.target === nodeId)
            .map((e) => e.id);
          
          if (nodeType === 'threatModelNode') {
            componentIdsToRemove.push(nodeId);
            allConnectedEdgeIds.push(...connectedEdgeIds);
          } else if (nodeType === 'boundaryNode') {
            boundaryIdsToRemove.push(nodeId);
          }
        }
        
        // Batch update threat model state for all deletions at once
        if (componentIdsToRemove.length > 0 || boundaryIdsToRemove.length > 0) {
          setThreatModel(
            produce((draft) => {
              if (!draft) return;
              
              // Remove all components
              if (componentIdsToRemove.length > 0) {
                draft.components = draft.components.filter((c) => !componentIdsToRemove.includes(c.ref));
                
                // Remove connected data flows
                if (draft.data_flows && allConnectedEdgeIds.length > 0) {
                  draft.data_flows = draft.data_flows.filter((df) => !allConnectedEdgeIds.includes(df.ref));
                }
                
                // Remove from boundaries
                draft.boundaries?.forEach((b) => {
                  if (b.components) {
                    b.components = b.components.filter((c) => !componentIdsToRemove.includes(c));
                  }
                });
                
                // Remove component and data flow refs from threats
                draft.threats?.forEach((t) => {
                  if (t.affected_components) {
                    t.affected_components = t.affected_components.filter((c) => !componentIdsToRemove.includes(c));
                  }
                  if (t.affected_data_flows && allConnectedEdgeIds.length > 0) {
                    t.affected_data_flows = t.affected_data_flows.filter((df) => !allConnectedEdgeIds.includes(df));
                  }
                });
                
                // Remove from controls
                draft.controls?.forEach((c) => {
                  if (c.implemented_in) {
                    c.implemented_in = c.implemented_in.filter((comp) => !componentIdsToRemove.includes(comp));
                  }
                });
              }
              
              // Remove all boundaries
              if (boundaryIdsToRemove.length > 0) {
                draft.boundaries = draft.boundaries?.filter((b) => !boundaryIdsToRemove.includes(b.ref));
              }
            })
          );
          
          // Remove connected edges from the visual diagram (single batch)
          if (allConnectedEdgeIds.length > 0) {
            setEdges((eds) => eds.filter((e) => !allConnectedEdgeIds.includes(e.id)));
          }
          
          // Update YAML in a single pass for all deletions
          updateYaml((content) => {
            let updated = content;
            
            // Remove all components and their references
            for (const nodeId of componentIdsToRemove) {
              updated = removeYamlItem(updated, 'components', nodeId);
              updated = removeRefFromArrayFields(updated, nodeId, [
                'components',           // in boundaries
                'affected_components',  // in threats
                'implemented_in',       // in controls
              ]);
            }
            
            // Remove all connected data flows
            for (const edgeId of allConnectedEdgeIds) {
              updated = removeYamlItem(updated, 'data_flows', edgeId);
              updated = removeRefFromArrayFields(updated, edgeId, ['affected_data_flows']);
            }
            
            // Remove all boundaries
            for (const nodeId of boundaryIdsToRemove) {
              updated = removeYamlItem(updated, 'boundaries', nodeId);
            }
            
            return updated;
          });
        }
        
        // After deletion, select the closest node if something was deleted
        if (removeChanges.length > 0) {
          // Get the position of the first deleted item to find the closest remaining node
          const firstDeletedNode = nodesRef.current.find((n) => n.id === removeChanges[0].id);
          if (firstDeletedNode) {
            const deletedX = firstDeletedNode.position.x + (firstDeletedNode.width || 0) / 2;
            const deletedY = firstDeletedNode.position.y + (firstDeletedNode.height || 0) / 2;
            const deletedIds = removeChanges.map((c: any) => c.id);
            
            // Find the closest remaining node
            const remainingNodes = nodesRef.current.filter((n) => !deletedIds.includes(n.id));
            const closestNode = findClosestNode(deletedX, deletedY, remainingNodes, deletedIds);
            
            if (closestNode) {
              // Deselect all edges and select the closest node
              setEdges((currentEdges) =>
                currentEdges.map((edge) => ({
                  ...edge,
                  selected: false,
                }))
              );
              
              // Select the closest node after nodes are updated
              setTimeout(() => {
                setNodes((currentNodes) =>
                  currentNodes.map((node) => ({
                    ...node,
                    selected: node.id === closestNode.id,
                  }))
                );
              }, 0);
            }
          }
        }
      }
      
      setNodes((nodesSnapshot) => {
        let updatedNodes = applyNodeChanges(filteredChanges, nodesSnapshot);
        
        // Re-sort when selection changes so selected boundaries render on top
        const hasSelectionChange = filteredChanges.some((change: any) => change.type === 'select');
        if (hasSelectionChange) {
          updatedNodes = sortNodesByRenderOrder(updatedNodes);
        }
        
        // Check if any change involves a boundary being resized or moved
        const hasBoundaryChange = changes.some((change: any) => {
          if (change.type === 'position' || change.type === 'dimensions') {
            const node = nodesSnapshot.find((n) => n.id === change.id);
            return node?.type === 'boundaryNode';
          }
          return false;
        });

        // If a boundary changed, schedule a membership update
        if (hasBoundaryChange) {
          // Use setTimeout to allow the node changes to be applied first
          setTimeout(() => {
            setNodes((currentNodes) => {
              updateBoundaryMemberships(currentNodes);
              return currentNodes;
            });
          }, 0);
        }

        // Update threat model for dimension and position changes
        filteredChanges.forEach((change: any) => {
          const node = updatedNodes.find((n: any) => n.id === change.id);
          
          // Handle boundary dimension changes
          if (change.type === 'dimensions' && change.dimensions) {
            if (node?.type === 'boundaryNode') {
              // Sync style.width/height so sortNodesByRenderOrder uses current dimensions
              node.style = {
                ...node.style,
                width: change.dimensions.width,
                height: change.dimensions.height,
              };
              setThreatModel(
                produce((draft) => {
                  if (!draft) return;
                  const boundary = draft.boundaries?.find((b) => b.ref === change.id);
                  if (boundary) {
                    boundary.width = change.dimensions.width;
                    boundary.height = change.dimensions.height;
                  }
                })
              );
            }
          }
          
          // Handle position changes for all node types (components and boundaries)
          if (change.type === 'position' && node?.position) {
            // Only update threatModel for arrow key movements (not during drag)
            // For drag operations, the position will be updated in onNodeDragStop
            if (isDraggingNode === null) {
              arrowKeyMovedNodesRef.current.add(change.id);
              
              setThreatModel(
                produce((draft) => {
                  if (!draft) return;
                  
                  // Round position values to nearest integer
                  const x = Math.round(node.position.x);
                  const y = Math.round(node.position.y);
                  
                  // Update component positions
                  const component = draft.components?.find((c) => c.ref === change.id);
                  if (component) {
                    component.x = x;
                    component.y = y;
                  }
                  
                  // Update boundary positions
                  const boundary = draft.boundaries?.find((b) => b.ref === change.id);
                  if (boundary) {
                    boundary.x = x;
                    boundary.y = y;
                  }
                })
              );
            }
          }
        });

        return sortNodesByRenderOrder(updatedNodes);
      });
    },
    [updateBoundaryMemberships, updateYaml, setNodes, setEdges, setThreatModel, isDraggingNode, nodesRef, edgesRef, arrowKeyMovedNodesRef, debouncedRecordState],
  );
  
  const onEdgesChange = useCallback(
    (changes: any) => {
      // Handle edge deletions
      const removeChanges = changes.filter((change: any) => change.type === 'remove');
      if (removeChanges.length > 0) {
        // Record state BEFORE deletion so undo can restore the deleted items
        recordState();
        // Only process edge deletions if they're not part of node deletion
        removeChanges.forEach((change: any) => {
          const edgeId = change.id;
          
          // Remove data flow from threatModel
          setThreatModel(
            produce((draft) => {
              if (!draft) return;
              
              // Remove data flow
              if (draft.data_flows) {
                draft.data_flows = draft.data_flows.filter((df) => df.ref !== edgeId);
              }
              
              // Remove from threats' affected_data_flows
              draft.threats?.forEach((t) => {
                if (t.affected_data_flows) {
                  t.affected_data_flows = t.affected_data_flows.filter((df) => df !== edgeId);
                }
              });
            })
          );
          
          // Update YAML - remove data flow and all references to it
          updateYaml((content) => {
            let updated = removeYamlItem(content, 'data_flows', edgeId);
            updated = removeRefFromArrayFields(updated, edgeId, ['affected_data_flows']);
            return updated;
          });
        });
        
        // After edge deletion, select the closest node
        const firstDeletedEdge = edgesRef.current.find((e) => e.id === removeChanges[0].id);
        if (firstDeletedEdge && nodesRef.current.length > 0) {
          const edgePos = getEdgeLabelPosition(firstDeletedEdge, nodesRef.current);
          const closestNode = findClosestNode(edgePos.x, edgePos.y, nodesRef.current);
          
          if (closestNode) {
            // Deselect all nodes and edges, then select the closest node
            setTimeout(() => {
              setNodes((currentNodes) =>
                currentNodes.map((node) => ({
                  ...node,
                  selected: node.id === closestNode.id,
                }))
              );
              setEdges((currentEdges) =>
                currentEdges.map((edge) => ({
                  ...edge,
                  selected: false,
                }))
              );
            }, 0);
          }
        }
      }
      
      setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot));
    },
    [updateYaml, setEdges, setNodes, setThreatModel, nodesRef, edgesRef, debouncedRecordState],
  );

  // Handle node drag stop to detect boundary membership changes and update YAML
  // The third parameter 'nodes' contains all nodes being dragged (for multi-selection)
  const onNodeDragStop = useCallback(
    (_event: any, node: any, draggedNodes: any[]) => {
      setIsDraggingNode(null);
      // Update memberships for all node types (components or boundaries)
      setNodes((currentNodes) => {
        updateBoundaryMemberships(currentNodes);
        return currentNodes;
      });
      
      // Handle all dragged nodes (could be multiple when selected together)
      const nodesToUpdate = draggedNodes && draggedNodes.length > 0 ? draggedNodes : [node];
      
      if (nodesToUpdate.length === 0 || !nodesToUpdate[0]?.position) return;
      
      // Update threat model state with final positions for all dragged nodes
      setThreatModel(
        produce((draft) => {
          if (!draft) return;
          
          for (const draggedNode of nodesToUpdate) {
            if (!draggedNode?.position) continue;
            const x = Math.round(draggedNode.position.x);
            const y = Math.round(draggedNode.position.y);
            
            const component = draft.components?.find((c) => c.ref === draggedNode.id);
            if (component) {
              component.x = x;
              component.y = y;
            }
            
            const boundary = draft.boundaries?.find((b) => b.ref === draggedNode.id);
            if (boundary) {
              boundary.x = x;
              boundary.y = y;
            }
          }
        })
      );
      
      // Update YAML with the final positions for all dragged nodes in a single pass
      updateYaml((content) => {
        let updated = content;
        for (const draggedNode of nodesToUpdate) {
          if (!draggedNode?.position) continue;
          const x = Math.round(draggedNode.position.x);
          const y = Math.round(draggedNode.position.y);
          const isComponent = draggedNode.type === 'threatModelNode';
          const section = isComponent ? 'components' : 'boundaries';
          
          updated = updateYamlField(updated, section, draggedNode.id, 'x', x);
          updated = updateYamlField(updated, section, draggedNode.id, 'y', y);
        }
        return updated;
      });
      
      // Record state for undo/redo after the node movement is complete
      setTimeout(() => {
        recordState();
      }, 0);
    },
    [updateBoundaryMemberships, updateYaml, setIsDraggingNode, setNodes, setThreatModel, recordState]
  );

  const onNodeDragStart = useCallback(
    (_event: any, node: any, _draggedNodes: any[]) => {
      // Record state BEFORE drag starts so undo can restore the pre-drag positions
      recordState();
      setIsDraggingNode(node.id);
    },
    [setIsDraggingNode, recordState]
  );

  // Handle selection drag stop (when multiple nodes are dragged via selection box)
  const onSelectionDragStop = useCallback(
    (_event: any, selectedNodes: any[]) => {
      setIsDraggingNode(null);
      // Update memberships for all node types
      setNodes((currentNodes) => {
        updateBoundaryMemberships(currentNodes);
        return currentNodes;
      });
      
      if (selectedNodes.length === 0) return;
      
      // Update threat model state with final positions for all selected nodes
      setThreatModel(
        produce((draft) => {
          if (!draft) return;
          
          for (const selectedNode of selectedNodes) {
            if (!selectedNode?.position) continue;
            const x = Math.round(selectedNode.position.x);
            const y = Math.round(selectedNode.position.y);
            
            const component = draft.components?.find((c) => c.ref === selectedNode.id);
            if (component) {
              component.x = x;
              component.y = y;
            }
            
            const boundary = draft.boundaries?.find((b) => b.ref === selectedNode.id);
            if (boundary) {
              boundary.x = x;
              boundary.y = y;
            }
          }
        })
      );
      
      // Update YAML with the final positions for all selected nodes
      updateYaml((content) => {
        let updated = content;
        for (const selectedNode of selectedNodes) {
          if (!selectedNode?.position) continue;
          const x = Math.round(selectedNode.position.x);
          const y = Math.round(selectedNode.position.y);
          const isComponent = selectedNode.type === 'threatModelNode';
          const section = isComponent ? 'components' : 'boundaries';
          
          updated = updateYamlField(updated, section, selectedNode.id, 'x', x);
          updated = updateYamlField(updated, section, selectedNode.id, 'y', y);
        }
        return updated;
      });
      
      // Record state for undo/redo
      setTimeout(() => {
        recordState();
      }, 0);
    },
    [updateBoundaryMemberships, updateYaml, setIsDraggingNode, setNodes, setThreatModel, recordState]
  );

  const onSelectionDragStart = useCallback(
    (_event: any, _selectedNodes: any[]) => {
      // Record state BEFORE drag starts so undo can restore the pre-drag positions
      recordState();
      // Mark that a selection drag is happening
      setIsDraggingNode('selection');
    },
    [setIsDraggingNode, recordState]
  );

  // Update nodes with isDraggingNode state when dragging starts/stops
  // Only update the affected node(s) to minimize re-renders
  useEffect(() => {
    if (isDraggingNode) {
      // Drag started: mark only the dragging node
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === isDraggingNode
            ? { ...node, data: { ...node.data, isDraggingNode: true } }
            : node
        )
      );
    } else {
      // Drag ended: clear isDraggingNode from any node that had it
      setNodes((currentNodes) => {
        const needsUpdate = currentNodes.some((node) => node.data.isDraggingNode);
        if (!needsUpdate) return currentNodes;
        
        return currentNodes.map((node) =>
          node.data.isDraggingNode
            ? { ...node, data: { ...node.data, isDraggingNode: false } }
            : node
        );
      });
    }
  }, [isDraggingNode, setNodes]);

  // Handle arrow key releases to update threat model state and YAML after arrow key movement
  useEffect(() => {
    const handleKeyUp = (event: KeyboardEvent) => {
      // Only process arrow keys
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        return;
      }
      
      // Clear existing timeout
      if (keyPressTimeoutRef.current) {
        clearTimeout(keyPressTimeoutRef.current);
      }
      
      // Set a timeout to update threat model state and YAML after arrow key is released
      // This batches multiple rapid key presses
      keyPressTimeoutRef.current = setTimeout(() => {
        // Update threat model state and YAML for all nodes that were moved
        if (arrowKeyMovedNodesRef.current.size > 0) {
          const movedNodes = Array.from(arrowKeyMovedNodesRef.current);
          
          // Update threat model state with final positions
          setThreatModel(
            produce((draft) => {
              if (!draft) return;
              
              movedNodes.forEach((nodeId) => {
                const node = nodesRef.current.find((n) => n.id === nodeId);
                if (node?.position) {
                  const x = Math.round(node.position.x);
                  const y = Math.round(node.position.y);
                  
                  // Update component positions
                  const component = draft.components?.find((c) => c.ref === nodeId);
                  if (component) {
                    component.x = x;
                    component.y = y;
                  }
                  
                  // Update boundary positions
                  const boundary = draft.boundaries?.find((b) => b.ref === nodeId);
                  if (boundary) {
                    boundary.x = x;
                    boundary.y = y;
                  }
                }
              });
            })
          );
          
          // Update YAML with final positions
          updateYaml((content) => {
            let updated = content;
            
            movedNodes.forEach((nodeId) => {
              const node = nodesRef.current.find((n) => n.id === nodeId);
              if (node?.position) {
                const x = Math.round(node.position.x);
                const y = Math.round(node.position.y);
                const isComponent = node.type === 'threatModelNode';
                const section = isComponent ? 'components' : 'boundaries';
                
                updated = updateYamlField(updated, section, nodeId, 'x', x);
                updated = updateYamlField(updated, section, nodeId, 'y', y);
              }
            });
            
            return updated;
          });
          
          // Clear the set after updating
          arrowKeyMovedNodesRef.current.clear();
        }
      }, 400); // Wait 400ms after key release to batch updates
    };
    
    // Listen for keyup events to detect when arrow keys are released
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keyup', handleKeyUp);
      if (keyPressTimeoutRef.current) {
        clearTimeout(keyPressTimeoutRef.current);
      }
    };
  }, [updateYaml, setThreatModel, nodesRef, arrowKeyMovedNodesRef]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (recordStateTimeoutRef.current) {
        clearTimeout(recordStateTimeoutRef.current);
      }
    };
  }, []);

  // Handle new connections between nodes
  const onConnect = useCallback(
    (connection: any) => {
      // Prevent self-connections (edges connecting a node to itself)
      if (connection.source === connection.target) {
        return;
      }
      
      // Record state BEFORE creating connection so undo can remove it
      recordState();
      
      // React Flow reverses source/target when dragging from source handle to target handle
      // So we need to swap them to get the correct direction
      const actualSource = connection.target;
      const actualDestination = connection.source;
      const actualSourceHandle = connection.targetHandle?.startsWith('target-')
        ? connection.targetHandle.substring(7)
        : connection.targetHandle;
      const actualDestinationHandle = connection.sourceHandle;
      
      // Generate a unique ref for the dataflow
      // Use threatModelRef.current to get the most up-to-date data flows
      const existingRefs = threatModelRef.current?.data_flows?.map((f) => f.ref) || [];
      const dataFlowRef = generateDataFlowRef(actualSource, actualDestination, 'unidirectional', existingRefs);
      
      // Calculate the data flow count for the label
      const dataFlowCount = threatModelRef.current?.data_flows?.length || 0;
      const dataFlowLabel = `DF${dataFlowCount + 1}`;
      
      // Create the new data flow object
      const newDataFlow: Record<string, any> = {
        ref: dataFlowRef,
        source: actualSource,
        destination: actualDestination,
        label: dataFlowLabel,
      };
      if (actualSourceHandle) newDataFlow.source_point = actualSourceHandle;
      if (actualDestinationHandle) newDataFlow.destination_point = actualDestinationHandle;
      newDataFlow.direction = 'unidirectional';
      
      // Create a new dataflow in the threat model
      setThreatModel(
        produce((draft) => {
          if (!draft) return;
          if (!draft.data_flows) {
            draft.data_flows = [];
          }
          draft.data_flows.push(newDataFlow as any);
        })
      );
      
      // Append to YAML
      updateYaml((content) => appendYamlItem(content, 'data_flows', newDataFlow));
      
      // Generate a unique ID for the edge
      const edgeId = dataFlowRef;
      
      // Deselect all nodes
      setNodes((nds) => nds.map((node) => ({ ...node, selected: false })));
      
      // Add the edge to the diagram with proper markers and corrected source/target
      setEdges((eds) => [
        // Deselect all existing edges
        ...eds.map((edge) => ({ ...edge, selected: false })), 
        { 
          id: edgeId,
          source: actualSource,
          target: actualDestination,
          sourceHandle: actualSourceHandle,
          targetHandle: `target-${actualDestinationHandle}`,
          type: 'editableEdge',
          label: dataFlowLabel,
          markerEnd: { type: 'arrowclosed' },
          selected: true, // Select the newly created edge
          data: {
            direction: 'unidirectional',
            label: dataFlowLabel,
            edgeRef: edgeId, // Store the edge ref
            onLabelChange: handleDataFlowLabelChange,
            onDirectionChange: handleDataFlowDirectionChange,
            onToggleDirectionAndReverse: handleToggleDirectionAndReverse,
            onEditModeChange: setIsEditingMode,
          },
        }
      ]);
      
      // Record state for undo/redo after edge creation
      setTimeout(() => {
        recordState();
      }, 0);
    },
    [handleDataFlowLabelChange, handleDataFlowDirectionChange, handleToggleDirectionAndReverse, updateYaml, setThreatModel, setEdges, setNodes, setIsEditingMode, recordState, threatModelRef],
  );

  // Handle edge reconnection
  const onReconnect = useCallback(
    (oldEdge: any, newConnection: any) => {
      // Prevent self-connections (edges connecting a node to itself)
      if (newConnection.source === newConnection.target) {
        return;
      }
      
      // Record state BEFORE reconnecting so undo can restore the old connection
      recordState();
      
      const oldRef = oldEdge.id;
      const newSource = newConnection.source;
      const newTarget = newConnection.target;
      
      // Extract connection points from handles
      const newSourcePoint = newConnection.sourceHandle;
      const newTargetPoint = newConnection.targetHandle?.startsWith('target-')
        ? newConnection.targetHandle.substring(7)
        : newConnection.targetHandle;
      
      // Find the current data flow to get direction for new ref generation
      // Use ref to avoid adding threatModel as dependency
      const currentDataFlow = threatModelRef.current?.data_flows?.find((f) => f.ref === oldRef);
      const direction = currentDataFlow?.direction || 'unidirectional';
      
      // Generate a unique ref, accounting for existing refs (excluding the current one)
      const existingRefs = threatModelRef.current?.data_flows
        ?.filter((f) => f.ref !== oldRef)
        .map((f) => f.ref) || [];
      const newRef = generateDataFlowRef(newSource, newTarget, direction, existingRefs);
      const refChanged = newRef !== oldRef;
      
      // Update edges state with new id and updated callbacks
      setEdges((eds) => eds.filter((e) => e.id !== oldRef).concat({
        ...oldEdge,
        ...newConnection,
        id: newRef,
        data: {
          ...oldEdge.data,
          edgeRef: newRef, // Update the stored edge ref
          onLabelChange: handleDataFlowLabelChange,
          onDirectionChange: handleDataFlowDirectionChange,
          onToggleDirectionAndReverse: handleToggleDirectionAndReverse,
        },
      }));
      
      // Update threatModel state
      setThreatModel(
        produce((draft) => {
          if (!draft) return;
          const dataFlow = draft.data_flows?.find((f) => f.ref === oldRef);
          if (dataFlow) {
            dataFlow.source = newSource;
            dataFlow.destination = newTarget;
            dataFlow.ref = newRef;
            // Update connection points if they changed
            if (newSourcePoint) {
              dataFlow.source_point = newSourcePoint;
            }
            if (newTargetPoint) {
              dataFlow.destination_point = newTargetPoint;
            }
          }
          // Update any references in threats' affected_data_flows
          if (refChanged) {
            draft.threats?.forEach((threat) => {
              if (threat.affected_data_flows) {
                threat.affected_data_flows = threat.affected_data_flows.map((ref) =>
                  ref === oldRef ? newRef : ref
                );
              }
            });
          }
        })
      );
      
      // Update YAML - update source, destination, connection points, and rename ref
      updateYaml((content) => {
        let updated = content;
        if (oldEdge.source !== newSource) {
          updated = updateYamlField(updated, 'data_flows', oldRef, 'source', newSource);
        }
        if (oldEdge.target !== newTarget) {
          updated = updateYamlField(updated, 'data_flows', oldRef, 'destination', newTarget);
        }
        if (oldEdge.sourceHandle !== newSourcePoint && newSourcePoint) {
          updated = updateYamlField(updated, 'data_flows', oldRef, 'source_point', newSourcePoint);
        }
        if ((oldEdge.targetHandle?.substring(7) || oldEdge.targetHandle) !== newTargetPoint && newTargetPoint) {
          updated = updateYamlField(updated, 'data_flows', oldRef, 'destination_point', newTargetPoint);
        }
        if (refChanged) {
          updated = renameDataFlowRef(updated, oldRef, newRef);
        }
        return updated;
      });
    },
    [updateYaml, handleDataFlowLabelChange, handleDataFlowDirectionChange, handleToggleDirectionAndReverse, threatModelRef, setEdges, setThreatModel],
  );

  return {
    onNodesChange,
    onEdgesChange,
    onNodeDragStop,
    onNodeDragStart,
    onSelectionDragStop,
    onSelectionDragStart,
    onConnect,
    onReconnect,
  };
}
