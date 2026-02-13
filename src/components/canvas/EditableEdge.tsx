import React, { useState, useRef, useEffect, ReactNode } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  Position,
} from '@xyflow/react';
import type { EditableEdgeData } from '../../utils/flowTransformer';
import { isDataFlowLabelPlaceholder } from '../../utils/refGenerators';
import './EditableEdge.css';

interface EditableEdgeProps {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition?: Position;
  targetPosition?: Position;
  label?: ReactNode;
  data?: EditableEdgeData;
  selected?: boolean;
}

export default function EditableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  data = {},
  selected,
}: EditableEdgeProps): React.JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const labelString = (label as string | null | undefined) || '';
  const isPlaceholder = isDataFlowLabelPlaceholder(labelString);
  const [editValue, setEditValue] = useState(isPlaceholder ? '' : labelString);
  const { onLabelChange, direction, onEditModeChange, onToggleDirectionAndReverse, edgeRef, initialEditMode } = data;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasProcessedInitialEditMode = useRef(false);

  // Watch for initialEditMode changes to trigger edit mode (only once)
  useEffect(() => {
    if (initialEditMode && !hasProcessedInitialEditMode.current) {
      setIsEditing(true);
      const labelString = (label as string) || '';
      const isPlaceholder = isDataFlowLabelPlaceholder(labelString);
      setEditValue(isPlaceholder ? '' : labelString);
      onEditModeChange?.(true);
      hasProcessedInitialEditMode.current = true;
    }
    // Reset the flag when initialEditMode becomes false
    if (!initialEditMode) {
      hasProcessedInitialEditMode.current = false;
    }
  }, [initialEditMode, label, onEditModeChange]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      // Reset height to auto to get accurate scrollHeight
      textareaRef.current.style.height = 'auto';
      // Get the natural height of the content, accounting for padding
      const scrollHeight = textareaRef.current.scrollHeight;
      // Set the height to match content exactly
      textareaRef.current.style.height = scrollHeight + 'px';
      // Position cursor at the end
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
    }
  }, [isEditing]);

  // Calculate control points to ensure smooth bezier curves
  const CONTROL_OFFSET = 50; // Distance for bezier control points
  
  const getControlPoint = (x: number, y: number, position?: Position, distance: number = CONTROL_OFFSET): { x: number; y: number } => {
    switch (position) {
      case Position.Top:
        return { x, y: y - distance };
      case Position.Bottom:
        return { x, y: y + distance };
      case Position.Left:
        return { x: x - distance, y };
      case Position.Right:
        return { x: x + distance, y };
      default:
        return { x, y };
    }
  };

  // Control points extend from the handles in their respective directions
  const sourceControl = getControlPoint(sourceX, sourceY, sourcePosition);
  const targetControl = getControlPoint(targetX, targetY, targetPosition);

  // Create cubic bezier path with proper control points
  const edgePath = `M ${sourceX},${sourceY} C ${sourceControl.x},${sourceControl.y} ${targetControl.x},${targetControl.y} ${targetX},${targetY}`;
  
  // Calculate label position at the actual midpoint (t=0.5) of the cubic bezier curve
  // Using the cubic bezier formula: B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
  // At t=0.5: B(0.5) = 0.125*P0 + 0.375*P1 + 0.375*P2 + 0.125*P3
  const labelX = 0.125 * sourceX + 0.375 * sourceControl.x + 0.375 * targetControl.x + 0.125 * targetX;
  const labelY = 0.125 * sourceY + 0.375 * sourceControl.y + 0.375 * targetControl.y + 0.125 * targetY;

  const isBidirectional = direction === 'bidirectional';

  // Determine marker IDs based on direction
  const markerStart = isBidirectional ? 'url(#arrowhead-start)' : undefined;
  const markerEnd = isBidirectional ? 'url(#arrowhead-end)' : 'url(#arrowhead)';

  const handleClick = (): void => {
    // Only enter edit mode if edge is already selected
    if (selected) {
      setIsEditing(true);
      const labelString = (label as string) || '';
      const isPlaceholder = isDataFlowLabelPlaceholder(labelString);
      setEditValue(isPlaceholder ? '' : labelString);
      onEditModeChange?.(true);
    }
    // If not selected, the click will propagate and select the edge
  };

  const handleSave = (): void => {
    const labelString = (label as string) || '';
    const isPlaceholder = isDataFlowLabelPlaceholder(labelString);
    const newValueToSave = editValue.trim() ? editValue : labelString;
    
    if (newValueToSave !== label) {
      onLabelChange?.(edgeRef || id, newValueToSave);
    }
    setIsEditing(false);
    onEditModeChange?.(false);
  };

  const handleCancel = (): void => {
    setIsEditing(false);
    onEditModeChange?.(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleToggleDirection = (): void => {
    onToggleDirectionAndReverse?.(edgeRef || id, direction || 'unidirectional');
  };

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerStart={markerStart} markerEnd={markerEnd} />
      <circle r="1.5" fill="#999">
        <animateMotion dur="3s" repeatCount="indefinite" path={edgePath} />
      </circle>
      {isBidirectional && (
        <circle r="1.5" fill="#999">
          <animateMotion
            dur="3s"
            repeatCount="indefinite"
            path={edgePath}
            keyPoints="1;0"
            keyTimes="0;1"
            calcMode="linear"
          />
        </circle>
      )}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'auto',
          }}
          className="editable-edge-label-container"
        >
          {isEditing ? (
            <textarea
              ref={textareaRef}
              className="editable-edge-label-input"
              value={editValue}
              placeholder={isPlaceholder ? labelString : undefined}
              onChange={(e) => {
                setEditValue(e.target.value);
                // Auto-resize on text change
                if (textareaRef.current) {
                  textareaRef.current.style.height = 'auto';
                  textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
                }
              }}
              onKeyDown={handleKeyDown}
              onBlur={handleSave}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              rows={1}
            />
          ) : (
            <div
              className={`editable-edge-label ${selected ? 'selected' : ''}`}
              onClick={(e) => {
                // Only stop propagation if already selected (entering edit mode)
                if (selected) {
                  e.stopPropagation();
                }
                handleClick();
              }}
              onMouseDown={(e) => {
                // Prevent mousedown from reaching React Flow to avoid selection box issues
                if (selected) {
                  e.stopPropagation();
                }
              }}
            >
              {label || ''}
            </div>
          )}
        </div>
        {/* Direction toggle toolbar - appears when edge is selected */}
        {selected && !isEditing && (
          <button
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY - 24}px)`,
              pointerEvents: 'auto',
            }}
            className="edge-toolbar-button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleDirection();
            }}
            title={isBidirectional ? 'Switch to unidirectional and reverse' : 'Switch to bidirectional'}
          >
            {isBidirectional ? '⇄' : '→'}
          </button>
        )}
      </EdgeLabelRenderer>
    </>
  );
}
