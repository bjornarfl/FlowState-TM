import React from 'react';
import './DragHandle.css';

interface DragHandleProps {
  listeners?: Record<string, any>;
  attributes?: Record<string, any>;
  setActivatorNodeRef?: (element: HTMLElement | null) => void;
}

/**
 * Drag handle component for table rows
 * Displays a grip icon that can be used to drag and reorder rows
 */
export default function DragHandle({ listeners, attributes, setActivatorNodeRef }: DragHandleProps): React.JSX.Element {
  return (
    <button
      ref={setActivatorNodeRef}
      className="drag-handle"
      type="button"
      aria-label="Drag to reorder"
      {...listeners}
      {...attributes}
    >
      <svg width="12" height="16" viewBox="0 0 12 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="3" cy="3" r="1.5" fill="currentColor" />
        <circle cx="9" cy="3" r="1.5" fill="currentColor" />
        <circle cx="3" cy="8" r="1.5" fill="currentColor" />
        <circle cx="9" cy="8" r="1.5" fill="currentColor" />
        <circle cx="3" cy="13" r="1.5" fill="currentColor" />
        <circle cx="9" cy="13" r="1.5" fill="currentColor" />
      </svg>
    </button>
  );
}
