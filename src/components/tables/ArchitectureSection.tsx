import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import EditableCell from './EditableCell';
import EditableTextarea from './EditableTextarea';
import EditableDirectionCell from './EditableDirectionCell';
import type { ThreatModel, Direction } from '../../types/threatModel';
import { isDataFlowLabelPlaceholder, isBoundaryNamePlaceholder } from '../../utils/refGenerators';

/**
 * Collapsible Architecture Section containing Boundaries and Data Flows
 */
export interface ArchitectureSectionProps {
  threatModel: ThreatModel | null;
  handleBoundaryNameChange: (ref: string, name: string) => void;
  handleBoundaryDescriptionChange: (ref: string, desc: string) => void;
  handleDataFlowDirectionChange: (ref: string, direction: Direction) => void;
  handleDataFlowLabelChange: (ref: string, label: string) => void;
  handleRemoveBoundary: (ref: string) => void;
  handleRemoveDataFlow: (ref: string) => void;
  onNavigateToPreviousTable?: (table: 'boundary' | 'dataflow', column: string) => void;
  onNavigateToNextTable?: (table: 'boundary' | 'dataflow', column: string) => void;
}

export interface ArchitectureSectionRef {
  focusCell: (table: 'boundary' | 'dataflow', column: string, rowIndex?: number) => void;
}

