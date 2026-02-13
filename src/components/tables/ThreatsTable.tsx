import React, { useRef, useEffect, useImperativeHandle, forwardRef, useState } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent } from '@dnd-kit/core';
import EditableCell from './EditableCell';
import EditableTextarea from './EditableTextarea';
import EditableStatusPickerCell from './EditableStatusPickerCell';
import MultiPickerCell, { PickerSection } from './MultiPickerCell';
import SortableTableRow from './SortableTableRow';
import type { ThreatModel, ThreatStatus } from '../../types/threatModel';
import type { GitHubMetadata } from '../integrations/github/types';
import { Info } from 'lucide-react';
import { isThreatNamePlaceholder } from '../../utils/refGenerators';

interface ThreatsTableProps {
  threatModel: ThreatModel | null;
  githubMetadata?: GitHubMetadata;
  onThreatNameChange: (ref: string, newName: string) => void;
  onThreatDescriptionChange: (ref: string, newDescription: string) => void;
  onThreatAffectedComponentsChange: (ref: string, newComponents: string[]) => void;
  onThreatAffectedDataFlowsChange: (ref: string, newDataFlows: string[]) => void;
  onThreatAffectedAssetsChange: (ref: string, newAssets: string[]) => void;
  onThreatStatusChange: (ref: string, newStatus: ThreatStatus | undefined) => void;
  onThreatStatusLinkChange: (ref: string, newLink: string | undefined) => void;
  onThreatStatusNoteChange: (ref: string, newNote: string | undefined) => void;
  onRemoveThreat: (ref: string) => void;
  onAddThreat: () => void;
  onReorderThreats: (newOrder: string[]) => void;
  onNavigateToNextTable?: (column: 'name' | 'description' | 'items' | 'status') => void;
  onNavigateToPreviousTable?: (column: 'name' | 'description' | 'items' | 'status') => void;
}

export interface ThreatsTableRef {
  focusCellByColumn: (column: 'name' | 'description' | 'items' | 'status', rowIndex?: number) => void;
}

