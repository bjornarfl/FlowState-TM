import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import EditableCell from './EditableCell';
import EditableTextarea from './EditableTextarea';
import type { ThreatModel } from '../../types/threatModel';

interface AssetsTableProps {
  threatModel: ThreatModel | null;
  onAssetNameChange: (ref: string, newName: string) => void;
  onAssetDescriptionChange: (ref: string, newDescription: string) => void;
  onRemoveAsset: (ref: string) => void;
  onAddAsset: () => void;
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
  onNavigateToNextTable,
  onNavigateToPreviousTable,
}, ref): React.JSX.Element {
  const cellRefs = useRef<Map<string, HTMLElement>>(new Map());
  const shouldFocusNewAsset = useRef(false);
  const previousAssetCount = useRef(threatModel?.assets?.length || 0);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    focusCellByColumn: (column: 'name' | 'description', rowIndex: number = 0) => {
      const assets = threatModel?.assets || [];
      if (assets.length > 0) {
        const targetIndex = Math.min(rowIndex, assets.length - 1);
        const cellKey = `${assets[targetIndex].ref}-${column}`;
        focusCell(cellKey);
      }
    },
  }));

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    focusCellByColumn: (column: 'name' | 'description', rowIndex: number = 0) => {
      const assets = threatModel?.assets || [];
      if (assets.length > 0) {
        const targetIndex = Math.min(rowIndex, assets.length - 1);
        const cellKey = `${assets[targetIndex].ref}-${column}`;
        focusCell(cellKey);
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
          focusCell(`${lastAsset.ref}-name`);
          shouldFocusNewAsset.current = false;
        }, 50);
      }
    }
    
    previousAssetCount.current = currentAssetCount;
  }, [threatModel?.assets]);

  const focusCell = (cellKey: string): void => {
    const cell = cellRefs.current.get(cellKey);
    if (cell) {
      const input = cell.querySelector('input, textarea');
      if (input) {
        (input as HTMLElement).focus();
      }
    }
  };

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
      focusCell(nextCellKey);
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
      focusCell(nextCellKey);
    }
  };

  return (
    <div className="table-container">
      <h3>Data Assets</h3>
      <h4>Data or resources that need protection</h4>
      {threatModel?.assets && threatModel.assets.length > 0 && (
        <table>
          <colgroup>
            <col style={{ width: '25%' }} />
            <col style={{ width: 'auto' }} />
            <col style={{ width: '20px' }} />
          </colgroup>
          <thead className="header-assets">
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th className="action-column"></th>
            </tr>
          </thead>
          <tbody>
            {threatModel.assets.map((asset) => (
              <tr key={asset.ref}>
                <td ref={(el) => { if (el) cellRefs.current.set(`${asset.ref}-name`, el); }}>
                  <EditableCell
                    value={asset.name}
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
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button
        className="add-row-button add-row-assets"
        onClick={onAddAsset}
        title="Add asset"
      >
        + Add Asset
      </button>
    </div>
  );
}));

export default AssetsTable;