const ArchitectureSection = React.memo(forwardRef<ArchitectureSectionRef, ArchitectureSectionProps>(function ArchitectureSection({
  threatModel,
  handleBoundaryNameChange,
  handleBoundaryDescriptionChange,
  handleDataFlowDirectionChange,
  handleDataFlowLabelChange,
  handleRemoveBoundary,
  handleRemoveDataFlow,
  onNavigateToPreviousTable,
  onNavigateToNextTable,
}, ref): React.JSX.Element | null {
  const [isExpanded, setIsExpanded] = useState(false);
  const cellRefs = useRef<Map<string, HTMLElement>>(new Map());

  const hasContent = 
    (threatModel?.boundaries && threatModel.boundaries.length > 0) ||
    (threatModel?.data_flows && threatModel.data_flows.length > 0);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    focusCell: (table: 'boundary' | 'dataflow', column: string, rowIndex: number = 0) => {
      let items: any[] = [];
      let cellKey = '';
      
      if (table === 'boundary') {
        items = threatModel?.boundaries || [];
        if (items.length > 0) {
          const targetIndex = Math.min(rowIndex, items.length - 1);
          cellKey = `boundary-${items[targetIndex].ref}-${column}`;
        }
      } else if (table === 'dataflow') {
        items = threatModel?.data_flows || [];
        if (items.length > 0) {
          const targetIndex = Math.min(rowIndex, items.length - 1);
          cellKey = `dataflow-${items[targetIndex].ref}-${column}`;
        }
      }
      
      if (cellKey) {
        // Expand section if not already expanded
        setIsExpanded(true);
        // Focus after a brief delay to ensure expansion completes
        setTimeout(() => focusCellInternal(cellKey), 50);
      }
    },
  }));

  if (!hasContent) return null;

  const focusCellInternal = (cellKey: string): void => {
    const cell = cellRefs.current.get(cellKey);
    if (cell) {
      const input = cell.querySelector('input, textarea, select, [tabindex="0"]');
      if (input) {
        (input as HTMLElement).focus();
      }
    }
  };

  // Boundaries table navigation
  const handleBoundaryTabPress = (boundaryRef: string, cellType: 'name' | 'description', shiftKey: boolean): void => {
    const boundaries = threatModel?.boundaries || [];
    const currentIndex = boundaries.findIndex(b => b.ref === boundaryRef);
    
    if (currentIndex === -1) return;

    let nextCellKey: string | null = null;

    if (!shiftKey) {
      // Tab forward
      if (cellType === 'name') {
        nextCellKey = `boundary-${boundaryRef}-description`;
      } else if (cellType === 'description') {
        // Move to name of next boundary, or first data flow
        if (currentIndex < boundaries.length - 1) {
          nextCellKey = `boundary-${boundaries[currentIndex + 1].ref}-name`;
        } else if (threatModel?.data_flows && threatModel.data_flows.length > 0) {
          nextCellKey = `dataflow-${threatModel.data_flows[0].ref}-direction`;
        }
      }
    } else {
      // Shift+Tab backward
      if (cellType === 'description') {
        nextCellKey = `boundary-${boundaryRef}-name`;
      } else if (cellType === 'name') {
        // Move to description of previous boundary or navigate up
        if (currentIndex > 0) {
          nextCellKey = `boundary-${boundaries[currentIndex - 1].ref}-description`;
        } else if (onNavigateToPreviousTable) {
          onNavigateToPreviousTable('boundary', cellType);
          return;
        }
      }
    }

    if (nextCellKey) {
      focusCellInternal(nextCellKey);
    }
  };

  const handleBoundaryNavigate = (boundaryRef: string, cellType: 'name' | 'description', direction: 'up' | 'down' | 'left' | 'right'): void => {
    const boundaries = threatModel?.boundaries || [];
    const currentIndex = boundaries.findIndex(b => b.ref === boundaryRef);
    
    if (currentIndex === -1) return;

    let nextCellKey: string | null = null;

    switch (direction) {
      case 'right':
        // Move to next cell in row
        if (cellType === 'name') {
          nextCellKey = `boundary-${boundaryRef}-description`;
        } else if (cellType === 'description' && currentIndex < boundaries.length - 1) {
          // Wrap to first column of next row
          nextCellKey = `boundary-${boundaries[currentIndex + 1].ref}-name`;
        }
        break;
      
      case 'left':
        // Move to previous cell in row
        if (cellType === 'description') {
          nextCellKey = `boundary-${boundaryRef}-name`;
        } else if (cellType === 'name' && currentIndex > 0) {
          // Wrap to last column of previous row
          nextCellKey = `boundary-${boundaries[currentIndex - 1].ref}-description`;
        }
        break;
      
      case 'down':
        // Move to same column in next row
        if (currentIndex < boundaries.length - 1) {
          nextCellKey = `boundary-${boundaries[currentIndex + 1].ref}-${cellType}`;
        } else {
          // At last boundary, move to first data flow
          if (threatModel?.data_flows && threatModel.data_flows.length > 0) {
            const flowColumn = cellType === 'name' ? 'direction' : 'label';
            nextCellKey = `dataflow-${threatModel.data_flows[0].ref}-${flowColumn}`;
          }
        }
        break;
      
      case 'up':
        // Move to same column in previous row
        if (currentIndex > 0) {
          nextCellKey = `boundary-${boundaries[currentIndex - 1].ref}-${cellType}`;
        } else if (onNavigateToPreviousTable) {
          // At first row, navigate to previous table (last component)
          onNavigateToPreviousTable('boundary', cellType);
          return;
        }
        break;
    }

    if (nextCellKey) {
      focusCellInternal(nextCellKey);
    }
  };

  // Data flows table navigation
  const handleDataFlowTabPress = (flowRef: string, cellType: 'direction' | 'label', shiftKey: boolean): void => {
    const flows = threatModel?.data_flows || [];
    const currentIndex = flows.findIndex(f => f.ref === flowRef);
    
    if (currentIndex === -1) return;

    let nextCellKey: string | null = null;

    if (!shiftKey) {
      // Tab forward
      if (cellType === 'direction') {
        nextCellKey = `dataflow-${flowRef}-label`;
      } else if (cellType === 'label') {
        // Move to direction of next flow
        if (currentIndex < flows.length - 1) {
          nextCellKey = `dataflow-${flows[currentIndex + 1].ref}-direction`;
        }
      }
    } else {
      // Shift+Tab backward
      if (cellType === 'label') {
        nextCellKey = `dataflow-${flowRef}-direction`;
      } else if (cellType === 'direction') {
        // Move to label of previous flow or last boundary
        if (currentIndex > 0) {
          nextCellKey = `dataflow-${flows[currentIndex - 1].ref}-label`;
        } else if (threatModel?.boundaries && threatModel.boundaries.length > 0) {
          const lastBoundary = threatModel.boundaries[threatModel.boundaries.length - 1];
          nextCellKey = `boundary-${lastBoundary.ref}-description`;
        } else if (onNavigateToPreviousTable) {
          onNavigateToPreviousTable('dataflow', cellType);
          return;
        }
      }
    }

    if (nextCellKey) {
      focusCellInternal(nextCellKey);
    }
  };

  const handleDataFlowNavigate = (flowRef: string, cellType: 'direction' | 'label', direction: 'up' | 'down' | 'left' | 'right'): void => {
    const flows = threatModel?.data_flows || [];
    const currentIndex = flows.findIndex(f => f.ref === flowRef);
    
    if (currentIndex === -1) return;

    let nextCellKey: string | null = null;

    switch (direction) {
      case 'right':
        // Move to next cell in row
        if (cellType === 'direction') {
          nextCellKey = `dataflow-${flowRef}-label`;
        } else if (cellType === 'label' && currentIndex < flows.length - 1) {
          // Wrap to first column of next row
          nextCellKey = `dataflow-${flows[currentIndex + 1].ref}-direction`;
        }
        break;
      
      case 'left':
        // Move to previous cell in row
        if (cellType === 'label') {
          nextCellKey = `dataflow-${flowRef}-direction`;
        } else if (cellType === 'direction' && currentIndex > 0) {
          // Wrap to last column of previous row
          nextCellKey = `dataflow-${flows[currentIndex - 1].ref}-label`;
        }
        break;
      
      case 'down':
        // Move to same column in next row
        if (currentIndex < flows.length - 1) {
          nextCellKey = `dataflow-${flows[currentIndex + 1].ref}-${cellType}`;
        } else if (onNavigateToNextTable) {
          // At last row, navigate to next table (threats)
          onNavigateToNextTable('dataflow', cellType);
          return;
        }
        break;
      
      case 'up':
        // Move to same column in previous row
        if (currentIndex > 0) {
          nextCellKey = `dataflow-${flows[currentIndex - 1].ref}-${cellType}`;
        } else if (onNavigateToPreviousTable) {
          // At first row, navigate to previous table (last boundary or last component)
          onNavigateToPreviousTable('dataflow', cellType);
          return;
        }
        break;
    }

    if (nextCellKey) {
      focusCellInternal(nextCellKey);
    }
  };

  return (
    <div className="architecture-section">
      <button 
        className="architecture-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className={`architecture-toggle-icon ${isExpanded ? 'expanded' : ''}`}>▶</span>
        <span>Diagram Artifacts</span>
      </button>
      
      {isExpanded && (
        <div className="architecture-content">
          {/* Boundaries Table */}
          {threatModel?.boundaries && threatModel.boundaries.length > 0 && (
            <div className="table-container">
              <h3>Boundaries</h3>
              <h4>Trust boundaries in the system</h4>
              <table>
                <colgroup>
                  <col style={{ width: '20%' }} />
                  <col style={{ width: 'auto' }} />
                  <col style={{ width: '30%' }} />
                  <col style={{ width: '35px' }} />
                </colgroup>
                <thead className="header-boundaries">
                  <tr>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Components</th>
                    <th className="action-column"></th>
                  </tr>
                </thead>
                <tbody>
                  {threatModel.boundaries.map((boundary) => (
                    <tr key={boundary.ref}>
                      <td ref={(el) => { if (el) cellRefs.current.set(`boundary-${boundary.ref}-name`, el); }}>
                        <EditableCell
                          value={boundary.name}
                          placeholder={isBoundaryNamePlaceholder(boundary.name) ? boundary.name : undefined}
                          onSave={(newName: string) => handleBoundaryNameChange(boundary.ref, newName)}
                          onTabPress={(shiftKey) => handleBoundaryTabPress(boundary.ref, 'name', shiftKey)}
                          onNavigate={(direction) => handleBoundaryNavigate(boundary.ref, 'name', direction)}
                        />
                      </td>
                      <td ref={(el) => { if (el) cellRefs.current.set(`boundary-${boundary.ref}-description`, el); }}>
                        <EditableTextarea
                          value={boundary.description || ''}
                          onSave={(newDescription: string) => handleBoundaryDescriptionChange(boundary.ref, newDescription)}
                          onTabPress={(shiftKey) => handleBoundaryTabPress(boundary.ref, 'description', shiftKey)}
                          onNavigate={(direction) => handleBoundaryNavigate(boundary.ref, 'description', direction)}
                        />
                      </td>
                      <td>
                        <div className='picker-readonly-wrapper'>
                        {(boundary.components || []).map((compRef) => {
                          const comp = threatModel?.components?.find((c) => c.ref === compRef);
                          return comp ? (

                            <span key={compRef} className="picker-tag-readonly picker-variant-components">
                              {comp.name}
                            </span>
                          ) : null;
                        })}
                        </div>
                        {(!boundary.components || boundary.components.length === 0) && (
                          <span className="no-items-text">-</span>
                        )}
                      </td>
                      <td className="action-column">
                        <button
                          className="row-action-button remove-button"
                          onClick={() => handleRemoveBoundary(boundary.ref)}
                          title="Remove boundary"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Data Flows Table */}
          {threatModel?.data_flows && threatModel.data_flows.length > 0 && (
            <div className="table-container">
              <h3>Data Flows</h3>
              <h4>Connections between components with data flowing between them</h4>
              <table>
                <colgroup>
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: 'auto' }} />
                  <col style={{ width: '35px' }} />
                </colgroup>
                <thead className="header-dataflows">
                  <tr>
                    <th>Source</th>
                    <th>Destination</th>
                    <th>Direction</th>
                    <th>Label</th>
                    <th className="action-column"></th>
                  </tr>
                </thead>
                <tbody>
                  {threatModel.data_flows.map((flow) => {
                    const sourceComp = threatModel.components.find(c => c.ref === flow.source);
                    const destComp = threatModel.components.find(c => c.ref === flow.destination);
                    
                    return (
                      <tr key={flow.ref}>
                        <td>{sourceComp?.name || flow.source}</td>
                        <td>{destComp?.name || flow.destination}</td>
                        <td ref={(el) => { if (el) cellRefs.current.set(`dataflow-${flow.ref}-direction`, el); }}>
                          <EditableDirectionCell
                            value={flow.direction || 'unidirectional'}
                            onSave={(newDirection) => handleDataFlowDirectionChange(flow.ref, newDirection)}
                            onTabPress={(shiftKey) => handleDataFlowTabPress(flow.ref, 'direction', shiftKey)}
                            onNavigate={(direction) => handleDataFlowNavigate(flow.ref, 'direction', direction)}
                          />
                        </td>
                        <td ref={(el) => { if (el) cellRefs.current.set(`dataflow-${flow.ref}-label`, el); }}>
                          <EditableCell
                            value={flow.label || ''}
                            placeholder={flow.label && isDataFlowLabelPlaceholder(flow.label) ? flow.label : undefined}
                            onSave={(newLabel: string) => handleDataFlowLabelChange(flow.ref, newLabel)}
                            onTabPress={(shiftKey) => handleDataFlowTabPress(flow.ref, 'label', shiftKey)}
                            onNavigate={(direction) => handleDataFlowNavigate(flow.ref, 'label', direction)}
                          />
                        </td>
                        <td className="action-column">
                          <button
                            className="row-action-button remove-button"
                            onClick={() => handleRemoveDataFlow(flow.ref)}
                            title="Remove data flow"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}), (prevProps, nextProps) => {
  // Only re-render if architecture-related data changed
  return prevProps.threatModel?.boundaries === nextProps.threatModel?.boundaries &&
         prevProps.threatModel?.data_flows === nextProps.threatModel?.data_flows &&
         prevProps.threatModel?.components === nextProps.threatModel?.components &&
         prevProps.handleBoundaryNameChange === nextProps.handleBoundaryNameChange &&
         prevProps.handleBoundaryDescriptionChange === nextProps.handleBoundaryDescriptionChange &&
         prevProps.handleDataFlowDirectionChange === nextProps.handleDataFlowDirectionChange &&
         prevProps.handleDataFlowLabelChange === nextProps.handleDataFlowLabelChange &&
         prevProps.handleRemoveBoundary === nextProps.handleRemoveBoundary &&
         prevProps.handleRemoveDataFlow === nextProps.handleRemoveDataFlow &&
         prevProps.onNavigateToPreviousTable === nextProps.onNavigateToPreviousTable;
});

export default ArchitectureSection;
