import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, ListTodo, Ellipsis, Check, X, Plus, Github, Lock, Activity, ShieldOff, SearchAlert } from 'lucide-react';
import { ControlStatus, ThreatStatus, Control, Threat, ThreatModel } from '../../types/threatModel';
import { GitHubMetadata } from '../../integrations/github/types';
import { useClickOutside } from '../../hooks/useClickOutside';
import { usePortalPosition } from '../../hooks/usePortalPosition';
import { generateGitHubIssueUrl } from '../../integrations/github/utils/githubIssueGenerator';
import './EditableStatusPickerCell.css';

interface StatusOption<T extends string> {
  value: T;
  label: string;
  color: string;
  icon: React.ComponentType<{ size: number }>;
  tooltip: string;
}

const CONTROL_STATUS_OPTIONS: StatusOption<ControlStatus>[] = [
  { value: 'To Do', label: 'To Do', color: 'gray', icon: Ellipsis, tooltip: 'Control has been identified but work has not started' },
  { value: 'In Progress', label: 'In Progress', color: 'blue', icon: ListTodo, tooltip: 'Control is currently being implemented' },
  { value: 'Done', label: 'Done', color: 'green', icon: Check, tooltip: 'Control has been fully implemented and verified' },
  { value: 'Cancelled', label: 'Cancelled', color: 'red', icon: X, tooltip: 'Control will not be implemented' },
];

const THREAT_STATUS_OPTIONS: StatusOption<ThreatStatus>[] = [
  { value: 'Evaluate', label: 'Evaluate', color: 'blue', icon: SearchAlert, tooltip: 'Threat requires further analysis and evaluation' },
  { value: 'Mitigate', label: 'Mitigate', color: 'green', icon: Lock, tooltip: 'Threat will be mitigated with controls' },
  { value: 'Accept', label: 'Accept', color: 'yellow', icon: Activity, tooltip: 'Threat is accepted as a known risk' },
  { value: 'Dismiss', label: 'Dismiss', color: 'gray', icon: ShieldOff, tooltip: 'Threat is not applicable to this system' },
];

type EditableStatusPickerCellProps =
  | {
      entityType: 'control';
      entity: Control;
      threatModel: ThreatModel;
      githubMetadata?: GitHubMetadata;
      onStatusChange?: (newStatus: ControlStatus | undefined) => void;
      onStatusLinkChange?: (newLink: string | undefined) => void;
      onStatusNoteChange?: (newNote: string | undefined) => void;
      onTabPress?: (shiftKey: boolean) => void;
      onNavigate?: (direction: 'up' | 'down' | 'left' | 'right') => void;
    }
  | {
      entityType: 'threat';
      entity: Threat;
      threatModel: ThreatModel;
      githubMetadata?: GitHubMetadata;
      onStatusChange?: (newStatus: ThreatStatus | undefined) => void;
      onStatusLinkChange?: (newLink: string | undefined) => void;
      onStatusNoteChange?: (newNote: string | undefined) => void;
      onTabPress?: (shiftKey: boolean) => void;
      onNavigate?: (direction: 'up' | 'down' | 'left' | 'right') => void;
    };

/**
 * Editable status cell that displays status and link in a vertical stack.
 * Opens a portal editor for changing both values.
 * Supports both Control and Threat entities with different status options.
 */
