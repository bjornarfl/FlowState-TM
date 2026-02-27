import React, { useState, useEffect, useRef } from 'react';
// @ts-ignore - NodeResizer is available but type declarations may not be properly loaded
import { NodeResizer } from '@xyflow/react';
import { isBoundaryNamePlaceholder } from '../../utils/refGenerators';
import './BoundaryNode.css';

export interface BoundaryNodeData {
  label: string;
  description?: string;
  initialEditMode?: boolean;
  onNameChange?: (newName: string) => void;
  onEditModeChange?: (isEditing: boolean) => void;
  onResizeEnd?: (width: number, height: number, x: number, y: number) => void;
}

/**
 * Custom node component for boundaries
 * Renders as a resizable container with red dotted border and transparent background
 * Note: Resizing is handled by React Flow's built-in resizable node feature
 */
export default function BoundaryNode({ data, selected }: { data: BoundaryNodeData; selected?: boolean }): React.JSX.Element {
  const { label, initialEditMode, onNameChange, onEditModeChange, onResizeEnd } = data;
  const [isEditing, setIsEditing] = useState(initialEditMode || false);
  const [isHovering, setIsHovering] = useState(false);
  const isPlaceholder = isBoundaryNamePlaceholder(label);
  const [editValue, setEditValue] = useState(isPlaceholder ? '' : label);
  const hasProcessedInitialEditMode = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Watch for initialEditMode changes to trigger edit mode (only once)
  useEffect(() => {
    if (initialEditMode && !hasProcessedInitialEditMode.current) {
      setIsEditing(true);
      onEditModeChange?.(true);
      hasProcessedInitialEditMode.current = true;
    }
    // Reset the flag when initialEditMode becomes false
    if (!initialEditMode) {
      hasProcessedInitialEditMode.current = false;
    }
  }, [initialEditMode, onEditModeChange]);

  // Auto-focus and select text when entering edit mode via initialEditMode
  useEffect(() => {
    if (isEditing && initialEditMode && inputRef.current) {
      // Use setTimeout to ensure input is fully rendered
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.setSelectionRange(0, inputRef.current.value.length);
        }
      }, 0);
    }
  }, [isEditing, initialEditMode]);

  const handleEditClick = (e: React.MouseEvent): void => {
    // Don't enter edit mode during multi-selection
    if (e.metaKey || e.ctrlKey) return;
    
    e.stopPropagation();
    const isPlaceholder = isBoundaryNamePlaceholder(label);
    setEditValue(isPlaceholder ? '' : label);
    setIsEditing(true);
    onEditModeChange?.(true);
  };

  const handleDoubleClick = (e: React.MouseEvent): void => {
    // Don't enter edit mode during multi-selection
    if (e.metaKey || e.ctrlKey) return;
    
    // Prevent text selection but don't stop propagation
    e.preventDefault();
    if (!isEditing) {
      const isPlaceholder = isBoundaryNamePlaceholder(label);
      setEditValue(isPlaceholder ? '' : label);
      setIsEditing(true);
      onEditModeChange?.(true);
    }
  };

  const handleSave = (): void => {
    const newValueToSave = editValue.trim() ? editValue : label;
    
    if (newValueToSave !== label) {
      onNameChange?.(newValueToSave);
    }
    setIsEditing(false);
    onEditModeChange?.(false);
  };

  const handleCancel = (): void => {
    setIsEditing(false);
    onEditModeChange?.(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <>
      <NodeResizer
        minWidth={150}
        minHeight={75}
        isVisible={selected}
        keepAspectRatio={false}
        shouldResize={() => true}
        lineClassName="boundary-resize-line"
        handleClassName="boundary-resize-handle"
        onResizeEnd={(_event: any, params: any) => {
          if (onResizeEnd && params.width && params.height) {
            onResizeEnd(Math.round(params.width), Math.round(params.height), Math.round(params.x), Math.round(params.y));
          }
        }}
      />
      <div 
        className="boundary-node"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onDoubleClick={handleDoubleClick}
      >
        {/* Invisible border frame — captures pointer events for drag/select
            while letting clicks in the interior pass through to edges below */}
        <div className="boundary-drag-frame" />
        <div className="boundary-label-container noDrag">
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              className="boundary-label-input"
              value={editValue}
              placeholder={isPlaceholder ? label : undefined}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSave}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <>
              <div className="boundary-label noDrag">
                {label}
              </div>
              {/* Edit button - always present to prevent layout shift */}
              <button 
                className={`boundary-edit-button${isHovering ? ' visible' : ''} noDrag`}
                onClick={handleEditClick}
                onMouseDown={(e) => e.stopPropagation()}
                title="Edit boundary"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
