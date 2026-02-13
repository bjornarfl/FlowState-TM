import React, { useRef, useEffect, useImperativeHandle, forwardRef, useState } from 'react';
import { Info } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent } from '@dnd-kit/core';
import EditableCell from './EditableCell';
import EditableTextarea from './EditableTextarea';
import SortableTableRow from './SortableTableRow';
import type { ThreatModel } from '../../types/threatModel';
import { isAssetNamePlaceholder } from '../../utils/refGenerators';

interface AssetsTableProps {
  threatModel: ThreatModel | null;
  onAssetNameChange: (ref: string, newName: string) => void;
  onAssetDescriptionChange: (ref: string, newDescription: string) => void;
  onRemoveAsset: (ref: string) => void;
  onAddAsset: () => void;
  onReorderAssets: (newOrder: string[]) => void;
  onNavigateToNextTable?: (column: 'name' | 'description') => void;
  onNavigateToPreviousTable?: (column: 'name' | 'description') => void;
}

export interface AssetsTableRef {
  focusCellByColumn: (column: 'name' | 'description', rowIndex?: number) => void;
}

const AssetsTable = React.memo(forwardRef<AssetsTableRef, AssetsTableProps>(function AssetsTable({
  threatModel,
  onAssetNameChange,
  onAssetDescriptionChange,
  onRemoveAsset,
  onAddAsset,
  onReorderAssets,
  onNavigateToNextTable,
  onNavigateToPreviousTable,
}, ref): React.JSX.Element {
  const cellRefs = useRef<Map<string, HTMLElement>>(new Map());
  const shouldFocusNewAsset = useRef(false);
  const previousAssetCount = useRef(threatModel?.assets?.length || 0);
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
      const assets = threatModel?.assets || [];
      const oldIndex = assets.findIndex((asset) => asset.ref === active.id);
      const newIndex = assets.findIndex((asset) => asset.ref === over.id);

      const newOrder = arrayMove(assets, oldIndex, newIndex).map((asset) => asset.ref);
      onReorderAssets(newOrder);
    }
    setActiveId(null);
  };

  const focusCellInternal = (cellKey: string): void => {
    const cell = cellRefs.current.get(cellKey);
    if (cell) {
      const input = cell.querySelector('input, textarea');
      if (input) {
        (input as HTMLElement).focus();
      }
    }
  };

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    focusCellByColumn: (column: 'name' | 'description', rowIndex: number = 0) => {
      const assets = threatModel?.assets || [];
      if (assets.length > 0) {
        const targetIndex = Math.min(rowIndex, assets.length - 1);
        const cellKey = `${assets[targetIndex].ref}-${column}`;
        // Focus after a brief delay to ensure rendering completes
        setTimeout(() => focusCellInternal(cellKey), 50);
      }
    },
  }));

  // Focus the name cell of newly added asset
  useEffect(() => {
    const currentAssetCount = threatModel?.assets?.length || 0;
    
    if (shouldFocusNewAsset.current && currentAssetCount > previousAssetCount.current) {
      // A new asset was added, focus on its name field
      const assets = threatModel?.assets || [];
      const lastAsset = assets[assets.length - 1];
      if (lastAsset) {
        setTimeout(() => {
          focusCellInternal(`${lastAsset.ref}-name`);
          shouldFocusNewAsset.current = false;
        }, 50);
      }
    }
    
    previousAssetCount.current = currentAssetCount;
  }, [threatModel?.assets]);

  const handleTabPress = (assetRef: string, cellType: 'name' | 'description', shiftKey: boolean): void => {
    const assets = threatModel?.assets || [];
    const currentIndex = assets.findIndex(a => a.ref === assetRef);
    
    if (currentIndex === -1) return;

    let nextCellKey: string | null = null;

    if (!shiftKey) {
      // Tab forward
      if (cellType === 'name') {
        // Move to description of same row
        nextCellKey = `${assetRef}-description`;
      } else if (cellType === 'description') {
        // If we're on the last row, add a new asset
        if (currentIndex === assets.length - 1) {
          shouldFocusNewAsset.current = true;
          onAddAsset();
          return;
        } else {
          // Move to name of next row
          nextCellKey = `${assets[currentIndex + 1].ref}-name`;
        }
      }
    } else {
      // Shift+Tab backward
      if (cellType === 'description') {
        // Move to name of same row
        nextCellKey = `${assetRef}-name`;
      } else if (cellType === 'name') {
        // Move to description of previous row
        if (currentIndex > 0) {
          nextCellKey = `${assets[currentIndex - 1].ref}-description`;
        }
      }
    }

    if (nextCellKey) {
      focusCellInternal(nextCellKey);
    }
  };

  const handleNavigate = (assetRef: string, cellType: 'name' | 'description', direction: 'up' | 'down' | 'left' | 'right'): void => {
    const assets = threatModel?.assets || [];
    const currentIndex = assets.findIndex(a => a.ref === assetRef);
    
    if (currentIndex === -1) return;

    let nextCellKey: string | null = null;

    switch (direction) {
      case 'right':
        // Move to next cell in row
        if (cellType === 'name') {
          nextCellKey = `${assetRef}-description`;
        } else if (cellType === 'description' && currentIndex < assets.length - 1) {
          nextCellKey = `${assets[currentIndex + 1].ref}-name`;
        }
        break;
      
      case 'left':
        // Move to previous cell in row
        if (cellType === 'description') {
          nextCellKey = `${assetRef}-name`;
        } else if (cellType === 'name' && currentIndex > 0) {
          nextCellKey = `${assets[currentIndex - 1].ref}-description`;
        }
        break;
      
      case 'down':
        // Move to same column in next row
        if (currentIndex < assets.length - 1) {
          nextCellKey = `${assets[currentIndex + 1].ref}-${cellType}`;
        } else if (onNavigateToNextTable) {
          // At last row, navigate to next table
          onNavigateToNextTable(cellType);
          return;
        }
        break;
      
      case 'up':
        // Move to same column in previous row
        if (currentIndex > 0) {
          nextCellKey = `${assets[currentIndex - 1].ref}-${cellType}`;
        } else if (onNavigateToPreviousTable) {
          // At first row, navigate to previous table
          onNavigateToPreviousTable(cellType);
          return;
        }
        break;
    }

    if (nextCellKey) {
      focusCellInternal(nextCellKey);
    }
  };

  return (
    <div className="table-section">
      <div className="table-header">
        <span>Assets</span>
        <span className="header-help-icon" data-tooltip='Data or resources that needs protection.'>
          <Info size={16} />
        </span>
      </div>
      <div className="table-content">
          <div className={`table-container ${activeId ? 'dragging' : ''}`}>
            {threatModel?.assets && threatModel.assets.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <table>
            <colgroup>
              <col style={{ width: '0px' }} />
              <col style={{ width: '25%' }} />
              <col style={{ width: 'auto' }} />
              <col style={{ width: '35px' }} />
            </colgroup>
            <thead className="header-assets">
              <tr>
                <th></th>
                <th>Name</th>
                <th>Description</th>
                <th className="action-column"></th>
              </tr>
            </thead>
            <SortableContext
              items={threatModel.assets.map((asset) => asset.ref)}
              strategy={verticalListSortingStrategy}
            >
              <tbody>
                {threatModel.assets.map((asset) => (
                  <SortableTableRow key={asset.ref} id={asset.ref}>
                    <td ref={(el) => { if (el) cellRefs.current.set(`${asset.ref}-name`, el); }}>
                      <EditableCell
                        value={asset.name}
                        placeholder={isAssetNamePlaceholder(asset.name) ? asset.name : undefined}
                        onSave={(newName) => onAssetNameChange(asset.ref, newName)}
                        onTabPress={(shiftKey) => handleTabPress(asset.ref, 'name', shiftKey)}
                        onNavigate={(direction) => handleNavigate(asset.ref, 'name', direction)}
                      />
                    </td>
                    <td ref={(el) => { if (el) cellRefs.current.set(`${asset.ref}-description`, el); }}>
                      <EditableTextarea
                        value={asset.description || ''}
                        onSave={(newDescription) => onAssetDescriptionChange(asset.ref, newDescription)}
                        onTabPress={(shiftKey) => handleTabPress(asset.ref, 'description', shiftKey)}
                        onNavigate={(direction) => handleNavigate(asset.ref, 'description', direction)}
                      />
                    </td>
                    <td className="action-column">
                      <button
                        className="row-action-button remove-button"
                        onClick={() => onRemoveAsset(asset.ref)}
                        title="Remove asset"
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
                  {threatModel?.assets?.find((a) => a.ref === activeId)?.name || 'Asset'}
                </span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
            <button
              className="add-row-button add-row-assets"
              onClick={onAddAsset}
              title="Add asset"
            >
              + Add Asset
            </button>
          </div>
        </div>
    </div>
  );
}));

export default AssetsTable;
