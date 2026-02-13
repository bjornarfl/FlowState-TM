import React, { useRef, useEffect, useImperativeHandle, forwardRef, useState } from 'react';
import { Info } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent } from '@dnd-kit/core';
import EditableCell from './EditableCell';
import EditableTextarea from './EditableTextarea';
import EditableTypeCell from './EditableTypeCell';
import EditablePicker from './EditablePicker';
import SortableTableRow from './SortableTableRow';
import type { ThreatModel, ComponentType } from '../../types/threatModel';
import { isComponentNamePlaceholder } from '../../utils/refGenerators';

interface ComponentsTableProps {
  threatModel: ThreatModel | null;
  onComponentNameChange: (ref: string, newName: string) => void;
  onComponentTypeChange: (ref: string, newType: ComponentType) => void;
  onComponentDescriptionChange: (ref: string, newDescription: string) => void;
  onComponentAssetsChange: (ref: string, assets: string[]) => void;
  onCreateAsset: (name: string) => string | Promise<string>;
  onRemoveComponent: (ref: string) => void;
  onAddComponent: (componentType: ComponentType) => void;
  onReorderComponents: (newOrder: string[]) => void;
  onNavigateToNextTable?: (column: 'name' | 'type' | 'description' | 'assets') => void;
  onNavigateToPreviousTable?: (column: 'name' | 'type' | 'description' | 'assets') => void;
}

export interface ComponentsTableRef {
  focusCellByColumn: (column: 'name' | 'type' | 'description' | 'assets', rowIndex?: number) => void;
}

