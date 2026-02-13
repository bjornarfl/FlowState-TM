/**
 * Shared utilities for finding canvas elements in specific directions
 * Used by both useCanvasNavigation and useDataFlowCreation hooks
 */

export type NavigationDirection = 'left' | 'right' | 'up' | 'down' | 'up-left' | 'up-right' | 'down-left' | 'down-right';

export interface NavigationOptions {
  minDistance?: number;
  maxTolerance?: number;
  toleranceStep?: number;
}

const DEFAULT_OPTIONS: Required<NavigationOptions> = {
  minDistance: 20,
  maxTolerance: 500,
  toleranceStep: 50,
};

/**
 * Find the closest item in a given direction from a reference position
 * Uses expanding tolerance zones to find items progressively further off-axis
 * Supports both cardinal (up, down, left, right) and diagonal directions
 * 
 * @param currentX - X coordinate of the reference position
 * @param currentY - Y coordinate of the reference position
 * @param direction - Direction to search in
 * @param items - Array of items with x, y positions to search through
 * @param options - Configuration options for the search
 * @returns The closest item in the specified direction, or null if none found
 */
export function findClosestInDirection<T extends { x: number; y: number }>(
  currentX: number,
  currentY: number,
  direction: NavigationDirection,
  items: T[],
  options: NavigationOptions = {}
): T | null {
  const { minDistance, maxTolerance, toleranceStep } = { ...DEFAULT_OPTIONS, ...options };
  
  // Determine if this is a diagonal direction
  const isDiagonal = direction.includes('-');
  
  // Try expanding tolerance zones progressively
  for (let tolerance = toleranceStep; tolerance <= maxTolerance; tolerance += toleranceStep) {
    let closestItem: T | null = null;
    let closestDistance = Infinity;
    
    for (const item of items) {
      const deltaX = item.x - currentX;
      const deltaY = item.y - currentY;
      
      let isInDirection = false;
      let relevantDistance = 0;
      
      if (isDiagonal) {
        // Handle diagonal directions
        const euclideanDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // Calculate the angle to the item
        const angle = Math.atan2(deltaY, deltaX);
        
        // Define target angles for each diagonal direction (in radians)
        let targetAngle: number;
        switch (direction) {
          case 'up-right':
            targetAngle = -Math.PI / 4; // -45 degrees
            break;
          case 'down-right':
            targetAngle = Math.PI / 4; // 45 degrees
            break;
          case 'down-left':
            targetAngle = 3 * Math.PI / 4; // 135 degrees
            break;
          case 'up-left':
            targetAngle = -3 * Math.PI / 4; // -135 degrees
            break;
          default:
            targetAngle = 0;
        }
        
        // Calculate angular difference
        let angleDiff = Math.abs(angle - targetAngle);
        // Normalize angle difference to be within [0, PI]
        if (angleDiff > Math.PI) {
          angleDiff = 2 * Math.PI - angleDiff;
        }
        
        // Angular tolerance increases with distance tolerance
        const angularTolerance = (Math.PI / 6) + (tolerance / 500) * (Math.PI / 6);
        
        // Item must be within angular tolerance and meet minimum distance
        isInDirection = angleDiff <= angularTolerance && euclideanDistance >= minDistance;
        relevantDistance = euclideanDistance;
      } else {
        // Handle cardinal directions
        switch (direction) {
          case 'left':
          case 'right': {
            const primaryDistance = Math.abs(deltaX);
            const absPerpendicularDistance = Math.abs(deltaY);
            
            const isHorizontallyInDirection = direction === 'left' ? deltaX < 0 : deltaX > 0;
            const meetsMinDistance = primaryDistance >= minDistance;
            const withinPerpendicularTolerance = absPerpendicularDistance <= tolerance;
            
            isInDirection = isHorizontallyInDirection && meetsMinDistance && withinPerpendicularTolerance;
            relevantDistance = primaryDistance;
            break;
          }
          case 'up':
          case 'down': {
            const primaryDistance = Math.abs(deltaY);
            const absPerpendicularDistance = Math.abs(deltaX);
            
            const isVerticallyInDirection = direction === 'up' ? deltaY < 0 : deltaY > 0;
            const meetsMinDistance = primaryDistance >= minDistance;
            const withinPerpendicularTolerance = absPerpendicularDistance <= tolerance;
            
            isInDirection = isVerticallyInDirection && meetsMinDistance && withinPerpendicularTolerance;
            relevantDistance = primaryDistance;
            break;
          }
        }
      }
      
      if (isInDirection && relevantDistance < closestDistance) {
        closestItem = item;
        closestDistance = relevantDistance;
      }
    }
    
    if (closestItem) {
      return closestItem;
    }
  }
  
  return null;
}

