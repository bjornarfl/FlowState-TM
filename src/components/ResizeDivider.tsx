import React, { useCallback, useEffect, useRef } from 'react';
import './ResizeDivider.css';

interface ResizeDividerProps {
  onResize: (width: number) => void;
  minWidth?: number;
  maxWidth?: number;
}

export function ResizeDivider({ onResize, minWidth = 500, maxWidth = 1000 }: ResizeDividerProps): React.JSX.Element {
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

      const newWidth = e.clientX;
      
      // Snap to 50px increments
      const snappedWidth = Math.round(newWidth / 50) * 50;
      
      // Clamp width between min and max
      const clampedWidth = Math.max(minWidth, Math.min(maxWidth, snappedWidth));
      
      onResize(clampedWidth);
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
  }, [onResize, minWidth, maxWidth]);

  return (
    <div 
      className="resize-divider"
      onMouseDown={handleMouseDown}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
    >
      <div className="resize-divider-handle" />
    </div>
  );
}
