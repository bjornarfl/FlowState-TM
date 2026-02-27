import { useEffect, type RefObject } from 'react';
import type { ComponentType } from '../types/threatModel';

interface SectionCollapseStates {
  isWorkingSectionCollapsed: boolean;
  setIsWorkingSectionCollapsed: (collapsed: boolean) => void;
  isThreatsSectionCollapsed: boolean;
  setIsThreatsSectionCollapsed: (collapsed: boolean) => void;
  isControlsSectionCollapsed: boolean;
  setIsControlsSectionCollapsed: (collapsed: boolean) => void;
  isSummarySectionCollapsed: boolean;
  setIsSummarySectionCollapsed: (collapsed: boolean) => void;
}

interface UseKeyboardShortcutsOptions {
  undo: () => void;
  redo: () => void;
  nodes: any[];
  edges: any[];
  setNodes: (updater: (nodes: any[]) => any[]) => void;
  setEdges: (updater: (edges: any[]) => any[]) => void;
  creationPhase: string;
  isEditingMode: boolean;
  arrowKeyMovedNodesRef: RefObject<Set<string>>;
  quickSaveRef: RefObject<(() => Promise<void>) | null>;
  mousePositionRef: RefObject<{ x: number; y: number }>;
  reactFlowInstanceRef: RefObject<any>;
  sectionCollapseStates: SectionCollapseStates;
  handleAddComponent: (componentType: ComponentType, position?: { x: number; y: number }) => void;
  handleAddBoundary: (position?: { x: number; y: number }) => void;
}

/**
 * Hook that registers all global keyboard shortcuts for the threat model editor:
 * - Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z: undo/redo
 * - Cmd/Ctrl+S: quick save
 * - `-`: toggle all table sections
 * - `e`: enter edit mode on selected node/edge
 * - Arrow keys: move selected nodes
 * - `1`–`4`: create components / boundary at cursor
 */
