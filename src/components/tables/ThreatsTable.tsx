import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import EditableCell from './EditableCell';
import EditableTextarea from './EditableTextarea';
import MultiPickerCell, { PickerSection } from './MultiPickerCell';
import type { ThreatModel } from '../../types/threatModel';

interface ThreatsTableProps {
  threatModel: ThreatModel | null;
  onThreatNameChange: (ref: string, newName: string) => void;
  onThreatDescriptionChange: (ref: string, newDescription: string) => void;
  onThreatAffectedComponentsChange: (ref: string, newComponents: string[]) => void;
  onThreatAffectedDataFlowsChange: (ref: string, newDataFlows: string[]) => void;
  onThreatAffectedAssetsChange: (ref: string, newAssets: string[]) => void;
  onRemoveThreat: (ref: string) => void;
  onAddThreat: () => void;
  onNavigateToNextTable?: (column: 'name' | 'description' | 'items') => void;
  onNavigateToPreviousTable?: (column: 'name' | 'description' | 'items') => void;
}

export interface ThreatsTableRef {
  focusCellByColumn: (column: 'name' | 'description' | 'items', rowIndex?: number) => void;
}

const ThreatsTable = React.memo(forwardRef<ThreatsTableRef, ThreatsTableProps>(function ThreatsTable({
  threatModel,
  onThreatNameChange,
  onThreatDescriptionChange,
  onThreatAffectedComponentsChange,
  onThreatAffectedDataFlowsChange,
  onThreatAffectedAssetsChange,
  onRemoveThreat,
  onAddThreat,
  onNavigateToNextTable,
  onNavigateToPreviousTable,
}, ref): React.JSX.Element {
  const cellRefs = useRef<Map<string, HTMLElement>>(new Map());
  const shouldFocusNewThreat = useRef(false);
  const previousThreatCount = useRef(threatModel?.threats?.length || 0);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    focusCellByColumn: (column: 'name' | 'description' | 'items', rowIndex: number = 0) => {
      const threats = threatModel?.threats || [];
      if (threats.length > 0) {
        const targetIndex = Math.min(rowIndex, threats.length - 1);
        const cellKey = `${threats[targetIndex].ref}-${column}`;
        focusCell(cellKey);
      }
    },
  }));

  // Focus the name cell of newly added threat
  useEffect(() => {
    const currentThreatCount = threatModel?.threats?.length || 0;
    
    if (shouldFocusNewThreat.current && currentThreatCount > previousThreatCount.current) {
      // A new threat was added, focus on its name field
      const threats = threatModel?.threats || [];
      const lastThreat = threats[threats.length - 1];
      if (lastThreat) {
        setTimeout(() => {
          focusCell(`${lastThreat.ref}-name`);
          shouldFocusNewThreat.current = false;
        }, 50);
      }
    }
    
    previousThreatCount.current = currentThreatCount;
  }, [threatModel?.threats]);

  const focusCell = (cellKey: string): void => {
    const cell = cellRefs.current.get(cellKey);
    if (cell) {
      // First try to find input/textarea for editable cells
      const input = cell.querySelector('input, textarea');
      if (input) {
        (input as HTMLElement).focus();
      } else {
        // For MultiPickerCell or other focusable elements, focus the cell itself or its first focusable child
        const focusable = cell.querySelector('[tabindex]') as HTMLElement;
        if (focusable) {
          focusable.focus();
        } else {
          // If no focusable element found, make the cell itself focusable and focus it
          const divWithTabIndex = cell.querySelector('div[tabindex="0"]') as HTMLElement;
          if (divWithTabIndex) {
            divWithTabIndex.focus();
          }
        }
      }
    }
  };

  const handleTabPress = (threatRef: string, cellType: 'name' | 'description' | 'items', shiftKey: boolean): void => {
    const threats = threatModel?.threats || [];
    const currentIndex = threats.findIndex(t => t.ref === threatRef);
    
    if (currentIndex === -1) return;

    let nextCellKey: string | null = null;

    if (!shiftKey) {
      // Tab forward
      if (cellType === 'name') {
        nextCellKey = `${threatRef}-description`;
      } else if (cellType === 'description') {
        nextCellKey = `${threatRef}-items`;
      } else if (cellType === 'items') {
        // If we're on the last row, add a new threat
        if (currentIndex === threats.length - 1) {
          shouldFocusNewThreat.current = true;
          onAddThreat();
          return;
        } else {
          nextCellKey = `${threats[currentIndex + 1].ref}-name`;
        }
      }
    } else {
      // Shift+Tab backward
      if (cellType === 'items') {
        nextCellKey = `${threatRef}-description`;
      } else if (cellType === 'description') {
        nextCellKey = `${threatRef}-name`;
      } else if (cellType === 'name') {
        if (currentIndex > 0) {
          nextCellKey = `${threats[currentIndex - 1].ref}-items`;
        }
      }
    }

    if (nextCellKey) {
      focusCell(nextCellKey);
    }
  };

  const handleNavigate = (threatRef: string, cellType: 'name' | 'description' | 'items', direction: 'up' | 'down' | 'left' | 'right'): void => {
    const threats = threatModel?.threats || [];
    const currentIndex = threats.findIndex(t => t.ref === threatRef);
    
    if (currentIndex === -1) return;

    let nextCellKey: string | null = null;

    switch (direction) {
      case 'right':
        // Move to next cell in row
        if (cellType === 'name') {
          nextCellKey = `${threatRef}-description`;
        } else if (cellType === 'description') {
          nextCellKey = `${threatRef}-items`;
        } else if (cellType === 'items' && currentIndex < threats.length - 1) {
          nextCellKey = `${threats[currentIndex + 1].ref}-name`;
        }
        break;
      
      case 'left':
        // Move to previous cell in row
        if (cellType === 'items') {
          nextCellKey = `${threatRef}-description`;
        } else if (cellType === 'description') {
          nextCellKey = `${threatRef}-name`;
        } else if (cellType === 'name' && currentIndex > 0) {
          nextCellKey = `${threats[currentIndex - 1].ref}-items`;
        }
        break;
      
      case 'down':
        // Move to same column in next row
        if (currentIndex < threats.length - 1) {
          nextCellKey = `${threats[currentIndex + 1].ref}-${cellType}`;
        } else if (onNavigateToNextTable) {
          // At last row, navigate to next table
          onNavigateToNextTable(cellType);
          return;
        }
        break;
      
      case 'up':
        // Move to same column in previous row
        if (currentIndex > 0) {
          nextCellKey = `${threats[currentIndex - 1].ref}-${cellType}`;
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
      <h3>Threats</h3>
      <h4>What can go wrong?</h4>
      {threatModel?.threats && threatModel.threats.length > 0 && (
        <table>
          <colgroup>
            <col style={{ width: '20%' }} />
            <col style={{ width: 'auto' }} />
            <col style={{ width: '40px' }} />
            <col style={{ width: '20px' }} />
          </colgroup>
          <thead className="header-threats">
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th className="affected-items-th">Items</th>
              <th className="action-column"></th>
            </tr>
          </thead>
          <tbody>
            {threatModel.threats.map((threat) => (
              <tr key={threat.ref}>
                <td ref={(el) => { if (el) cellRefs.current.set(`${threat.ref}-name`, el); }}>
                  <EditableCell
                    value={threat.name}
                    onSave={(newName: string) => onThreatNameChange(threat.ref, newName)}
                    onTabPress={(shiftKey) => handleTabPress(threat.ref, 'name', shiftKey)}
                    onNavigate={(direction) => handleNavigate(threat.ref, 'name', direction)}
                  />
                </td>
                <td ref={(el) => { if (el) cellRefs.current.set(`${threat.ref}-description`, el); }}>
                  <EditableTextarea
                    value={threat.description || ''}
                    onSave={(newDescription: string) => onThreatDescriptionChange(threat.ref, newDescription)}
                    onTabPress={(shiftKey) => handleTabPress(threat.ref, 'description', shiftKey)}
                    onNavigate={(direction) => handleNavigate(threat.ref, 'description', direction)}
                  />
                </td>
                <td className="affected-items-td" ref={(el) => { if (el) cellRefs.current.set(`${threat.ref}-items`, el); }}>
                  <MultiPickerCell
                    title="Affected Items"
                    themeVariant="threats"
                    onTabPress={(shiftKey) => handleTabPress(threat.ref, 'items', shiftKey)}
                    onNavigate={(direction) => handleNavigate(threat.ref, 'items', direction)}
                    sections={[
                      {
                        label: 'Components',
                        value: threat.affected_components || [],
                        availableItems: threatModel?.components?.map((c) => ({ ref: c.ref, name: c.name })) || [],
                        placeholder: 'Add component...',
                        variant: 'components',
                        onChange: (newComponents) => onThreatAffectedComponentsChange(threat.ref, newComponents),
                      },
                      {
                        label: 'Data Flows',
                        value: threat.affected_data_flows || [],
                        availableItems: threatModel?.data_flows?.map((f) => {
                          const sourceComp = threatModel.components.find(c => c.ref === f.source);
                          const destComp = threatModel.components.find(c => c.ref === f.destination);
                          const flowDirection = f.direction === 'bidirectional'
                            ? `${sourceComp?.name || f.source} ↔ ${destComp?.name || f.destination}`
                            : `${sourceComp?.name || f.source} → ${destComp?.name || f.destination}`;
                          const displayName = f.label ? `${f.label}: ${flowDirection}` : flowDirection;
                          return { ref: f.ref, name: displayName };
                        }) || [],
                        placeholder: 'Add data flow...',
                        variant: 'dataflows',
                        onChange: (newDataFlows) => onThreatAffectedDataFlowsChange(threat.ref, newDataFlows),
                      },
                      {
                        label: 'Assets',
                        value: threat.affected_assets || [],
                        availableItems: threatModel?.assets?.map((a) => ({ ref: a.ref, name: a.name })) || [],
                        placeholder: 'Add asset...',
                        variant: 'assets',
                        onChange: (newAssets) => onThreatAffectedAssetsChange(threat.ref, newAssets),
                      },
                    ] satisfies PickerSection[]}
                  />
                </td>
                <td className="action-column">
                  <button
                    className="row-action-button remove-button"
                    onClick={() => onRemoveThreat(threat.ref)}
                    title="Remove threat"
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
        className="add-row-button add-row-threats"
        onClick={onAddThreat}
        title="Add threat"
      >
        + Add Threat
      </button>
    </div>
  );
}));

export default ThreatsTable;
