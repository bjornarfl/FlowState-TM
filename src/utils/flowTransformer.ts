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
 * Calculate nesting levels for z-index
 * Boundaries with more components get lower z-index (render behind)
 * @param boundaries - Array of boundaries
 * @returns Map of boundary ref to nesting level
 */
function calculateNestingLevels(boundaries: Boundary[]): Map<string, number> {
  const levels = new Map<string, number>();
  
  // Sort boundaries by component count (ascending)
  // Smaller boundaries should be on top (lower level number = less negative z-index)
  const sorted = [...boundaries].sort((a, b) => 
    (a.components?.length || 0) - (b.components?.length || 0)
  );
  
  // Assign levels: smaller boundaries get lower level numbers (less negative z-index, renders on top)
  sorted.forEach((boundary, index) => {
    levels.set(boundary.ref, index);
  });
  
  return levels;
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
  const nestingLevels = calculateNestingLevels(boundaries);

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

    const nestingLevel = nestingLevels.get(boundary.ref) || 0;

    return {
      id: boundary.ref,
      type: 'boundaryNode',
      position,
      selectable: true,
      style: {
        width: size.width,
        height: size.height,
        zIndex: -(nestingLevel + 1) * 10, // Larger boundaries have lower (more negative) z-index
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

  // Merge boundaries and components into nodes array
  // Boundaries should be rendered first (they're in the back due to z-index)
  const nodes = [...boundaries, ...components];

  return { nodes, edges };
}