export default function EditableStatusPickerCell(
  props: EditableStatusPickerCellProps
): React.JSX.Element {
  const {
    entityType,
    entity,
    threatModel,
    githubMetadata,
    onStatusChange,
    onStatusLinkChange,
    onStatusNoteChange,
    onTabPress,
    onNavigate,
  } = props;

  const { status, status_link: statusLink, status_note: statusNote } = entity;
  const STATUS_OPTIONS = entityType === 'control' ? CONTROL_STATUS_OPTIONS : THREAT_STATUS_OPTIONS;
  const variantClass = entityType === 'control' ? 'status-picker-controls' : 'status-picker-threats';
  
  const [isOpen, setIsOpen] = useState(false);
  const [tempStatus, setTempStatus] = useState<ControlStatus | ThreatStatus | undefined>(status);
  const [tempLink, setTempLink] = useState<string>(statusLink || '');
  const [tempNote, setTempNote] = useState<string>(statusNote || '');
  const [linkError, setLinkError] = useState<string>('');
  
  const cellRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);
  const githubButtonRef = useRef<HTMLButtonElement>(null);
  const statusButtonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const clearStatusButtonRef = useRef<HTMLButtonElement>(null);

  // Generate GitHub issue URL if configured
  const githubIssueUrl = entityType === 'control' 
    ? generateGitHubIssueUrl({ control: entity, threatModel, metadata: githubMetadata })
    : generateGitHubIssueUrl({ threat: entity, threatModel, metadata: githubMetadata });

  // Calculate portal position with improved horizontal and vertical positioning
  const position = usePortalPosition(isOpen, cellRef, {
    estimatedHeight: 450,
    estimatedWidth: 350,
    minWidth: 280,
    padding: 16,
  });

  const validateUrl = (url: string): boolean => {
    if (!url) return true; // Empty is valid (optional field)
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleOpen = (): void => {
    setTempStatus(status);
    setTempLink(statusLink || '');
    setTempNote(statusNote || '');
    setLinkError('');
    setIsOpen(true);
  };

  // Auto-focus first status button when portal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        const firstButton = statusButtonRefs.current.get(0);
        if (firstButton) {
          firstButton.focus();
        }
      }, 0);
    }
  }, [isOpen]);

  const handleClose = (): void => {
    // Validate URL before saving
    if (tempLink && !validateUrl(tempLink)) {
      setLinkError('Please enter a valid HTTP or HTTPS URL');
      return;
    }
    
    // Save changes on close
    if (tempStatus !== status) {
      if (entityType === 'control') {
        (onStatusChange as ((newStatus: ControlStatus | undefined) => void) | undefined)?.(tempStatus as ControlStatus | undefined);
      } else {
        (onStatusChange as ((newStatus: ThreatStatus | undefined) => void) | undefined)?.(tempStatus as ThreatStatus | undefined);
      }
    }
    if (tempLink !== (statusLink || '')) {
      onStatusLinkChange?.(tempLink || undefined);
    }
    if (tempNote !== (statusNote || '')) {
      onStatusNoteChange?.(tempNote || undefined);
    }
    setIsOpen(false);
    
    // Return focus to the cell after closing
    setTimeout(() => {
      cellRef.current?.focus();
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (!isOpen) {
      // Handle navigation when closed
      if (e.key === 'Tab' && onTabPress) {
        e.preventDefault();
        onTabPress(e.shiftKey);
      } else if (onNavigate) {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          onNavigate('right');
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          onNavigate('left');
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          onNavigate('down');
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          onNavigate('up');
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleOpen();
        }
      }
    }
  };

  const handleStatusButtonKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number): void => {
    // Status buttons layout: 2x2 grid
    // [0: To Do]     [1: In Progress]
    // [2: Done]      [3: Cancelled]
    // Then Clear Status button below
    
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (index === 0 || index === 2) {
        // Move from left column to right column
        statusButtonRefs.current.get(index + 1)?.focus();
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (index === 1 || index === 3) {
        // Move from right column to left column
        statusButtonRefs.current.get(index - 1)?.focus();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (index === 0 || index === 1) {
        // Move from top row to bottom row
        statusButtonRefs.current.get(index + 2)?.focus();
      } else if (index === 2 || index === 3) {
        // Move from bottom row to Clear Status button
        if (tempStatus && clearStatusButtonRef.current) {
          clearStatusButtonRef.current.focus();
        }
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (index === 2 || index === 3) {
        // Move from bottom row to top row
        statusButtonRefs.current.get(index - 2)?.focus();
      }
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleStatusSelect(STATUS_OPTIONS[index].value);
    } else if (e.key === 'Tab' && !e.shiftKey) {
      // Tab from status buttons - move to link input
      e.preventDefault();
      linkInputRef.current?.focus();
    } else if (e.key === 'Tab' && e.shiftKey && index === 0) {
      // Shift+Tab from first status button - close and move to previous cell
      e.preventDefault();
      handleClose();
      if (onTabPress) {
        onTabPress(true);
      }
    }
  };

  const handleClearStatusKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      // Move back to bottom row of status buttons (default to Done)
      statusButtonRefs.current.get(2)?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClearStatus();
    } else if (e.key === 'Tab' && !e.shiftKey) {
      // Tab from clear status - move to link input
      e.preventDefault();
      linkInputRef.current?.focus();
    } else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      // Move back to last status button
      statusButtonRefs.current.get(STATUS_OPTIONS.length - 1)?.focus();
    }
  };

  const handlePortalKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      handleClose();
    }
  };

  // Close portal on click outside
  useClickOutside(portalRef, () => {
    if (isOpen) {
      handleClose();
    }
  }, isOpen);

  const handleStatusSelect = (newStatus: ControlStatus | ThreatStatus): void => {
    setTempStatus(newStatus);
    if (entityType === 'control') {
      (onStatusChange as ((newStatus: ControlStatus | undefined) => void) | undefined)?.(newStatus as ControlStatus);
    } else {
      (onStatusChange as ((newStatus: ThreatStatus | undefined) => void) | undefined)?.(newStatus as ThreatStatus);
    }
  };

  const handleClearStatus = (): void => {
    setTempStatus(undefined);
    onStatusChange?.(undefined);
    // After clearing, focus the first status button
    setTimeout(() => {
      statusButtonRefs.current.get(0)?.focus();
    }, 0);
  };

  const handleLinkChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const newValue = e.target.value;
    setTempLink(newValue);
    // Clear error when user starts typing
    if (linkError) {
      setLinkError('');
    }
  };

  const handleOpenLink = (): void => {
    if (tempLink) {
      window.open(tempLink, '_blank', 'noopener,noreferrer');
    }
  };

  const getStatusColor = (statusValue?: ControlStatus | ThreatStatus): string => {
    return STATUS_OPTIONS.find(opt => opt.value === statusValue)?.color || 'gray';
  };

  const getStatusLabel = (statusValue?: ControlStatus | ThreatStatus): string => {
    return STATUS_OPTIONS.find(opt => opt.value === statusValue)?.label || '';
  };

  return (
    <>
      <div className="status-cell-wrapper">
        <div 
          className={`status-button-group ${status ? `status-${getStatusColor(status)}` : 'status-empty-group'}`}
          ref={cellRef}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
        <button
          className="status-button-area"
          onClick={handleOpen}
          tabIndex={-1}
          title={status ? getStatusLabel(status) : 'Add status'}
        >
          {status ? (
            (() => {
              const option = STATUS_OPTIONS.find(opt => opt.value === status);
              if (!option) return null;
              const IconComponent = option.icon;
              return <IconComponent size={12} />;
            })()
          ) : (
            <Plus size={12} />
          )}
        </button>
        
        {statusLink && (
          <button
            className="link-button-area"
            onClick={(e) => {
              e.stopPropagation();
              window.open(statusLink, '_blank', 'noopener,noreferrer');
            }}
            tabIndex={-1}
            title={statusLink}
          >
            <ExternalLink size={12} />
          </button>
        )}
      </div>
      </div>

      {isOpen && createPortal(
        <div
          className={`status-picker-portal ${variantClass} ${position.renderUpward ? 'render-upward' : ''}`}
          ref={portalRef}
          onKeyDown={handlePortalKeyDown}
          style={{
            position: 'fixed',
            ...(position.renderUpward
              ? { bottom: `${window.innerHeight - position.top}px` }
              : { top: `${position.top}px` }),
            left: `${position.left}px`,
            width: `${position.width}px`,
            maxWidth: `${position.maxWidth}px`,
            zIndex: 10000,
          }}
        >
          <div className="status-picker-header">
            <h3 className="status-picker-title">Status</h3>
            <button className="status-picker-close" onClick={handleClose} tabIndex={-1}>
              ×
            </button>
          </div>
          <div className="status-picker-content">
            <div className="status-picker-section">
              <div className="status-options">
                {STATUS_OPTIONS.map((option, index) => {
                  const IconComponent = option.icon;
                  return (
                    <button
                      key={option.value}
                      ref={(el) => {
                        if (el) statusButtonRefs.current.set(index, el);
                      }}
                      className={`status-option status-${option.color} ${tempStatus === option.value ? 'selected' : ''}`}
                      onClick={() => handleStatusSelect(option.value)}
                      onKeyDown={(e) => handleStatusButtonKeyDown(e, index)}
                      title={option.tooltip}
                    >
                      <IconComponent size={16} />
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
              {tempStatus && (
                <button 
                  ref={clearStatusButtonRef}
                  className="clear-status-btn" 
                  onClick={handleClearStatus}
                  onKeyDown={handleClearStatusKeyDown}
                >
                  Clear Status
                </button>
              )}
            </div>

            <div className="status-picker-section">
              <label className="status-picker-label">Status Link</label>
              <div className="link-input-group">
                <input
                  ref={linkInputRef}
                  type="url"
                  className={`link-input ${linkError ? 'error' : ''}`}
                  placeholder="https://..."
                  value={tempLink}
                  onChange={handleLinkChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Tab' && e.shiftKey) {
                      e.preventDefault();
                      statusButtonRefs.current.get(STATUS_OPTIONS.length - 1)?.focus();
                    } else if (e.key === 'Tab' && !e.shiftKey) {
                      e.preventDefault();
                      if (githubIssueUrl && githubButtonRef.current) {
                        githubButtonRef.current.focus();
                      } else if (noteInputRef.current) {
                        noteInputRef.current.focus();
                      }
                    }
                  }}
                />
                {tempLink && (
                  <button 
                    className="open-link-btn" 
                    onClick={handleOpenLink}
                    title="Open link in new tab"
                    tabIndex={-1}
                  >
                    <ExternalLink size={16} />
                  </button>
                )}
              </div>
              {linkError && <div className="link-error">{linkError}</div>}
            </div>

            {githubIssueUrl && (
              <div className="status-picker-section">
                <button 
                  ref={githubButtonRef}
                  className="github-issue-btn"
                  onClick={() => window.open(githubIssueUrl, '_blank', 'noopener,noreferrer')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      window.open(githubIssueUrl, '_blank', 'noopener,noreferrer');
                    } else if (e.key === 'Tab' && e.shiftKey) {
                      e.preventDefault();
                      linkInputRef.current?.focus();
                    } else if (e.key === 'Tab' && !e.shiftKey) {
                      e.preventDefault();
                      noteInputRef.current?.focus();
                    }
                  }}
                  title={`Create GitHub issue for this ${entityType}`}
                >
                  <Github size={16} />
                  <span>Create GitHub Issue</span>
                </button>
              </div>
            )}

            <div className="status-picker-section">
              <label className="status-picker-label">Status Note</label>
              <textarea
                ref={noteInputRef}
                className="status-note-textarea"
                placeholder="Add implementation notes, rationale, or additional context..."
                value={tempNote}
                onChange={(e) => setTempNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Tab' && e.shiftKey) {
                    e.preventDefault();
                    if (githubIssueUrl && githubButtonRef.current) {
                      githubButtonRef.current.focus();
                    } else {
                      linkInputRef.current?.focus();
                    }
                  } else if (e.key === 'Tab' && !e.shiftKey) {
                    // Tab from last element - close and move to next cell
                    e.preventDefault();
                    handleClose();
                    if (onTabPress) {
                      onTabPress(false);
                    }
                  }
                }}
                rows={4}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