/**
 * Find the closest node in a given direction, with position calculated from node center
 * 
 * @param currentX - X coordinate of the reference position
 * @param currentY - Y coordinate of the reference position
 * @param direction - Direction to search in
 * @param nodes - Array of nodes to search (must have position, width, height properties)
 * @param excludeIds - Optional array of node IDs to exclude from the search
 * @param options - Configuration options for the search
 * @returns The closest node in the specified direction, or null if none found
 */
export function findClosestNodeInDirection(
  currentX: number,
  currentY: number,
  direction: NavigationDirection,
  nodes: any[],
  excludeIds: string[] = [],
  options: NavigationOptions = {}
): any | null {
  // Filter nodes and convert to items with x, y positions
  const items = nodes
    .filter(node => !excludeIds.includes(node.id))
    .map(node => ({
      node,
      x: node.position.x + (node.width || 0) / 2,
      y: node.position.y + (node.height || 0) / 2,
    }));
  
  const result = findClosestInDirection(currentX, currentY, direction, items, options);
  return result?.node || null;
}

/**
 * Find an unoccupied position near the target position
 * Checks if any existing node is too close and applies an offset if needed
 * Uses rectangular collision detection to account for node dimensions
 * 
 * @param targetX - Desired X coordinate
 * @param targetY - Desired Y coordinate
 * @param nodes - Array of existing nodes to check against
 * @param nodeWidth - Width of the node being placed (default: 140)
 * @param nodeHeight - Height of the node being placed (default: 80)
 * @param marginX - Minimum horizontal distance between nodes (default: 30)
 * @param marginY - Minimum vertical distance between nodes (default: 30)
 * @returns An unoccupied position near the target
 */
export function findUnoccupiedPosition(
  targetX: number,
  targetY: number,
  nodes: any[],
  nodeWidth: number = 140,
  nodeHeight: number = 80,
  marginX: number = -10,
  marginY: number = -20
): { x: number; y: number } {
  // Collision padding: positive = require gap, 0 = allow touching, negative = allow overlap
  // This directly adjusts the collision box size
  const collisionPaddingX = -20;
  const collisionPaddingY = -20;
  // Calculate offset steps based on actual dimensions and margins
  // Horizontal step needs to account for node width + margins
  const offsetStepX = nodeWidth + marginX * 2;
  // Vertical step - use a smaller multiplier for tighter vertical spacing
  const offsetStepY = nodeHeight + marginY * 2;
  
  let x = targetX;
  let y = targetY;
  const maxAttempts = 21; // Prevent infinite loops
  
  // Simple offset pattern: try positions in a grid pattern radiating from center
  // Prefer vertical (down/up) over horizontal (left/right)
  const offsets: [number, number][] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
    [1, 2],
    [0, 2],
    [-1, 2],
    [-1, -2],
    [0, -2],
    [1, -2],
    [1, 3],
    [0, 3],
    [-1, 3],
    [-1, -3],
    [0, -3],
    [1, -3], 
  ];
  
  for (let i = 0; i < offsets.length && i < maxAttempts; i++) {
    x = targetX + offsets[i][0] * offsetStepX;
    y = targetY + offsets[i][1] * offsetStepY;
    
    // Check if any node overlaps with this position using AABB collision detection
    const hasCollision = nodes.some(node => {
      // Skip boundary nodes - components are meant to overlap/be contained by boundaries
      if (node.type === 'boundaryNode') {
        return false;
      }
      
      // Get dimensions of existing node (with fallbacks for components and boundaries)
      const existingWidth = node.style?.width || (node.type === 'boundaryNode' ? 150 : 140);
      const existingHeight = node.style?.height || (node.type === 'boundaryNode' ? 75 : 80);
      
      const newNodeLeft = x - collisionPaddingX;
      const newNodeRight = x + nodeWidth + collisionPaddingX;
      const newNodeTop = y - collisionPaddingY;
      const newNodeBottom = y + nodeHeight + collisionPaddingY;
      
      const existingNodeLeft = node.position.x - collisionPaddingX;
      const existingNodeRight = node.position.x + existingWidth + collisionPaddingX;
      const existingNodeTop = node.position.y - collisionPaddingY;
      const existingNodeBottom = node.position.y + existingHeight + collisionPaddingY;
      
      // Standard AABB overlap check
      const overlapsX = newNodeLeft < existingNodeRight && newNodeRight > existingNodeLeft;
      const overlapsY = newNodeTop < existingNodeBottom && newNodeBottom > existingNodeTop;

      return overlapsX && overlapsY;
    });
    
    if (!hasCollision) {
      // Found an unoccupied position
      return { x, y };
    }
  }
  
  // If we couldn't find a spot, just use the original position

  x = targetX;
  y = targetY;
  return { x, y };
}
