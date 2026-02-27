/**
 * Utility for attaching callbacks to transformed React Flow nodes and edges.
 *
 * This eliminates the ~45-line block that was duplicated 9 times in
 * ThreatModelEditor.tsx.  The function is a pure data transform — it takes
 * already-transformed nodes/edges (from `transformThreatModel`) and a bag of
 * handler references, and returns new arrays with the callbacks wired in.
 */

import type { ThreatModel, ComponentType, Direction } from '../types/threatModel';

// ── Handler interface ────────────────────────────────────────────────

export interface NodeEdgeCallbackHandlers {
  handleComponentNameChange: (componentRef: string, newName: string) => void;
  handleEditModeChange: (isEditing: boolean) => void;
  handleComponentTypeChange: (componentRef: string, newType: ComponentType) => void;
  handleComponentDescriptionChange: (componentRef: string, newDescription: string) => void;
  handleComponentAssetsChange: (componentRef: string, newAssets: string[]) => void;
  handleCreateAsset: (name: string) => string | Promise<string>;
  handleSelectNode: (nodeId: string) => void;
  handleBoundaryNameChange: (boundaryRef: string, newName: string) => void;
  handleBoundaryResizeEnd: (boundaryRef: string, width: number, height: number, x: number, y: number) => void;
  handleDataFlowLabelChange: (dataFlowRef: string, newLabel: string) => void;
  handleDataFlowDirectionChange: (dataFlowRef: string, newDirection: Direction) => void;
  handleToggleDirectionAndReverse: (dataFlowRef: string, currentDirection: string) => void;
}

// ── Core function ────────────────────────────────────────────────────

/**
 * Attach interactive callbacks to nodes and edges produced by
 * `transformThreatModel`.
 *
 * @param transformedNodes - Nodes returned by `transformThreatModel`
 * @param transformedEdges - Edges returned by `transformThreatModel`
 * @param model           - The parsed threat model (used for `availableAssets`)
 * @param handlers        - Stable callback references from the editor component
 * @returns `{ nodes, edges }` with callbacks attached to `data`
 */
export function addCallbacksToNodesAndEdges(
  transformedNodes: any[],
  transformedEdges: any[],
  model: ThreatModel,
  handlers: NodeEdgeCallbackHandlers,
): { nodes: any[]; edges: any[] } {
  const {
    handleComponentNameChange,
    handleEditModeChange,
    handleComponentTypeChange,
    handleComponentDescriptionChange,
    handleComponentAssetsChange,
    handleCreateAsset,
    handleSelectNode,
    handleBoundaryNameChange,
    handleBoundaryResizeEnd,
    handleDataFlowLabelChange,
    handleDataFlowDirectionChange,
    handleToggleDirectionAndReverse,
  } = handlers;

  const nodes = transformedNodes.map((node) => {
    if (node.type === 'threatModelNode') {
      return {
        ...node,
        data: {
          ...node.data,
          availableAssets: model.assets?.map(a => ({ ref: a.ref, name: a.name })) || [],
          onNameChange: (newName: string) => handleComponentNameChange(node.id, newName),
          onEditModeChange: handleEditModeChange,
          onTypeChange: (newType: ComponentType) => handleComponentTypeChange(node.id, newType),
          onDescriptionChange: (newDescription: string) => handleComponentDescriptionChange(node.id, newDescription),
          onAssetsChange: (newAssets: string[]) => handleComponentAssetsChange(node.id, newAssets),
          onCreateAsset: handleCreateAsset,
          onSelectNode: () => handleSelectNode(node.id),
        },
      };
    } else if (node.type === 'boundaryNode') {
      return {
        ...node,
        data: {
          ...node.data,
          onNameChange: (newName: string) => handleBoundaryNameChange(node.id, newName),
          onEditModeChange: handleEditModeChange,
          onResizeEnd: (width: number, height: number, x: number, y: number) => handleBoundaryResizeEnd(node.id, width, height, x, y),
        },
      };
    }
    return node;
  });

  const edges = transformedEdges.map((edge) => ({
    ...edge,
    data: {
      ...edge.data,
      edgeRef: edge.id,
      onLabelChange: handleDataFlowLabelChange,
      onDirectionChange: handleDataFlowDirectionChange,
      onToggleDirectionAndReverse: handleToggleDirectionAndReverse,
      onEditModeChange: handleEditModeChange,
    },
  }));

  return { nodes, edges };
}
