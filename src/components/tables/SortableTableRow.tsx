import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import DragHandle from './DragHandle';

interface SortableTableRowProps {
  id: string;
  children: React.ReactNode;
}

/**
 * Wrapper component that makes a table row sortable via drag and drop
 * Positions drag handle on the left border, visible on hover
 * Uses setActivatorNodeRef to prevent drag image warping by ensuring only
 * the drag handle triggers the drag operation, not the entire row
 */
export default function SortableTableRow({ id, children }: SortableTableRowProps): React.JSX.Element {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: isDragging ? 'var(--bg-secondary)' : undefined,
    position: 'relative',
  };

  return (
    <tr ref={setNodeRef} style={style} className={`sortable-row ${isDragging ? 'is-dragging' : ''}`}>
      <td className="drag-handle-container">
        <DragHandle
          listeners={listeners}
          attributes={attributes}
          setActivatorNodeRef={setActivatorNodeRef}
        />
      </td>
      {children}
    </tr>
  );
}