const ComponentsTable = React.memo(forwardRef<ComponentsTableRef, ComponentsTableProps>(function ComponentsTable({
  threatModel,
  onComponentNameChange,
  onComponentTypeChange,
  onComponentDescriptionChange,
  onComponentAssetsChange,
  onCreateAsset,
  onRemoveComponent,
  onAddComponent,
  onReorderComponents,
  onNavigateToNextTable,
  onNavigateToPreviousTable,
}, ref): React.JSX.Element {
  const cellRefs = useRef<Map<string, HTMLElement>>(new Map());
  const shouldFocusNewComponent = useRef<{ focus: boolean; type: ComponentType | null }>({ focus: false, type: null });
  const previousComponentCount = useRef(threatModel?.components?.length || 0);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent): void => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const components = threatModel?.components || [];
      const oldIndex = components.findIndex((component) => component.ref === active.id);
      const newIndex = components.findIndex((component) => component.ref === over.id);

      const newOrder = arrayMove(components, oldIndex, newIndex).map((component) => component.ref);
      onReorderComponents(newOrder);
    }
    setActiveId(null);
  };

  const focusCellInternal = (cellKey: string): void => {
    const cell = cellRefs.current.get(cellKey);
    if (cell) {
      const input = cell.querySelector('input, textarea, select, [tabindex="0"]');
      if (input) {
        (input as HTMLElement).focus();
      }
    }
  };

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    focusCellByColumn: (column: 'name' | 'type' | 'description' | 'assets', rowIndex: number = 0) => {
      const components = threatModel?.components || [];
      if (components.length > 0) {
        const targetIndex = Math.min(rowIndex, components.length - 1);
        const cellKey = `${components[targetIndex].ref}-${column}`;
        // Focus after a brief delay to ensure rendering completes
        setTimeout(() => focusCellInternal(cellKey), 50);
      }
    },
  }));

  // Focus the name cell of newly added component
  useEffect(() => {
    const currentComponentCount = threatModel?.components?.length || 0;

    if (shouldFocusNewComponent.current.focus && currentComponentCount > previousComponentCount.current) {
      // A new component was added, focus on its name field
      const components = threatModel?.components || [];
      const lastComponent = components[components.length - 1];
      if (lastComponent) {
        setTimeout(() => {
          focusCellInternal(`${lastComponent.ref}-name`);
          shouldFocusNewComponent.current = { focus: false, type: null };
        }, 50);
      }
    }

    previousComponentCount.current = currentComponentCount;
  }, [threatModel?.components]);

  const handleTabPress = (componentRef: string, cellType: 'name' | 'type' | 'description' | 'assets', shiftKey: boolean): void => {
    const components = threatModel?.components || [];
    const currentIndex = components.findIndex(c => c.ref === componentRef);

    if (currentIndex === -1) return;

    let nextCellKey: string | null = null;

    if (!shiftKey) {
      // Tab forward
      if (cellType === 'name') {
        nextCellKey = `${componentRef}-type`;
      } else if (cellType === 'type') {
        nextCellKey = `${componentRef}-description`;
      } else if (cellType === 'description') {
        nextCellKey = `${componentRef}-assets`;
      } else if (cellType === 'assets') {
        // If we're on the last row, navigate to next table or stay
        if (currentIndex === components.length - 1) {
          if (onNavigateToNextTable) {
            onNavigateToNextTable('assets');
          }
          return;
        } else {
          // Move to name of next row
          nextCellKey = `${components[currentIndex + 1].ref}-name`;
        }
      }
    } else {
      // Shift+Tab backward
      if (cellType === 'assets') {
        nextCellKey = `${componentRef}-description`;
      } else if (cellType === 'description') {
        nextCellKey = `${componentRef}-type`;
      } else if (cellType === 'type') {
        nextCellKey = `${componentRef}-name`;
      } else if (cellType === 'name') {
        // Move to assets of previous row or navigate to previous table
        if (currentIndex > 0) {
          nextCellKey = `${components[currentIndex - 1].ref}-assets`;
        } else if (onNavigateToPreviousTable) {
          onNavigateToPreviousTable('name');
          return;
        }
      }
    }

    if (nextCellKey) {
      focusCellInternal(nextCellKey);
    }
  };

  const handleNavigate = (componentRef: string, cellType: 'name' | 'type' | 'description' | 'assets', direction: 'up' | 'down' | 'left' | 'right'): void => {
    const components = threatModel?.components || [];
    const currentIndex = components.findIndex(c => c.ref === componentRef);

    if (currentIndex === -1) return;

    let nextCellKey: string | null = null;

    switch (direction) {
      case 'right':
        // Move to next cell in row
        if (cellType === 'name') {
          nextCellKey = `${componentRef}-type`;
        } else if (cellType === 'type') {
          nextCellKey = `${componentRef}-description`;
        } else if (cellType === 'description') {
          nextCellKey = `${componentRef}-assets`;
        } else if (cellType === 'assets' && currentIndex < components.length - 1) {
          nextCellKey = `${components[currentIndex + 1].ref}-name`;
        }
        break;

      case 'left':
        // Move to previous cell in row
        if (cellType === 'assets') {
          nextCellKey = `${componentRef}-description`;
        } else if (cellType === 'description') {
          nextCellKey = `${componentRef}-type`;
        } else if (cellType === 'type') {
          nextCellKey = `${componentRef}-name`;
        } else if (cellType === 'name' && currentIndex > 0) {
          nextCellKey = `${components[currentIndex - 1].ref}-assets`;
        }
        break;

      case 'down':
        // Move to same column in next row
        if (currentIndex < components.length - 1) {
          nextCellKey = `${components[currentIndex + 1].ref}-${cellType}`;
        } else if (onNavigateToNextTable) {
          onNavigateToNextTable(cellType);
        }
        break;

      case 'up':
        // Move to same column in previous row
        if (currentIndex > 0) {
          nextCellKey = `${components[currentIndex - 1].ref}-${cellType}`;
        } else if (onNavigateToPreviousTable) {
          onNavigateToPreviousTable(cellType);
        }
        break;
    }

    if (nextCellKey) {
      focusCellInternal(nextCellKey);
    }
  };

  const components = threatModel?.components || [];

  return (
    <div className="table-section">
      <div className="table-header">
        <span>Components</span>
        <span className="header-help-icon" data-tooltip='The "objects" of a threat model (users, applications, databases, etc.)'>
          <Info size={16} />
        </span>
      </div>
      <div className="table-content">
          <div className={`table-container ${activeId ? 'dragging' : ''}`}>
            {threatModel?.components && threatModel.components.length > 0 && (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <table>
                  <colgroup>
                  <col style={{ width: '0px' }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: 'auto' }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '35px' }} />
                  </colgroup>
                  <thead className="header-components">
                    <tr>
                      <th></th>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Description</th>
                      <th>Assets</th>
                      <th className="action-column"></th>
                    </tr>
                  </thead>
                  <SortableContext
                    items={threatModel.components.map((component) => component.ref)}
                    strategy={verticalListSortingStrategy}
                  >
                    <tbody>
                      {components.map((component) => (
                        <SortableTableRow key={component.ref} id={component.ref}>
                      <td ref={(el) => { if (el) cellRefs.current.set(`${component.ref}-name`, el); }}>
                        <EditableCell
                          value={component.name}
                          placeholder={isComponentNamePlaceholder(component.name) ? component.name : undefined}
                          onSave={(newName: string) => onComponentNameChange(component.ref, newName)}
                          onTabPress={(shiftKey) => handleTabPress(component.ref, 'name', shiftKey)}
                          onNavigate={(direction) => handleNavigate(component.ref, 'name', direction)}
                        />
                      </td>
                      <td ref={(el) => { if (el) cellRefs.current.set(`${component.ref}-type`, el); }}>
                        <EditableTypeCell
                          value={component.component_type}
                          onSave={(newType) => onComponentTypeChange(component.ref, newType)}
                          onTabPress={(shiftKey) => handleTabPress(component.ref, 'type', shiftKey)}
                          onNavigate={(direction) => handleNavigate(component.ref, 'type', direction)}
                        />
                      </td>
                      <td ref={(el) => { if (el) cellRefs.current.set(`${component.ref}-description`, el); }}>
                        <EditableTextarea
                          value={component.description || ''}
                          onSave={(newDescription: string) => onComponentDescriptionChange(component.ref, newDescription)}
                          onTabPress={(shiftKey) => handleTabPress(component.ref, 'description', shiftKey)}
                          onNavigate={(direction) => handleNavigate(component.ref, 'description', direction)}
                        />
                      </td>
                      <td ref={(el) => { if (el) cellRefs.current.set(`${component.ref}-assets`, el); }}>
                        <EditablePicker
                          value={component.assets || []}
                          availableItems={threatModel?.assets?.map((a) => ({ ref: a.ref, name: a.name })) || []}
                          placeholder="Add asset..."
                          variant="assets"
                          onSave={(newAssets) => onComponentAssetsChange(component.ref, newAssets)}
                          onCreateItem={onCreateAsset}
                          onTabPress={(shiftKey) => handleTabPress(component.ref, 'assets', shiftKey)}
                          onNavigate={(direction) => handleNavigate(component.ref, 'assets', direction)}
                        />
                      </td>
                      <td className="action-column">
                        <button
                          className="row-action-button remove-button"
                          onClick={() => onRemoveComponent(component.ref)}
                          title="Remove component"
                        >
                          ×
                        </button>
                      </td>
                    </SortableTableRow>
                  ))}
                </tbody>
              </SortableContext>
            </table>
            <DragOverlay>
              {activeId ? (
                <div
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    padding: '8px 12px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                    cursor: 'grabbing',
                    minHeight: '40px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ marginRight: '8px', opacity: 0.5 }}>⋮⋮</div>
                  <span>
                    {threatModel?.components?.find((c) => c.ref === activeId)?.name || 'Component'}
                  </span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
            <div className="add-row-buttons">
              <button
                className="add-row-button add-row-components"
                onClick={() => {
                  shouldFocusNewComponent.current = { focus: false, type: 'internal' };
                  onAddComponent('internal');
                }}
              >
                + Add Internal
              </button>
              <button
                className="add-row-button add-row-components"
                onClick={() => {
                  shouldFocusNewComponent.current = { focus: true, type: 'external_dependency' };
                  onAddComponent('external_dependency');
                }}
              >
                + Add External
              </button>
              <button
                className="add-row-button add-row-components"
                onClick={() => {
                  shouldFocusNewComponent.current = { focus: true, type: 'data_store' };
                  onAddComponent('data_store');
                }}
              >
                + Add Data Store
              </button>
            </div>
          </div>
        </div>
    </div>
  );
}), (prevProps, nextProps) => {
  // Only re-render if component-related data changed
  return prevProps.threatModel?.components === nextProps.threatModel?.components &&
    prevProps.threatModel?.assets === nextProps.threatModel?.assets &&
    prevProps.onComponentNameChange === nextProps.onComponentNameChange &&
    prevProps.onComponentTypeChange === nextProps.onComponentTypeChange &&
    prevProps.onComponentDescriptionChange === nextProps.onComponentDescriptionChange &&
    prevProps.onComponentAssetsChange === nextProps.onComponentAssetsChange &&
    prevProps.onCreateAsset === nextProps.onCreateAsset &&
    prevProps.onRemoveComponent === nextProps.onRemoveComponent &&
    prevProps.onAddComponent === nextProps.onAddComponent &&
    prevProps.onNavigateToNextTable === nextProps.onNavigateToNextTable &&
    prevProps.onNavigateToPreviousTable === nextProps.onNavigateToPreviousTable;
});

export default ComponentsTable;
