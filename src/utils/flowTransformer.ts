/**
 * Transform threat model data into React Flow nodes and edges
 */

import type { Component, DataFlow, ThreatModel, Boundary, ComponentType } from '../types/threatModel';

const DEFAULT_NODE_POSITION = { x: 100, y: 100 };
const NODE_SPACING = 150;
const BOUNDARY_PADDING = 40;
const DEFAULT_BOUNDARY_SIZE = { width: 400, height: 300 };

export interface ThreatModelNodeData {
  label: string;
  ref: string;
  description?: string;
  componentType: string;
  assets: string[];
  availableAssets?: { ref: string; name: string }[];
  isDraggingNode?: boolean;
  initialEditMode?: boolean;
  isFocusedForConnection?: boolean; // Highlight during phase 2 of data flow creation
  focusedHandleId?: string | null; // Which handle is currently focused
  isInDataFlowCreation?: boolean; // Hide selection border during data flow creation
  isHandleSelectionMode?: boolean; // Show all handles during phase 1 or 3
  onNameChange?: (newName: string) => void;
  onEditModeChange?: (isEditing: boolean) => void;
  onTypeChange?: (newType: ComponentType) => void;
  onDescriptionChange?: (newDescription: string) => void;
  onAssetsChange?: (newAssets: string[]) => void;
  onCreateAsset?: (name: string) => string | Promise<string>;
  onSelectNode?: () => void;
}

export interface EditableEdgeData {
  direction?: string;
  label?: string;
  edgeRef?: string; // Store the edge ref for callbacks
  initialEditMode?: boolean; // Start in edit mode (for keyboard trigger)
  onLabelChange?: (edgeRef: string, newLabel: string) => void;
  onEditModeChange?: (isEditing: boolean) => void;
  onDirectionChange?: (edgeRef: string, newDirection: string) => void;
  onToggleDirectionAndReverse?: (edgeRef: string, currentDirection: string) => void;
}

export interface BoundaryNodeData {
  label: string;
  description?: string;
  onNameChange?: (newName: string) => void;
  onEditModeChange?: (isEditing: boolean) => void;
}

/**
 * Calculate bounding box that encompasses all components
 * @param componentRefs - Array of component refs in the boundary
 * @param components - All components with positions
 * @returns Object with x, y, width, height
 */
function calculateBoundingBox(
  componentRefs: string[],
  components: Component[]
): { x: number; y: number; width: number; height: number } | null {
  const componentsInBoundary = components.filter((c) => componentRefs.includes(c.ref));
  
  if (componentsInBoundary.length === 0) {
    return null;
  }

  // Assume nodes have default width and height (approximate from ThreatModelNode)
  const nodeWidth = 140;
  const nodeHeight = 80;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  componentsInBoundary.forEach((component, index) => {
    const x = component.x ?? DEFAULT_NODE_POSITION.x + (index * NODE_SPACING);
    const y = component.y ?? DEFAULT_NODE_POSITION.y + (index * NODE_SPACING);

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + nodeWidth);
    maxY = Math.max(maxY, y + nodeHeight);
  });

  return {
    x: minX - BOUNDARY_PADDING,
    y: minY - BOUNDARY_PADDING,
    width: (maxX - minX) + (BOUNDARY_PADDING * 2),
    height: (maxY - minY) + (BOUNDARY_PADDING * 2),
  };
}

/**
 * Get the area (width × height) of a React Flow node.
 * Used to sort boundary nodes by size for correct DOM ordering.
 * Prefers measured dimensions (updated live during resize) over style dimensions.
 */
function getNodeArea(node: any): number {
  const width = node.measured?.width ?? node.style?.width ?? node.width ?? 0;
  const height = node.measured?.height ?? node.style?.height ?? node.height ?? 0;
  return width * height;
}

/**
 * Sort nodes so that boundaries are ordered by area in the DOM.
 * Bigger boundaries come first (rendered behind smaller ones).
 * Selected boundaries are placed after all other nodes so they render
 * on top, making their resize handles and border fully accessible.
 * Components come after unselected boundaries but before selected ones.
 */
export function sortNodesByRenderOrder(nodes: any[]): any[] {
  const boundaries: any[] = [];
  const others: any[] = [];

  for (const node of nodes) {
    if (node.type === 'boundaryNode') {
      boundaries.push(node);
    } else {
      others.push(node);
    }
  }

  // Split into unselected and selected boundaries
  const unselected = boundaries.filter((n) => !n.selected);
  const selected = boundaries.filter((n) => n.selected);

  // Sort each group by area descending (biggest first → behind in DOM)
  const byAreaDesc = (a: any, b: any) => getNodeArea(b) - getNodeArea(a);
  unselected.sort(byAreaDesc);
  selected.sort(byAreaDesc);

  // Unselected boundaries (back), then components, then selected boundaries (front)
  return [...unselected, ...others, ...selected];
}

