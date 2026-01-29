/**
 * Custom hook for managing threat model state, diagram nodes/edges, and YAML synchronization
 * Consolidates state management logic from ThreatModelEditor
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { produce } from 'immer';
import type { ThreatModel, ComponentType, Direction } from '../types/threatModel';
import { updateYamlField, updateYamlTopLevelField, updateYamlOptionalTopLevelField, renameDataFlowRef } from '../utils/yamlParser';
import { generateDataFlowRef } from '../utils/refGenerators';
import { createSimpleFieldHandler, createArrayFieldHandler } from '../utils/handlerFactory';
import { useUndoRedo } from './useUndoRedo';
import type { StateSnapshot } from './useUndoRedo';

export interface UseThreatModelStateResult {
  // State
  nodes: any[];
  edges: any[];
  threatModel: ThreatModel | null;
  yamlContent: string;
  isDraggingEdge: boolean;
  isDraggingNode: string | null;
  isEditingMode: boolean;
  
  // Setters
  setNodes: React.Dispatch<React.SetStateAction<any[]>>;
  setEdges: React.Dispatch<React.SetStateAction<any[]>>;
  setThreatModel: React.Dispatch<React.SetStateAction<ThreatModel | null>>;
  setYamlContent: React.Dispatch<React.SetStateAction<string>>;
  setIsDraggingEdge: React.Dispatch<React.SetStateAction<boolean>>;
  setIsDraggingNode: React.Dispatch<React.SetStateAction<string | null>>;
  setIsEditingMode: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Refs
  threatModelRef: React.RefObject<ThreatModel | null>;
  nodesRef: React.RefObject<any[]>;
  edgesRef: React.RefObject<any[]>;
  arrowKeyMovedNodesRef: React.RefObject<Set<string>>;
  
  // YAML operations
  updateYaml: (updater: (content: string) => string) => void;
  
  // Undo/Redo
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
  recordState: () => void;
  
  // Simple field handlers (using factory)
  handleAssetNameChange: (ref: string, newName: string) => void;
  handleAssetDescriptionChange: (ref: string, newDescription: string) => void;
  handleThreatNameChange: (ref: string, newName: string) => void;
  handleThreatDescriptionChange: (ref: string, newDescription: string) => void;
  handleControlNameChange: (ref: string, newName: string) => void;
  handleControlDescriptionChange: (ref: string, newDescription: string) => void;
  handleControlStatusChange: (ref: string, newStatus: string | undefined) => void;
  handleControlStatusLinkChange: (ref: string, newStatusLink: string | undefined) => void;
  handleControlStatusNoteChange: (ref: string, newStatusNote: string | undefined) => void;
  
  // Array field handlers (using factory)
  handleThreatAffectedComponentsChange: (ref: string, newComponents: string[]) => void;
  handleThreatAffectedDataFlowsChange: (ref: string, newDataFlows: string[]) => void;
  handleThreatAffectedAssetsChange: (ref: string, newAssets: string[]) => void;
  handleControlMitigatesChange: (ref: string, newThreats: string[]) => void;
  handleControlImplementedInChange: (ref: string, newComponents: string[]) => void;
  
  // Component handlers (with diagram updates)
  handleComponentNameChange: (componentRef: string, newName: string) => void;
  handleComponentTypeChange: (componentRef: string, newType: ComponentType) => void;
  handleComponentDescriptionChange: (componentRef: string, newDescription: string) => void;
  handleComponentAssetsChange: (componentRef: string, newAssets: string[]) => void;
  
  // Boundary handlers
  handleBoundaryNameChange: (boundaryRef: string, newName: string) => void;
  handleBoundaryDescriptionChange: (boundaryRef: string, newDescription: string) => void;
  handleBoundaryResizeEnd: (boundaryRef: string, width: number, height: number) => void;
  
  // Data flow handlers
  handleDataFlowLabelChange: (dataFlowRef: string, newLabel: string) => void;
  handleDataFlowDirectionChange: (dataFlowRef: string, newDirection: Direction) => void;
  handleToggleDirectionAndReverse: (dataFlowRef: string, currentDirection: string) => void;
  
  // Top-level model handlers
  handleThreatModelNameChange: (newName: string) => void;
  handleThreatModelDescriptionChange: (newDescription: string) => void;
}

export function useThreatModelState(): UseThreatModelStateResult {
  // State
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [threatModel, setThreatModel] = useState<ThreatModel | null>(null);
  const [yamlContent, setYamlContent] = useState<string>('');
  const [isDraggingEdge, setIsDraggingEdge] = useState(false);
  const [isDraggingNode, setIsDraggingNode] = useState<string | null>(null);
  const [isEditingMode, setIsEditingMode] = useState(false);
  
  // Refs to access current state without adding them as dependencies
  const threatModelRef = useRef<ThreatModel | null>(null);
  const nodesRef = useRef<any[]>([]);
  const edgesRef = useRef<any[]>([]);
  const yamlContentRef = useRef<string>('');
  const arrowKeyMovedNodesRef = useRef<Set<string>>(new Set());
  
  // Update refs when state changes
  useEffect(() => {
    threatModelRef.current = threatModel;
    nodesRef.current = nodes;
    edgesRef.current = edges;
    yamlContentRef.current = yamlContent;
  }, [threatModel, nodes, edges, yamlContent]);
  
  // Callback to restore state from a snapshot
  const restoreSnapshot = useCallback((snapshot: StateSnapshot) => {
    setThreatModel(snapshot.threatModel);
    setNodes(snapshot.nodes);
    setEdges(snapshot.edges);
    setYamlContent(snapshot.yamlContent);
  }, []);
  
  // Undo/Redo functionality
  const { canUndo, canRedo, undo, redo, recordState, clearHistory } = useUndoRedo(restoreSnapshot);
  
  // Helper to record current state for undo/redo
  const recordCurrentState = useCallback(() => {
    // Clean temporary UI state properties from nodes before recording
    const cleanedNodes = nodesRef.current.map(node => {
      if (node.type === 'threatModelNode' && node.data) {
        const { isFocusedForConnection, focusedHandleId, isInDataFlowCreation, isHandleSelectionMode, ...restData } = node.data;
        return {
          ...node,
          data: restData,
        };
      }
      return node;
    });
    
    recordState({
      threatModel: threatModelRef.current,
      nodes: cleanedNodes,
      edges: edgesRef.current,
      yamlContent: yamlContentRef.current,
    });
  }, [recordState]);
  
  // Record initial state when threat model is first loaded
  const hasRecordedInitialState = useRef(false);
  useEffect(() => {
    if (threatModel && !hasRecordedInitialState.current) {
      recordCurrentState();
      hasRecordedInitialState.current = true;
    }
  }, [threatModel, recordCurrentState]);
  
  // Helper to update YAML content surgically
  const updateYaml = useCallback((updater: (content: string) => string) => {
    setYamlContent((prev) => updater(prev));
  }, []);
  
  // Wrapper function to record state after any handler executes
  const withHistory = useCallback(<T extends any[]>(
    handler: (...args: T) => void
  ): ((...args: T) => void) => {
    return (...args: T) => {
      // Record the current state BEFORE making changes
      recordCurrentState();
      handler(...args);
      // Also record after to capture the new state
      setTimeout(() => {
        recordCurrentState();
      }, 0);
    };
  }, [recordCurrentState]);
  
  // Simple field handlers using factory
  const handleAssetNameChange = useCallback(
    (ref: string, newValue: string) => {
      const handler = withHistory(createSimpleFieldHandler('assets', 'name', setThreatModel, updateYaml, updateYamlField));
      handler(ref, newValue);
    },
    [updateYaml, withHistory]
  );

  const handleAssetDescriptionChange = useCallback(
    (ref: string, newValue: string) => {
      const handler = withHistory(createSimpleFieldHandler('assets', 'description', setThreatModel, updateYaml, updateYamlField));
      handler(ref, newValue);
    },
    [updateYaml, withHistory]
  );

  const handleThreatNameChange = useCallback(
    (ref: string, newValue: string) => {
      const handler = withHistory(createSimpleFieldHandler('threats', 'name', setThreatModel, updateYaml, updateYamlField));
      handler(ref, newValue);
    },
    [updateYaml, withHistory]
  );

  const handleThreatDescriptionChange = useCallback(
    (ref: string, newValue: string) => {
      const handler = withHistory(createSimpleFieldHandler('threats', 'description', setThreatModel, updateYaml, updateYamlField));
      handler(ref, newValue);
    },
    [updateYaml, withHistory]
  );

  const handleControlNameChange = useCallback(
    (ref: string, newValue: string) => {
      const handler = withHistory(createSimpleFieldHandler('controls', 'name', setThreatModel, updateYaml, updateYamlField));
      handler(ref, newValue);
    },
    [updateYaml, withHistory]
  );

  const handleControlDescriptionChange = useCallback(
    (ref: string, newValue: string) => {
      const handler = withHistory(createSimpleFieldHandler('controls', 'description', setThreatModel, updateYaml, updateYamlField));
      handler(ref, newValue);
    },
    [updateYaml, withHistory]
  );

  const handleControlStatusChange = useCallback(
    (ref: string, newValue: string) => {
      const handler = withHistory(createSimpleFieldHandler('controls', 'status', setThreatModel, updateYaml, updateYamlField));
      handler(ref, newValue);
    },
    [updateYaml, withHistory]
  );

  const handleControlStatusLinkChange = useCallback(
    (ref: string, newValue: string) => {
      const handler = withHistory(createSimpleFieldHandler('controls', 'status_link', setThreatModel, updateYaml, updateYamlField));
      handler(ref, newValue);
    },
    [updateYaml, withHistory]
  );

  const handleControlStatusNoteChange = useCallback(
    (ref: string, newValue: string) => {
      const handler = withHistory(createSimpleFieldHandler('controls', 'status_note', setThreatModel, updateYaml, updateYamlField));
      handler(ref, newValue);
    },
    [updateYaml, withHistory]
  );

  // Array field handlers using factory
  const handleThreatAffectedComponentsChange = useCallback(
    (ref: string, newArray: string[]) => {
      const handler = withHistory(createArrayFieldHandler('threats', 'affected_components', setThreatModel, updateYaml, updateYamlField));
      handler(ref, newArray);
    },
    [updateYaml, withHistory]
  );

  const handleThreatAffectedDataFlowsChange = useCallback(
    (ref: string, newArray: string[]) => {
      const handler = withHistory(createArrayFieldHandler('threats', 'affected_data_flows', setThreatModel, updateYaml, updateYamlField));
      handler(ref, newArray);
    },
    [updateYaml, withHistory]
  );

  const handleThreatAffectedAssetsChange = useCallback(
    (ref: string, newArray: string[]) => {
      const handler = withHistory(createArrayFieldHandler('threats', 'affected_assets', setThreatModel, updateYaml, updateYamlField));
      handler(ref, newArray);
    },
    [updateYaml, withHistory]
  );

  const handleControlMitigatesChange = useCallback(
    (ref: string, newArray: string[]) => {
      const handler = withHistory(createArrayFieldHandler('controls', 'mitigates', setThreatModel, updateYaml, updateYamlField));
      handler(ref, newArray);
    },
    [updateYaml, withHistory]
  );

  const handleControlImplementedInChange = useCallback(
    (ref: string, newArray: string[]) => {
      const handler = withHistory(createArrayFieldHandler('controls', 'implemented_in', setThreatModel, updateYaml, updateYamlField));
      handler(ref, newArray);
    },
    [updateYaml, withHistory]
  );
  
  // Component handlers with diagram updates
  const handleComponentNameChange = useCallback((componentRef: string, newName: string): void => {
    withHistory((componentRef: string, newName: string): void => {
      setThreatModel(
        produce((draft) => {
          if (!draft) return;
          const component = draft.components.find((c) => c.ref === componentRef);
          if (component) {
            component.name = newName;
          }
        })
      );

      updateYaml((content) => updateYamlField(content, 'components', componentRef, 'name', newName));

      setNodes((prevNodes) =>
        prevNodes.map((node) =>
          node.id === componentRef
            ? { ...node, data: { ...node.data, label: newName } }
            : node
        )
      );
    })(componentRef, newName);
  }, [updateYaml, withHistory]);

  const handleComponentTypeChange = useCallback((componentRef: string, newType: ComponentType): void => {
    withHistory((componentRef: string, newType: ComponentType): void => {
      setThreatModel(
        produce((draft) => {
          if (!draft) return;
          const component = draft.components.find((c) => c.ref === componentRef);
          if (component) {
            component.component_type = newType;
          }
        })
      );

      updateYaml((content) => updateYamlField(content, 'components', componentRef, 'component_type', newType));

      setNodes((prevNodes) =>
        prevNodes.map((node) =>
          node.id === componentRef
            ? { ...node, data: { ...node.data, componentType: newType } }
            : node
        )
      );
    })(componentRef, newType);
  }, [updateYaml, withHistory]);

  const handleComponentDescriptionChange = useCallback((componentRef: string, newDescription: string): void => {
    withHistory((componentRef: string, newDescription: string): void => {
      setThreatModel(
        produce((draft) => {
          if (!draft) return;
          const component = draft.components.find((c) => c.ref === componentRef);
          if (component) {
            component.description = newDescription;
          }
        })
      );
      updateYaml((content) => updateYamlField(content, 'components', componentRef, 'description', newDescription));
      
      setNodes((prevNodes) =>
        prevNodes.map((node) =>
          node.id === componentRef
            ? { ...node, data: { ...node.data, description: newDescription } }
            : node
        )
      );
    })(componentRef, newDescription);
  }, [updateYaml, withHistory]);

  const handleComponentAssetsChange = useCallback((componentRef: string, newAssets: string[]): void => {
    withHistory((componentRef: string, newAssets: string[]): void => {
      setThreatModel(
        produce((draft) => {
          if (!draft) return;
          const component = draft.components.find((c) => c.ref === componentRef);
          if (component) {
            component.assets = newAssets.length > 0 ? newAssets : undefined;
          }
        })
      );
      updateYaml((content) => updateYamlField(content, 'components', componentRef, 'assets', newAssets.length > 0 ? newAssets : undefined));
      
      setNodes((prevNodes) =>
        prevNodes.map((node) =>
          node.id === componentRef
            ? { ...node, data: { ...node.data, assets: newAssets.length > 0 ? newAssets : undefined } }
            : node
        )
      );
    })(componentRef, newAssets);
  }, [updateYaml, withHistory]);

  const handleBoundaryNameChange = useCallback((boundaryRef: string, newName: string): void => {
    withHistory((boundaryRef: string, newName: string): void => {
      setThreatModel(
        produce((draft) => {
          if (!draft) return;
          const boundary = draft.boundaries?.find((b) => b.ref === boundaryRef);
          if (boundary) {
            boundary.name = newName;
          }
        })
      );

      updateYaml((content) => updateYamlField(content, 'boundaries', boundaryRef, 'name', newName));

      setNodes((prevNodes) =>
        prevNodes.map((node) =>
          node.id === boundaryRef
            ? { ...node, data: { ...node.data, label: newName } }
            : node
        )
      );
    })(boundaryRef, newName);
  }, [updateYaml, withHistory]);

  const handleBoundaryDescriptionChange = useCallback((boundaryRef: string, newDescription: string): void => {
    withHistory((boundaryRef: string, newDescription: string): void => {
      setThreatModel(
        produce((draft) => {
          if (!draft) return;
          const boundary = draft.boundaries?.find((b) => b.ref === boundaryRef);
          if (boundary) {
            boundary.description = newDescription;
          }
        })
      );
      updateYaml((content) => updateYamlField(content, 'boundaries', boundaryRef, 'description', newDescription));
    })(boundaryRef, newDescription);
  }, [updateYaml, withHistory]);

  const handleBoundaryResizeEnd = useCallback((boundaryRef: string, width: number, height: number): void => {
    withHistory((boundaryRef: string, width: number, height: number): void => {
      setThreatModel(
        produce((draft) => {
          if (!draft) return;
          const boundary = draft.boundaries?.find((b) => b.ref === boundaryRef);
          if (boundary) {
            boundary.width = width;
            boundary.height = height;
          }
        })
      );
      
      updateYaml((content) => {
        let updated = updateYamlField(content, 'boundaries', boundaryRef, 'width', width);
        updated = updateYamlField(updated, 'boundaries', boundaryRef, 'height', height);
        return updated;
      });
    })(boundaryRef, width, height);
  }, [updateYaml, withHistory]);

  const handleDataFlowLabelChange = useCallback((dataFlowRef: string, newLabel: string): void => {
    withHistory((dataFlowRef: string, newLabel: string): void => {
      setThreatModel(
        produce((draft) => {
          if (!draft) return;
          const dataFlow = draft.data_flows?.find((f) => f.ref === dataFlowRef);
          if (dataFlow) {
            dataFlow.label = newLabel;
          }
        })
      );

      updateYaml((content) => updateYamlField(content, 'data_flows', dataFlowRef, 'label', newLabel));

      setEdges((prevEdges) =>
        prevEdges.map((edge) =>
          edge.id === dataFlowRef
            ? { ...edge, label: newLabel }
            : edge
        )
      );
    })(dataFlowRef, newLabel);
  }, [updateYaml, withHistory]);

  const handleDataFlowDirectionChange = useCallback((dataFlowRef: string, newDirection: Direction): void => {
    withHistory((dataFlowRef: string, newDirection: Direction): void => {
      const currentDataFlow = threatModelRef.current?.data_flows?.find((f) => f.ref === dataFlowRef);
      if (!currentDataFlow) return;
      
      // Exclude current ref from uniqueness check to avoid seeing itself as a duplicate
      const existingRefs = threatModelRef.current?.data_flows?.filter((f) => f.ref !== dataFlowRef).map((f) => f.ref) || [];
      const newRef = generateDataFlowRef(currentDataFlow.source, currentDataFlow.destination, newDirection, existingRefs);
      const refChanged = newRef !== dataFlowRef;
      
      setThreatModel(
        produce((draft) => {
          if (!draft) return;
          const dataFlow = draft.data_flows?.find((f) => f.ref === dataFlowRef);
          if (dataFlow) {
            dataFlow.direction = newDirection;
            if (refChanged) {
              dataFlow.ref = newRef;
            }
          }
          if (refChanged && draft.threats) {
            draft.threats.forEach((threat) => {
              if (threat.affected_data_flows) {
                threat.affected_data_flows = threat.affected_data_flows.map((ref) =>
                  ref === dataFlowRef ? newRef : ref
                );
              }
            });
          }
        })
      );

      updateYaml((content) => {
        let updated = updateYamlField(content, 'data_flows', dataFlowRef, 'direction', newDirection);
        if (refChanged) {
          updated = renameDataFlowRef(updated, dataFlowRef, newRef);
        }
        return updated;
      });

      setEdges((prevEdges) =>
        prevEdges.map((edge) => {
          if (edge.id === dataFlowRef) {
            const isBidirectional = newDirection === 'bidirectional';
            const updatedId = refChanged ? newRef : edge.id;
            return {
              ...edge,
              id: updatedId,
              data: {
                ...edge.data,
                direction: newDirection,
                edgeRef: updatedId, // Update the stored edge ref
              },
              markerStart: isBidirectional ? { type: 'arrowclosed' } : undefined,
              markerEnd: { type: 'arrowclosed' },
            };
          }
          return edge;
        })
      );
    })(dataFlowRef, newDirection);
  }, [updateYaml, withHistory]);

  const handleToggleDirectionAndReverse = useCallback((dataFlowRef: string, currentDirection: string): void => {
    if (currentDirection !== 'bidirectional') {
      // Just change to bidirectional - reuse existing handler
      handleDataFlowDirectionChange(dataFlowRef, 'bidirectional');
      return;
    }

    // Change to unidirectional AND reverse - needs to be atomic
    withHistory((dataFlowRef: string): void => {
      const currentDataFlow = threatModelRef.current?.data_flows?.find((f) => f.ref === dataFlowRef);
      if (!currentDataFlow) return;

      const newSource = currentDataFlow.destination;
      const newDestination = currentDataFlow.source;
      const newSourcePoint = currentDataFlow.destination_point;
      const newDestinationPoint = currentDataFlow.source_point;
      const newDirection = 'unidirectional';
      
      const existingRefs = threatModelRef.current?.data_flows?.filter((f) => f.ref !== dataFlowRef).map((f) => f.ref) || [];
      const newRef = generateDataFlowRef(newSource, newDestination, newDirection, existingRefs);
      const refChanged = newRef !== dataFlowRef;
      
      setThreatModel(
        produce((draft) => {
          if (!draft) return;
          const dataFlow = draft.data_flows?.find((f) => f.ref === dataFlowRef);
          if (dataFlow) {
            dataFlow.source = newSource;
            dataFlow.destination = newDestination;
            dataFlow.source_point = newSourcePoint;
            dataFlow.destination_point = newDestinationPoint;
            dataFlow.direction = newDirection;
            if (refChanged) {
              dataFlow.ref = newRef;
            }
          }
          if (refChanged && draft.threats) {
            draft.threats.forEach((threat) => {
              if (threat.affected_data_flows) {
                threat.affected_data_flows = threat.affected_data_flows.map((ref) =>
                  ref === dataFlowRef ? newRef : ref
                );
              }
            });
          }
        })
      );

      updateYaml((content) => {
        let updated = updateYamlField(content, 'data_flows', dataFlowRef, 'source', newSource);
        updated = updateYamlField(updated, 'data_flows', dataFlowRef, 'destination', newDestination);
        updated = updateYamlField(updated, 'data_flows', dataFlowRef, 'direction', newDirection);
        if (newSourcePoint !== undefined) {
          updated = updateYamlField(updated, 'data_flows', dataFlowRef, 'source_point', newSourcePoint);
        } else {
          updated = updateYamlField(updated, 'data_flows', dataFlowRef, 'source_point', undefined);
        }
        if (newDestinationPoint !== undefined) {
          updated = updateYamlField(updated, 'data_flows', dataFlowRef, 'destination_point', newDestinationPoint);
        } else {
          updated = updateYamlField(updated, 'data_flows', dataFlowRef, 'destination_point', undefined);
        }
        if (refChanged) {
          updated = renameDataFlowRef(updated, dataFlowRef, newRef);
        }
        return updated;
      });

      setEdges((prevEdges) =>
        prevEdges.map((edge) => {
          if (edge.id === dataFlowRef) {
            const updatedId = refChanged ? newRef : edge.id;
            return {
              ...edge,
              id: updatedId,
              source: newSource,
              target: newDestination,
              sourceHandle: newSourcePoint || undefined,
              targetHandle: newDestinationPoint ? `target-${newDestinationPoint}` : undefined,
              markerStart: undefined,
              markerEnd: { type: 'arrowclosed' },
              data: {
                ...edge.data,
                direction: newDirection,
                edgeRef: updatedId,
              },
            };
          }
          return edge;
        })
      );
    })(dataFlowRef);
  }, [handleDataFlowDirectionChange, updateYaml, withHistory]);

  const handleThreatModelNameChange = useCallback((newName: string): void => {
    withHistory((newName: string): void => {
      setThreatModel(
        produce((draft) => {
          if (draft) {
            draft.name = newName;
          }
        })
      );
      updateYaml((content) => updateYamlTopLevelField(content, 'name', newName));
    })(newName);
  }, [updateYaml, withHistory]);

  const handleThreatModelDescriptionChange = useCallback((newDescription: string): void => {
    withHistory((newDescription: string): void => {
      setThreatModel(
        produce((draft) => {
          if (draft) {
            draft.description = newDescription;
          }
        })
      );
      updateYaml((content) => updateYamlTopLevelField(content, 'description', newDescription));
    })(newDescription);
  }, [updateYaml, withHistory]);

  return {
    // State
    nodes,
    edges,
    threatModel,
    yamlContent,
    isDraggingEdge,
    isDraggingNode,
    isEditingMode,
    
    // Setters
    setNodes,
    setEdges,
    setThreatModel,
    setYamlContent,
    setIsDraggingEdge,
    setIsDraggingNode,
    setIsEditingMode,
    
    // Refs
    threatModelRef,
    nodesRef,
    edgesRef,
    arrowKeyMovedNodesRef,
    
    // YAML operations
    updateYaml,
    
    // Undo/Redo
    canUndo,
    canRedo,
    undo,
    redo,
    clearHistory,
    recordState: recordCurrentState,
    
    // Handlers
    handleAssetNameChange,
    handleAssetDescriptionChange,
    handleThreatNameChange,
    handleThreatDescriptionChange,
    handleControlNameChange,
    handleControlDescriptionChange,
    handleControlStatusChange,
    handleControlStatusLinkChange,
    handleControlStatusNoteChange,
    handleThreatAffectedComponentsChange,
    handleThreatAffectedDataFlowsChange,
    handleThreatAffectedAssetsChange,
    handleControlMitigatesChange,
    handleControlImplementedInChange,
    handleComponentNameChange,
    handleComponentTypeChange,
    handleComponentDescriptionChange,
    handleComponentAssetsChange,
    handleBoundaryNameChange,
    handleBoundaryDescriptionChange,
    handleBoundaryResizeEnd,
    handleDataFlowLabelChange,
    handleDataFlowDirectionChange,
    handleToggleDirectionAndReverse,
    handleThreatModelNameChange,
    handleThreatModelDescriptionChange,
  };
}
