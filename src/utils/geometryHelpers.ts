/**
 * Pure geometry helper functions for canvas operations.
 * These have zero dependencies on React or component state.
 */

/**
 * Check if a component node's center is inside a boundary node's bounds.
 * Uses fixed component dimensions (140×80) and reads boundary dimensions
 * from measured, direct props, or style in that priority order.
 */
export function isComponentInsideBoundary(
  componentNode: any,
  boundaryNode: any
): boolean {
  if (!componentNode || !boundaryNode) return false;

  const componentPosition = componentNode.position;
  const nodeWidth = 140;
  const nodeHeight = 80;

  const boundaryPosition = boundaryNode.position;
  // Check multiple possible locations for boundary dimensions (measured, direct props, or style)
  const boundaryWidth = boundaryNode.measured?.width ?? boundaryNode.width ?? boundaryNode.style?.width ?? 0;
  const boundaryHeight = boundaryNode.measured?.height ?? boundaryNode.height ?? boundaryNode.style?.height ?? 0;

  const boundaryBounds = {
    left: boundaryPosition.x,
    right: boundaryPosition.x + boundaryWidth,
    top: boundaryPosition.y,
    bottom: boundaryPosition.y + boundaryHeight,
  };

  // Check if component center is inside boundary
  const componentCenterX = componentPosition.x + nodeWidth / 2;
  const componentCenterY = componentPosition.y + nodeHeight / 2;

  return (
    componentCenterX >= boundaryBounds.left &&
    componentCenterX <= boundaryBounds.right &&
    componentCenterY >= boundaryBounds.top &&
    componentCenterY <= boundaryBounds.bottom
  );
}