/**
 * Transform boundaries into React Flow nodes
 * @param boundaries - Array of boundary objects from threat model
 * @param components - Array of components for position calculation
 * @returns Array of React Flow boundary nodes
 */
export function transformBoundaries(
  boundaries: Boundary[] = [],
  components: Component[] = []
): any[] {
  return boundaries.map((boundary) => {
    // Calculate or use provided dimensions
    let position;
    let size;

    if (boundary.x !== undefined && boundary.y !== undefined && 
        boundary.width !== undefined && boundary.height !== undefined) {
      // Use provided dimensions
      position = { x: boundary.x, y: boundary.y };
      size = { width: boundary.width, height: boundary.height };
    } else {
      // Auto-calculate based on contained components
      const bbox = calculateBoundingBox(boundary.components || [], components);
      if (bbox) {
        position = { x: bbox.x, y: bbox.y };
        size = { width: bbox.width, height: bbox.height };
      } else {
        // No components, use defaults
        position = { x: DEFAULT_NODE_POSITION.x, y: DEFAULT_NODE_POSITION.y };
        size = DEFAULT_BOUNDARY_SIZE;
      }
    }

    return {
      id: boundary.ref,
      type: 'boundaryNode',
      position,
      selectable: true,
      style: {
        width: size.width,
        height: size.height,
      },
      data: {
        label: boundary.name,
        description: boundary.description,
      },
    };
  });
}

/**
 * Transform components into React Flow nodes
 * @param components - Array of component objects from threat model
 * @returns Array of React Flow node objects
 */
export function transformComponents(
  components: Component[] = []
): any[] {
  return components.map((component, index) => {
    // Use provided x,y coordinates or calculate default position
    const position = {
      x: component.x ?? DEFAULT_NODE_POSITION.x + (index * NODE_SPACING),
      y: component.y ?? DEFAULT_NODE_POSITION.y + (index * NODE_SPACING),
    };

    return {
      id: component.ref,
      type: 'threatModelNode',
      position,
      data: {
        label: component.name,
        ref: component.ref,
        description: component.description,
        componentType: component.component_type,
        assets: component.assets || [],
      },
    };
  });
}

/**
 * Transform data flows into React Flow edges
 * @param dataFlows - Array of data flow objects from threat model
 * @param onLabelChange - Callback for label changes
 * @returns Array of React Flow edge objects
 */
export function transformDataFlows(
  dataFlows: DataFlow[] = [],
  onLabelChange?: (flowRef: string, newLabel: string) => void
): any[] {
  const edges: any[] = [];

  dataFlows.forEach((flow) => {
    const baseEdge: any = {
      id: flow.ref,
      type: 'editableEdge',
      source: flow.source,
      target: flow.destination,
      sourceHandle: flow.source_point,
      targetHandle: flow.destination_point ? `target-${flow.destination_point}` : undefined,
      label: flow.label,
      animated: false,
      style: { stroke: '#000', strokeWidth: 3 },
      data: {
        direction: flow.direction,
        label: flow.label,
        onLabelChange: onLabelChange ? (newLabel: string) => onLabelChange(flow.ref, newLabel) : undefined,
      },
    };

    if (flow.direction === 'bidirectional') {
      // For bidirectional flows, show arrows on both ends
      edges.push({
        ...baseEdge,
        style: { stroke: '#000', strokeWidth: 2 },
        markerStart: { type: 'arrowclosed' },
        markerEnd: { type: 'arrowclosed' },
      });
    } else {
      // Unidirectional flow
      edges.push({
        ...baseEdge,
        style: { stroke: '#000', strokeWidth: 2 },
        markerEnd: { type: 'arrowclosed' },
      });
    }
  });

  return edges;
}

/**
 * Transform complete threat model into React Flow format
 * @param threatModel - Parsed threat model object
 * @param onLabelChange - Callback for data flow label changes
 * @returns Object with nodes and edges arrays
 */
export function transformThreatModel(
  threatModel: ThreatModel,
  onLabelChange?: (flowRef: string, newLabel: string) => void
): { nodes: any[]; edges: any[] } {
  const boundaries = transformBoundaries(threatModel.boundaries, threatModel.components);
  const components = transformComponents(threatModel.components);
  const edges = transformDataFlows(threatModel.data_flows, onLabelChange);

  // Sort nodes so boundaries are ordered by area (biggest first = behind in DOM)
  // and components always come after all boundaries
  const nodes = sortNodesByRenderOrder([...boundaries, ...components]);

  return { nodes, edges };
}
