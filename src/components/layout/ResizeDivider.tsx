import React, { useCallback, useEffect, useRef } from 'react';
import './ResizeDivider.css';

interface ResizeDividerProps {
  /** Index of this divider (between tab[index] and tab[index+1]) */
  dividerIndex?: number;
  /** Callback with (dividerIndex, clientX) for tab-based resizing */
  onResizeTab?: (dividerIndex: number, clientX: number) => void;
  /** Legacy: callback with pixel width for single-divider mode */
  onResize?: (width: number) => void;
  minWidth?: number;
  maxWidth?: number;
}

export function ResizeDivider({
  dividerIndex = 0,
  onResizeTab,
  onResize,
  minWidth = 500,
  maxWidth = 1000,
}: ResizeDividerProps): React.JSX.Element {
  const isDraggingRef = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;

      if (onResizeTab) {
        // Tab-based mode: pass raw clientX to the hook
        onResizeTab(dividerIndex, e.clientX);
      } else if (onResize) {
        // Legacy pixel-width mode
        const newWidth = e.clientX;
        const snappedWidth = Math.round(newWidth / 50) * 50;
        const clampedWidth = Math.max(minWidth, Math.min(maxWidth, snappedWidth));
        onResize(clampedWidth);
      }
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onResizeTab, onResize, dividerIndex, minWidth, maxWidth]);

  return (
    <div 
      className="resize-divider"
      onMouseDown={handleMouseDown}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel"
    >
      <div className="resize-divider-handle" />
    </div>
  );
}