const ThreatsTable = React.memo(forwardRef<ThreatsTableRef, ThreatsTableProps>(function ThreatsTable({
  threatModel,
  githubMetadata,
  onThreatNameChange,
  onThreatDescriptionChange,
  onThreatAffectedComponentsChange,
  onThreatAffectedDataFlowsChange,
  onThreatAffectedAssetsChange,
  onThreatStatusChange,
  onThreatStatusLinkChange,
  onThreatStatusNoteChange,
  onRemoveThreat,
  onAddThreat,
  onReorderThreats,
  onNavigateToNextTable,
  onNavigateToPreviousTable,
}, ref): React.JSX.Element {
  const cellRefs = useRef<Map<string, HTMLElement>>(new Map());
  const shouldFocusNewThreat = useRef(false);
  const previousThreatCount = useRef(threatModel?.threats?.length || 0);
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
      const threats = threatModel?.threats || [];
      const oldIndex = threats.findIndex((threat) => threat.ref === active.id);
      const newIndex = threats.findIndex((threat) => threat.ref === over.id);

      const newOrder = arrayMove(threats, oldIndex, newIndex).map((threat) => threat.ref);
      onReorderThreats(newOrder);
    }
    setActiveId(null);
  };

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    focusCellByColumn: (column: 'name' | 'description' | 'items' | 'status', rowIndex: number = 0) => {
      const threats = threatModel?.threats || [];
      if (threats.length > 0) {
        const targetIndex = Math.min(rowIndex, threats.length - 1);
        const cellKey = `${threats[targetIndex].ref}-${column}`;
        // Focus after a brief delay to ensure rendering completes
        setTimeout(() => focusCell(cellKey), 50);
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

  const handleTabPress = (threatRef: string, cellType: 'name' | 'description' | 'items' | 'status', shiftKey: boolean): void => {
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
        nextCellKey = `${threatRef}-status`;
      } else if (cellType === 'status') {
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
      if (cellType === 'status') {
        nextCellKey = `${threatRef}-items`;
      } else if (cellType === 'items') {
        nextCellKey = `${threatRef}-description`;
      } else if (cellType === 'description') {
        nextCellKey = `${threatRef}-name`;
      } else if (cellType === 'name') {
        if (currentIndex > 0) {
          nextCellKey = `${threats[currentIndex - 1].ref}-status`;
        }
      }
    }

    if (nextCellKey) {
      focusCell(nextCellKey);
    }
  };

  const handleNavigate = (threatRef: string, cellType: 'name' | 'description' | 'items' | 'status', direction: 'up' | 'down' | 'left' | 'right'): void => {
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
        } else if (cellType === 'items') {
          nextCellKey = `${threatRef}-status`;
        } else if (cellType === 'status' && currentIndex < threats.length - 1) {
          nextCellKey = `${threats[currentIndex + 1].ref}-name`;
        }
        break;
      
      case 'left':
        // Move to previous cell in row
        if (cellType === 'status') {
          nextCellKey = `${threatRef}-items`;
        } else if (cellType === 'items') {
          nextCellKey = `${threatRef}-description`;
        } else if (cellType === 'description') {
          nextCellKey = `${threatRef}-name`;
        } else if (cellType === 'name' && currentIndex > 0) {
          nextCellKey = `${threats[currentIndex - 1].ref}-status`;
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
    <div className="table-section">
      <div className="table-header">
        <span>Threats</span>
        <span className="header-help-icon" data-tooltip='Potential risks or vulnerabilities that could impact the system.'>
          <Info size={16} />
        </span>
      </div>
      <div className="table-content">
          <div className={`table-container ${activeId ? 'dragging' : ''}`}>
            {threatModel?.threats && threatModel.threats.length > 0 && (
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
              <col style={{ width: 'auto' }} />
              <col style={{ width: '40px' }} />
              <col style={{ width: '45px' }} />
              <col style={{ width: '35px' }} />
            </colgroup>
            <thead className="header-threats">
              <tr>
                <th></th>
                <th>Name</th>
                <th>Description</th>
                <th className="affected-items-th">Items</th>
                <th className="status-column-th">Status</th>
                <th className="action-column"></th>
              </tr>
            </thead>
            <SortableContext
              items={threatModel.threats.map((threat) => threat.ref)}
              strategy={verticalListSortingStrategy}
            >
              <tbody>
                {threatModel.threats.map((threat) => (
                  <SortableTableRow key={threat.ref} id={threat.ref}>
                <td ref={(el) => { if (el) cellRefs.current.set(`${threat.ref}-name`, el); }}>
                  <EditableCell
                    value={threat.name}
                    placeholder={isThreatNamePlaceholder(threat.name) ? threat.name : undefined}
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
                        label: 'Assets',
                        value: threat.affected_assets || [],
                        availableItems: threatModel?.assets?.map((a) => ({ ref: a.ref, name: a.name })) || [],
                        placeholder: 'Add asset...',
                        variant: 'assets',
                        onChange: (newAssets) => onThreatAffectedAssetsChange(threat.ref, newAssets),
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
                    ] satisfies PickerSection[]}
                  />
                </td>
                <td className="status-column-td">
                  <div ref={(el) => { if (el) cellRefs.current.set(`${threat.ref}-status`, el); }}>
                    {threatModel && (
                      <EditableStatusPickerCell
                        entityType="threat"
                        entity={threat}
                        threatModel={threatModel}
                        githubMetadata={githubMetadata}
                        onStatusChange={(newStatus) => onThreatStatusChange(threat.ref, newStatus)}
                        onStatusLinkChange={(newLink) => onThreatStatusLinkChange(threat.ref, newLink)}
                        onStatusNoteChange={(newNote) => onThreatStatusNoteChange(threat.ref, newNote)}
                        onTabPress={(shiftKey) => handleTabPress(threat.ref, 'status', shiftKey)}
                        onNavigate={(direction) => handleNavigate(threat.ref, 'status', direction)}
                      />
                    )}
                  </div>
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
              {threatModel?.threats?.find((t) => t.ref === activeId)?.name || 'Threat'}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )}
            <button
              className="add-row-button add-row-threats"
              onClick={onAddThreat}
              title="Add threat"
            >
              + Add Threat
            </button>
          </div>
        </div>
    </div>
  );
}));

export default ThreatsTable;
