import { useState, useEffect, RefObject } from 'react';

interface PortalPosition {
  top: number;
  left: number;
  width: number;
  maxWidth: number;
  renderUpward: boolean;
  horizontalAlign: 'left' | 'right' | 'center';
}

interface PortalOptions {
  estimatedHeight: number;
  estimatedWidth?: number;
  minWidth?: number;
  padding?: number;
}

/**
 * Hook to calculate optimal portal position relative to a trigger element.
 * Automatically determines positioning in both vertical and horizontal dimensions
 * to keep the portal within the viewport.
 * 
 * @param isOpen - Whether the portal is currently open
 * @param triggerRef - Ref to the element that triggers the portal
 * @param options - Configuration options for portal sizing and spacing
 * @returns Position object with coordinates, dimensions, and alignment flags
 */
export function usePortalPosition(
  isOpen: boolean,
  triggerRef: RefObject<HTMLElement | null>,
  options: number | PortalOptions
): PortalPosition {
  // Handle backward compatibility with number parameter
  const {
    estimatedHeight,
    estimatedWidth = 320,
    minWidth = 320,
    padding = 16
  } = typeof options === 'number' 
    ? { estimatedHeight: options, estimatedWidth: 320, minWidth: 320, padding: 16 }
    : options;

  const [position, setPosition] = useState<PortalPosition>({
    top: 0,
    left: 0,
    width: 0,
    maxWidth: 0,
    renderUpward: false,
    horizontalAlign: 'left',
  });

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      // Vertical positioning logic
      const spaceBelow = viewportHeight - rect.bottom - padding;
      const spaceAbove = rect.top - padding;
      const renderUpward = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

      // Horizontal positioning logic
      const spaceRight = viewportWidth - rect.left - padding;
      const spaceLeft = rect.right - padding;

      let horizontalAlign: 'left' | 'right' | 'center' = 'left';
      let leftPos = rect.left;
      let maxWidth = viewportWidth - padding * 2;

      // Check if popout fits when aligned to trigger's left edge
      if (spaceRight >= estimatedWidth) {
        horizontalAlign = 'left';
        leftPos = Math.max(padding, rect.left); // Respect padding
        maxWidth = Math.min(spaceRight, estimatedWidth);
      }
      // Check if popout fits better when aligned to trigger's right edge
      else if (spaceLeft >= estimatedWidth) {
        horizontalAlign = 'right';
        const popoutWidth = Math.min(spaceLeft, estimatedWidth);
        leftPos = Math.max(padding, rect.right - popoutWidth); // Respect padding
        maxWidth = popoutWidth;
      }
      // Center align if it doesn't fit on either side
      else {
        horizontalAlign = 'center';
        const popoutWidth = Math.min(estimatedWidth, viewportWidth - padding * 2);
        leftPos = Math.max(padding, rect.left + rect.width / 2 - popoutWidth / 2);
        // Ensure it doesn't go off the right edge
        leftPos = Math.min(leftPos, viewportWidth - popoutWidth - padding);
        maxWidth = popoutWidth;
      }

      setPosition({
        top: renderUpward ? rect.top : rect.bottom,
        left: leftPos,
        width: Math.max(rect.width, minWidth),
        maxWidth,
        renderUpward,
        horizontalAlign,
      });
    }
  }, [isOpen, estimatedHeight, estimatedWidth, minWidth, padding, triggerRef]);

  return position;
}
