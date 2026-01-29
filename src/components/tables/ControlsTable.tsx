import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import EditableCell from './EditableCell';
import EditableTextarea from './EditableTextarea';
import EditableStatusPickerCell from './EditableStatusPickerCell';
import MultiPickerCell, { PickerSection } from './MultiPickerCell';
import type { ThreatModel, ControlStatus } from '../../types/threatModel';
import type { GitHubMetadata } from '../integrations/github/types';

interface ControlsTableProps {
  threatModel: ThreatModel | null;
  githubMetadata?: GitHubMetadata;
  onControlNameChange: (ref: string, newName: string) => void;
  onControlDescriptionChange: (ref: string, newDescription: string) => void;
  onControlStatusChange: (ref: string, newStatus: ControlStatus | undefined) => void;
  onControlStatusLinkChange: (ref: string, newStatusLink: string | undefined) => void;
  onControlStatusNoteChange: (ref: string, newStatusNote: string | undefined) => void;
  onControlMitigatesChange: (ref: string, newThreats: string[]) => void;
  onControlImplementedInChange: (ref: string, newComponents: string[]) => void;
  onRemoveControl: (ref: string) => void;
  onAddControl: () => void;
  onNavigateToNextTable?: (columnIndex: number) => void;
  onNavigateToPreviousTable?: (columnIndex: number) => void;
}

export interface ControlsTableRef {
  focusCellByColumnIndex: (columnIndex: number, rowIndex?: number) => void;
}