export function useKeyboardShortcuts({
  undo,
  redo,
  nodes,
  edges,
  setNodes,
  setEdges,
  creationPhase,
  isEditingMode,
  arrowKeyMovedNodesRef,
  quickSaveRef,
  mousePositionRef,
  reactFlowInstanceRef,
  sectionCollapseStates,
  handleAddComponent,
  handleAddBoundary,
}: UseKeyboardShortcutsOptions): void {
  const {
    isWorkingSectionCollapsed,
    setIsWorkingSectionCollapsed,
    isThreatsSectionCollapsed,
    setIsThreatsSectionCollapsed,
    isControlsSectionCollapsed,
    setIsControlsSectionCollapsed,
    isSummarySectionCollapsed,
    setIsSummarySectionCollapsed,
  } = sectionCollapseStates;

  // Keyboard shortcuts for undo/redo, save, section toggles, edit mode, and arrow key movement
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCtrlOrCmd = isMac ? event.metaKey : event.ctrlKey;

      // Check if user is typing in an input/textarea
      const target = event.target as HTMLElement;
      const isEditing =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true';

      if (isCtrlOrCmd && !isEditing) {
        if (event.shiftKey && event.key.toLowerCase() === 'z') {
          // Cmd/Ctrl + Shift + Z = Redo
          event.preventDefault();
          redo();
        } else if (event.key.toLowerCase() === 'z') {
          // Cmd/Ctrl + Z = Undo
          event.preventDefault();
          undo();
        }
      }

      // Cmd/Ctrl + S = Quick save (works even when editing text)
      if (isCtrlOrCmd && event.key.toLowerCase() === 's') {
        event.preventDefault();
        quickSaveRef.current?.();
      }

      // Press '-' to toggle all table sections
      if (event.key === '-' && !isEditing && !isCtrlOrCmd) {
        event.preventDefault();
        // Check if all sections are currently collapsed or expanded
        const allCollapsed =
          isWorkingSectionCollapsed &&
          isThreatsSectionCollapsed &&
          isControlsSectionCollapsed &&
          isSummarySectionCollapsed;
        const allExpanded =
          !isWorkingSectionCollapsed &&
          !isThreatsSectionCollapsed &&
          !isControlsSectionCollapsed &&
          !isSummarySectionCollapsed;

        // If all are collapsed or mixed state, expand all. If all are expanded, collapse all.
        const shouldExpand = allCollapsed || !allExpanded;

        setIsWorkingSectionCollapsed(!shouldExpand);
        setIsThreatsSectionCollapsed(!shouldExpand);
        setIsControlsSectionCollapsed(!shouldExpand);
        setIsSummarySectionCollapsed(!shouldExpand);
      }

      // Press 'e' to start edit mode on selected node or edge
      if (event.key.toLowerCase() === 'e' && !isEditing && !isCtrlOrCmd) {
        const selectedNodes = nodes.filter((node: any) => node.selected);
        const selectedEdges = edges.filter((edge: any) => edge.selected);

        if (selectedNodes.length === 1) {
          event.preventDefault();
          const selectedNode = selectedNodes[0];

          // Trigger edit mode by updating the node data
          setNodes((prevNodes: any[]) =>
            prevNodes.map((node: any) =>
              node.id === selectedNode.id
                ? {
                    ...node,
                    data: {
                      ...node.data,
                      initialEditMode: true,
                    },
                  }
                : node,
            ),
          );

          // Reset initialEditMode after a short delay to allow future toggling
          setTimeout(() => {
            setNodes((prevNodes: any[]) =>
              prevNodes.map((node: any) =>
                node.id === selectedNode.id
                  ? {
                      ...node,
                      data: {
                        ...node.data,
                        initialEditMode: false,
                      },
                    }
                  : node,
              ),
            );
          }, 100);
        } else if (selectedEdges.length === 1) {
          event.preventDefault();
          const selectedEdge = selectedEdges[0];

          // Trigger edit mode by updating the edge data
          setEdges((prevEdges: any[]) =>
            prevEdges.map((edge: any) =>
              edge.id === selectedEdge.id
                ? {
                    ...edge,
                    data: {
                      ...edge.data,
                      initialEditMode: true,
                    },
                  }
                : edge,
            ),
          );

          // Reset initialEditMode after a short delay to allow future toggling
          setTimeout(() => {
            setEdges((prevEdges: any[]) =>
              prevEdges.map((edge: any) =>
                edge.id === selectedEdge.id
                  ? {
                      ...edge,
                      data: {
                        ...edge.data,
                        initialEditMode: false,
                      },
                    }
                  : edge,
              ),
            );
          }, 100);
        }
      }

      // Arrow key movement for selected nodes (but not when alt/option is pressed for navigation or during data flow creation)
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key) &&
        !isEditingMode &&
        !isCtrlOrCmd &&
        !event.altKey &&
        creationPhase === 'idle'
      ) {
        const selectedNodes = nodes.filter((node: any) => node.selected);
        if (selectedNodes.length > 0) {
          event.preventDefault();

          const moveAmount = event.shiftKey ? 25 : 5;
          let deltaX = 0;
          let deltaY = 0;

          switch (event.key) {
            case 'ArrowUp':
              deltaY = -moveAmount;
              break;
            case 'ArrowDown':
              deltaY = moveAmount;
              break;
            case 'ArrowLeft':
              deltaX = -moveAmount;
              break;
            case 'ArrowRight':
              deltaX = moveAmount;
              break;
          }

          setNodes((prevNodes: any[]) =>
            prevNodes.map((node: any) => {
              if (node.selected) {
                // Track that this node was moved via arrow keys
                // The keyup handler in useFlowDiagram will handle updating threat model state and YAML
                arrowKeyMovedNodesRef.current.add(node.id);

                return {
                  ...node,
                  position: {
                    x: node.position.x + deltaX,
                    y: node.position.y + deltaY,
                  },
                };
              }
              return node;
            }),
          );
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    undo,
    redo,
    nodes,
    edges,
    setNodes,
    setEdges,
    creationPhase,
    isEditingMode,
    arrowKeyMovedNodesRef,
    quickSaveRef,
    isWorkingSectionCollapsed,
    isThreatsSectionCollapsed,
    isControlsSectionCollapsed,
    isSummarySectionCollapsed,
    setIsWorkingSectionCollapsed,
    setIsThreatsSectionCollapsed,
    setIsControlsSectionCollapsed,
    setIsSummarySectionCollapsed,
  ]);

  // Keyboard hotkeys for creating components (1-4)
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input, textarea, or contenteditable
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Get the mouse position in flow coordinates
      const getFlowPosition = () => {
        if (!reactFlowInstanceRef.current) return null;

        // Use ReactFlow's built-in screenToFlowPosition method for accurate transformation
        const flowPosition = reactFlowInstanceRef.current.screenToFlowPosition({
          x: mousePositionRef.current.x,
          y: mousePositionRef.current.y,
        });

        // Validate that we got valid numbers, not NaN
        if (isNaN(flowPosition.x) || isNaN(flowPosition.y)) {
          return null;
        }

        // Offset by half the node size to center the node at cursor position
        // Standard node size is approximately 140x80
        return { x: flowPosition.x - 70, y: flowPosition.y - 40 };
      };

      const position = getFlowPosition();

      switch (event.key) {
        case '1':
          event.preventDefault();
          handleAddComponent('internal', position || undefined);
          break;
        case '2':
          event.preventDefault();
          handleAddComponent('external', position || undefined);
          break;
        case '3':
          event.preventDefault();
          handleAddComponent('data_store', position || undefined);
          break;
        case '4':
          event.preventDefault();
          handleAddBoundary(position || undefined);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleAddComponent, handleAddBoundary, mousePositionRef, reactFlowInstanceRef]);
}
