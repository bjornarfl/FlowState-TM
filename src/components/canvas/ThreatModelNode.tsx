import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position, NodeToolbar } from '@xyflow/react';
import type { ThreatModelNodeData } from '../../utils/flowTransformer';
import type { ComponentType } from '../../types/threatModel';
import EditablePicker from '../tables/EditablePicker';
import './ThreatModelNode.css';

const COMPONENT_TYPES: { value: ComponentType; label: string; className: string }[] = [
  { value: 'internal', label: 'Internal', className: 'type-internal' },
  { value: 'external_dependency', label: 'External', className: 'type-external' },
  { value: 'data_store', label: 'Data Store', className: 'type-datastore' },
];

/**
 * Custom node component for threat model components
 * Renders different styles based on component type:
 * - internal: Rounded rectangle
 * - external_dependency: Sharp rectangle
 * - data_store: Parallel lines (top and bottom)
 */
export default function ThreatModelNode({ data, selected }: { data: ThreatModelNodeData; selected?: boolean }): React.JSX.Element {
  const { 
    label, 
    ref, 
    componentType, 
    description, 
    assets, 
    availableAssets, 
    isDraggingNode, 
    initialEditMode, 
    isFocusedForConnection,
    focusedHandleId,
    isInDataFlowCreation,
    isHandleSelectionMode,
    onNameChange, 
    onEditModeChange, 
    onTypeChange, 
    onDescriptionChange, 
    onAssetsChange, 
    onCreateAsset 
  } = data;
  const [isEditing, setIsEditing] = useState(initialEditMode || false);
  const [isHovering, setIsHovering] = useState(false);
  const [editValue, setEditValue] = useState(label);
  const [dialogDescription, setDialogDescription] = useState(description || '');
  const [wasSelected, setWasSelected] = useState(selected);
  const [activeField, setActiveField] = useState<'name' | 'description' | 'assets' | null>('name');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const assetsPickerRef = useRef<HTMLDivElement>(null);
  const hasProcessedInitialEditMode = useRef(false);

  // Notify parent when entering initial edit mode
  useEffect(() => {
    if (initialEditMode) {
      onEditModeChange?.(true);
    }
  }, [initialEditMode, onEditModeChange]);

  // Watch for initialEditMode changes to trigger edit mode (only once)
  useEffect(() => {
    if (initialEditMode && !hasProcessedInitialEditMode.current) {
      setIsEditing(true);
      hasProcessedInitialEditMode.current = true;
    }
    // Reset the flag when initialEditMode becomes false
    if (!initialEditMode) {
      hasProcessedInitialEditMode.current = false;
    }
  }, [initialEditMode]);

  // Determine node class based on component type
  const getNodeClass = (): string => {
    switch (componentType) {
      case 'external_dependency':
        return 'threat-node external-dependency';
      case 'data_store':
        return 'threat-node data-store';
      case 'internal':
      default:
        return 'threat-node internal';
    }
  };

  const handleEditClick = (e: React.MouseEvent): void => {
    e.preventDefault();
    setIsEditing(true);
    onEditModeChange?.(true);
  };

  const handleDoubleClick = (e: React.MouseEvent): void => {
    e.preventDefault();
    if (!isEditing) {
      setIsEditing(true);
      onEditModeChange?.(true);
    }
  };

  // Update editValue when label changes from outside
  useEffect(() => {
    setEditValue(label);
  }, [label]);

  // Auto-resize textarea based on content
  const autoResizeTextarea = (textarea: HTMLTextAreaElement): void => {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      // Use setTimeout to ensure textarea is fully rendered
      setTimeout(() => {
        if (textareaRef.current) {
          autoResizeTextarea(textareaRef.current);
          textareaRef.current.focus();
          // If entering edit mode via initialEditMode (new component), select all text
          // Otherwise, place cursor at the end
          if (initialEditMode) {
            textareaRef.current.setSelectionRange(0, textareaRef.current.value.length);
          } else {
            textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
          }
        }
      }, 0);
    }
  }, [isEditing, initialEditMode]);

  const handleSave = (): void => {
    if (editValue.trim() && editValue !== label) {
      onNameChange?.(editValue);
    } else if (!editValue.trim()) {
      // Reset to original value if empty
      setEditValue(label);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
      setIsEditing(false);
      onEditModeChange?.(false);
    } else if (e.key === 'Escape') {
      setEditValue(label);
      setIsEditing(false);
      onEditModeChange?.(false);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Tab moves to description field
      setActiveField('description');
      setTimeout(() => descriptionRef.current?.focus(), 0);
    }
  };

  // Exit edit mode when clicking outside (node is deselected)
  useEffect(() => {
    if (wasSelected && !selected && isEditing) {
      // Use queueMicrotask to defer state updates
      queueMicrotask(() => {
        setIsEditing(false);
        onEditModeChange?.(false);
      });
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWasSelected(selected);
  }, [selected, wasSelected, isEditing, onEditModeChange]);

  // Update dialog values when data changes
  useEffect(() => {
    // Only update if description changed to avoid unnecessary renders
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDialogDescription(prev => {
      const newValue = description || '';
      return prev !== newValue ? newValue : prev;
    });
  }, [description]);

  const handleTypeChange = (newType: ComponentType): void => {
    onTypeChange?.(newType);
  };

  const handleAssetsChange = (newAssets: string[]): void => {
    onAssetsChange?.(newAssets);
  };

  const handleDescriptionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Tab') {
      e.preventDefault();
      // Tab moves to assets picker
      setActiveField('assets');
      setTimeout(() => {
        // Focus the picker wrapper (which has tabIndex={0})
        const pickerWrapper = assetsPickerRef.current?.querySelector('.editable-picker-wrapper') as HTMLElement;
        if (pickerWrapper) {
          pickerWrapper.focus();
        }
      }, 0);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      // Escape exits edit mode
      setIsEditing(false);
      onEditModeChange?.(false);
    }
  };

  const handleAssetsTabPress = (shiftKey: boolean): void => {
    if (!shiftKey) {
      // Tab forward from assets picker - loop back to name field
      setActiveField('name');
      setTimeout(() => textareaRef.current?.focus(), 0);
    } else {
      // Shift+Tab backward from assets picker - move to description
      setActiveField('description');
      setTimeout(() => descriptionRef.current?.focus(), 0);
    }
  };

  // All nodes now use the same handle configuration (12 handles - 3 per side)
  const handlePositions = [
    { position: Position.Top, id: 'top-1', offset: 0 },
    { position: Position.Top, id: 'top-2', offset: 0.33 },
    { position: Position.Top, id: 'top-3', offset: 0.66 },
    { position: Position.Right, id: 'right-1', offset: 0 },
    { position: Position.Right, id: 'right-2', offset: 0.33 },
    { position: Position.Right, id: 'right-3', offset: 0.66 },
    { position: Position.Bottom, id: 'bottom-1', offset: 0 },
    { position: Position.Bottom, id: 'bottom-2', offset: 0.33 },
    { position: Position.Bottom, id: 'bottom-3', offset: 0.66 },
    { position: Position.Left, id: 'left-1', offset: 0 },
    { position: Position.Left, id: 'left-2', offset: 0.33 },
    { position: Position.Left, id: 'left-3', offset: 0.66 },
  ];

  return (
    <div 
      className={`${getNodeClass()}${selected && !isInDataFlowCreation ? ' selected' : ''}${isEditing ? ' edit-mode' : ''}${isFocusedForConnection ? ' connection-focused' : ''}${isHandleSelectionMode ? ' handle-selection-mode' : ''}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onDoubleClick={handleDoubleClick}
    >
      {/* Render all handles - each can work as both source and target */}
      {handlePositions.map((handle) => (
        <div 
          key={`wrapper-${handle.id}`} 
          className={`handle-wrapper handle-${handle.id}${focusedHandleId === handle.id ? ' focused' : ''}`}
        >
          <Handle
            id={handle.id}
            type="source"
            position={handle.position}
            isConnectable={true}
          />
          <Handle
            id={`target-${handle.id}`}
            type="target"
            position={handle.position}
            isConnectable={true}
          />
        </div>
      ))}
      <div className="node-content">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            className="node-label-input"
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              autoResizeTextarea(e.target);
            }}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            onClick={(e) => e.stopPropagation()}
            rows={1}
          />
        ) : (
          <div className="node-label-wrapper">
            <div className="node-label">
              {label}
            </div>
            {/* Edit button - positioned absolutely to not affect centering */}
            <button 
              className={`node-edit-button${isHovering && !isDraggingNode ? ' visible' : ''}`}
              onClick={handleEditClick}
              title="Edit node"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
          </div>
        )}
      </div>
      
      {/* Node toolbar - appears only in edit mode */}
      {isEditing && (
        <>
          {/* Component type selector - top of node */}
          <NodeToolbar position={Position.Top} className="node-toolbar-top">
            {COMPONENT_TYPES.map((type) => (
              <button
                key={type.value}
                className={`node-toolbar-button ${type.className}${componentType === type.value ? ' active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleTypeChange(type.value);
                }}
                title={type.label}
              />
            ))}
          </NodeToolbar>
          
          {/* Info dialog - bottom of node */}
          <NodeToolbar position={Position.Bottom} className="node-info-dialog-wrapper">
            <div 
              className="node-info-dialog"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onWheelCapture={(e) => {
                e.stopPropagation();
              }}
            >
              <div className="node-info-dialog-content">
                <div className="node-info-field">
                  <label>Ref</label>
                  <div className="node-info-ref">{ref}</div>
                </div>
                
                <div className="node-info-field">
                  <label>Description</label>
                  <textarea
                    ref={descriptionRef}
                    className="node-info-textarea"
                    value={dialogDescription}
                    placeholder="Add description..."
                    onChange={(e) => {
                      setDialogDescription(e.target.value);
                    }}
                    onBlur={(e) => {
                      onDescriptionChange?.(e.target.value);
                    }}
                    onKeyDown={handleDescriptionKeyDown}
                    onWheelCapture={(e) => {
                      e.stopPropagation();
                    }}
                    rows={3}
                  />
                </div>
                
                <div className="node-info-field">
                  <label>Assets</label>
                  <div ref={assetsPickerRef} className='node-input-wrapper'>
                    <EditablePicker
                      value={assets || []}
                      availableItems={availableAssets || []}
                      placeholder="Add asset..."
                      variant="assets"
                      onSave={handleAssetsChange}
                      onCreateItem={onCreateAsset}
                      useInWrapper={true}
                      autoEdit={activeField === 'assets'}
                      onTabPress={handleAssetsTabPress}
                      onDeactivate={() => {
                        setActiveField(null);
                        setIsEditing(false);
                        onEditModeChange?.(false);
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </NodeToolbar>
        </>
      )}
    </div>
  );
}
