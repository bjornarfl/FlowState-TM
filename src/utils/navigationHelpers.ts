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