const ControlsTable = React.memo(forwardRef<ControlsTableRef, ControlsTableProps>(function ControlsTable({
  threatModel,
  githubMetadata,
  onControlNameChange,
  onControlDescriptionChange,
  onControlStatusChange,
  onControlStatusLinkChange,
  onControlStatusNoteChange,
  onControlMitigatesChange,
  onControlImplementedInChange,
  onRemoveControl,
  onAddControl,
  onNavigateToNextTable,
  onNavigateToPreviousTable,
}, ref): React.JSX.Element {
  const cellRefs = useRef<Map<string, HTMLElement>>(new Map());
  const shouldFocusNewControl = useRef(false);

  const controls = threatModel?.controls || [];

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    focusCellByColumnIndex: (columnIndex: number, rowIndex: number = 0) => {
      if (controls.length > 0) {
        const targetIndex = Math.min(rowIndex, controls.length - 1);
        focusCell(controls[targetIndex].ref, columnIndex);
      }
    },
  }));

  useEffect(() => {
    if (shouldFocusNewControl.current && controls.length > 0) {
      const lastControl = controls[controls.length - 1];
      focusCell(lastControl.ref, 0);
      shouldFocusNewControl.current = false;
    }
  }, [controls]);

  const focusCell = (controlRef: string, columnIndex: number) => {
    const key = `${controlRef}-${columnIndex}`;
    const element = cellRefs.current.get(key);
    if (element) {
      // For all columns, find the focusable element inside
      const focusable = element.querySelector('[tabindex="0"], input, textarea') as HTMLElement;
      if (focusable) {
        focusable.focus();
      }
    }
  };

  const handleTabPress = (controlRef: string, columnIndex: number, shiftKey: boolean) => {
    const controlIndex = controls.findIndex((c) => c.ref === controlRef);
    if (controlIndex === -1) return;

    if (shiftKey) {
      // Moving backwards
      if (columnIndex > 0) {
        // Move to previous column in same row
        focusCell(controlRef, columnIndex - 1);
      } else if (controlIndex > 0) {
        // Move to status column of previous row
        focusCell(controls[controlIndex - 1].ref, 3);
      }
    } else {
      // Moving forwards
      if (columnIndex < 3) {
        // Move to next column in same row
        focusCell(controlRef, columnIndex + 1);
      } else if (controlIndex < controls.length - 1) {
        // Move to first column of next row
        focusCell(controls[controlIndex + 1].ref, 0);
      } else {
        // Last cell of last row - create new control
        shouldFocusNewControl.current = true;
        onAddControl();
      }
    }
  };

  const handleNavigate = (controlRef: string, columnIndex: number, direction: 'up' | 'down' | 'left' | 'right') => {
    const controlIndex = controls.findIndex((c) => c.ref === controlRef);
    if (controlIndex === -1) return;

    if (direction === 'up') {
      if (controlIndex > 0) {
        focusCell(controls[controlIndex - 1].ref, columnIndex);
      } else if (onNavigateToPreviousTable) {
        // At first row, navigate to previous table
        onNavigateToPreviousTable(columnIndex);
      }
    } else if (direction === 'down') {
      if (controlIndex < controls.length - 1) {
        focusCell(controls[controlIndex + 1].ref, columnIndex);
      } else if (onNavigateToNextTable) {
        // At last row, navigate to next table
        onNavigateToNextTable(columnIndex);
      }
    } else if (direction === 'left') {
      if (columnIndex > 0) {
        focusCell(controlRef, columnIndex - 1);
      } else if (controlIndex > 0) {
        // Wrap to last column of previous row
        focusCell(controls[controlIndex - 1].ref, 3);
      }
    } else if (direction === 'right') {
      if (columnIndex < 3) {
        focusCell(controlRef, columnIndex + 1);
      } else if (controlIndex < controls.length - 1) {
        // Wrap to first column of next row
        focusCell(controls[controlIndex + 1].ref, 0);
      }
    }
  };

  const handlePickerTabPress = (controlRef: string, shiftKey: boolean) => {
    // When exiting MultiPickerCell with Tab
    const controlIndex = controls.findIndex((c) => c.ref === controlRef);
    if (controlIndex === -1) return;

    if (shiftKey) {
      // Move to description (column 1)
      focusCell(controlRef, 1);
    } else {
      // Move to status column (column 3)
      focusCell(controlRef, 3);
    }
  };

  return (
    <div className="table-container">
      <h3>Controls</h3>
      <h4>What are we going to do about it?</h4>
      {controls.length > 0 && (
        <table>
          <colgroup>
            <col style={{ width: '20%' }} />
            <col style={{ width: 'auto' }} />
            <col style={{ width: '40px' }} />
            <col style={{ width: '40px' }} />
            <col style={{ width: '20px' }} />
          </colgroup>
          <thead className="header-controls">
            <tr>
              <th>Name</th>
              <th>Description</th>

              <th className="control-items-th">Items</th>
              <th className="status-column-th">Status</th>
              <th className="action-column"></th>
            </tr>
          </thead>
          <tbody>
            {controls.map((control) => (
              <tr key={control.ref}>
                <td>
                  <div
                    ref={(el: HTMLDivElement | null) => {
                      if (el) {
                        cellRefs.current.set(`${control.ref}-0`, el);
                      }
                    }}
                  >
                    <EditableCell
                      value={control.name}
                      onSave={(newName: string) => onControlNameChange(control.ref, newName)}
                      onTabPress={(shiftKey) => handleTabPress(control.ref, 0, shiftKey)}
                      onNavigate={(direction) => handleNavigate(control.ref, 0, direction)}
                    />
                  </div>
                </td>
                <td>
                  <div
                    ref={(el: HTMLDivElement | null) => {
                      if (el) {
                        cellRefs.current.set(`${control.ref}-1`, el);
                      }
                    }}
                  >
                    <EditableTextarea
                      value={control.description || ''}
                      onSave={(newDescription: string) => onControlDescriptionChange(control.ref, newDescription)}
                      onTabPress={(shiftKey) => handleTabPress(control.ref, 1, shiftKey)}
                      onNavigate={(direction) => handleNavigate(control.ref, 1, direction)}
                    />
                  </div>
                </td>
                <td
                  className="control-items-td"
                  ref={(el: HTMLTableCellElement | null) => {
                    if (el) {
                      cellRefs.current.set(`${control.ref}-2`, el);
                    }
                  }}
                >
                  <MultiPickerCell
                    title="Affected Items"
                    themeVariant="controls"
                    sections={[
                      {
                        label: 'Mitigates',
                        value: control.mitigates || [],
                        availableItems: threatModel?.threats?.map((t) => ({ ref: t.ref, name: t.name })) || [],
                        placeholder: 'Add threat...',
                        variant: 'threats',
                        onChange: (newThreats) => onControlMitigatesChange(control.ref, newThreats),
                      },
                      {
                        label: 'Implemented In',
                        value: control.implemented_in || [],
                        availableItems: threatModel?.components?.map((c) => ({ ref: c.ref, name: c.name })) || [],
                        placeholder: 'Add component...',
                        variant: 'components',
                        onChange: (newComponents) => onControlImplementedInChange(control.ref, newComponents),
                      },
                    ] satisfies PickerSection[]}
                    estimatedHeight={220}
                    onTabPress={(shiftKey) => handlePickerTabPress(control.ref, shiftKey)}
                    onNavigate={(direction) => handleNavigate(control.ref, 2, direction)}
                  />
                </td>
                <td className="status-column-td">
                  <div
                    ref={(el: HTMLDivElement | null) => {
                      if (el) {
                        cellRefs.current.set(`${control.ref}-3`, el);
                      }
                    }}
                  >
                    {threatModel && (
                      <EditableStatusPickerCell
                        control={control}
                        threatModel={threatModel}
                        githubMetadata={githubMetadata}
                        onStatusChange={(newStatus) => onControlStatusChange(control.ref, newStatus)}
                        onStatusLinkChange={(newLink) => onControlStatusLinkChange(control.ref, newLink)}
                        onStatusNoteChange={(newNote) => onControlStatusNoteChange(control.ref, newNote)}
                        onTabPress={(shiftKey) => handleTabPress(control.ref, 3, shiftKey)}
                        onNavigate={(direction) => handleNavigate(control.ref, 3, direction)}
                      />
                    )}
                  </div>
                </td>                
                <td className="action-column">
                  <button
                    className="row-action-button remove-button"
                    onClick={() => onRemoveControl(control.ref)}
                    title="Remove control"
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
        className="add-row-button add-row-controls"
        onClick={onAddControl}
        title="Add control"
      >
        + Add Control
      </button>
    </div>
  );
}));

export default ControlsTable;
