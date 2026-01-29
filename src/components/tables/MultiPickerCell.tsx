import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './MultiPickerCell.css';
import EditablePicker, { PickerItem } from './EditablePicker';
import { usePortalPosition } from '../../hooks/usePortalPosition';
import { useClickOutside } from '../../hooks/useClickOutside';

export interface PickerSection {
  label: string;
  value: string[];
  availableItems: PickerItem[];
  placeholder: string;
  variant: 'components' | 'dataflows' | 'assets' | 'threats';
  badgeClass?: string;
  onChange: (refs: string[]) => void;
}

type ThemeVariant = 'threats' | 'controls';

interface MultiPickerCellProps {
  sections: PickerSection[];
  title?: string;
  themeVariant?: ThemeVariant;
  className?: string;
  estimatedHeight?: number;
  onTabPress?: (shiftKey: boolean) => void;
  onNavigate?: (direction: 'up' | 'down' | 'left' | 'right') => void;
}

export default function MultiPickerCell({
  sections,
  title = 'Affected Items',
  themeVariant = 'threats',
  className = 'multi-picker-cell',
  estimatedHeight = 280,
  onTabPress,
  onNavigate,
}: MultiPickerCellProps): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activePickerIndex, setActivePickerIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const expandedRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const pickerSaveCallbacksRef = useRef<Map<number, () => void>>(new Map());

  const position = usePortalPosition(isExpanded, containerRef, {
    estimatedHeight,
    estimatedWidth: 400,
    minWidth: 320,
    padding: 16,
  });

  const totalCount = sections.reduce((sum, section) => sum + section.value.length, 0);

  // Auto-focus the first section when expanded
  useEffect(() => {
    if (isExpanded) {
      setActivePickerIndex(0);
    } else {
      setActivePickerIndex(null);
    }
  }, [isExpanded]);

  // Scroll to active picker section and focus it
  useEffect(() => {
    if (activePickerIndex !== null && sectionRefs.current.has(activePickerIndex)) {
      const sectionElement = sectionRefs.current.get(activePickerIndex);
      if (sectionElement) {
        sectionElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        // Focus the picker wrapper within this section
        const pickerWrapper = sectionElement.querySelector('.editable-picker-wrapper') as HTMLElement;
        if (pickerWrapper) {
          setTimeout(() => pickerWrapper.focus(), 50);
        }
      }
    }
  }, [activePickerIndex]);

  const handlePickerNavigate = (currentIndex: number, direction: 'up' | 'down'): void => {
    if (direction === 'down') {
      // Down arrow - move to next picker
      if (currentIndex < sections.length - 1) {
        setActivePickerIndex(currentIndex + 1);
      }
    } else if (direction === 'up') {
      // Up arrow - move to previous picker
      if (currentIndex > 0) {
        setActivePickerIndex(currentIndex - 1);
      }
    }
  };

  const handlePickerTabPress = (currentIndex: number, shiftKey: boolean): void => {
    if (!shiftKey) {
      // Tab forward
      if (currentIndex < sections.length - 1) {
        setActivePickerIndex(currentIndex + 1);
      } else {
        // Last section, close and move to next table cell
        handleClose();
        if (onTabPress) {
          onTabPress(false);
        }
      }
    } else {
      // Shift+Tab backward
      if (currentIndex > 0) {
        setActivePickerIndex(currentIndex - 1);
      } else {
        // First section, close and move to previous table cell
        handleClose();
        if (onTabPress) {
          onTabPress(true);
        }
      }
    }
  };

  const handleClose = (): void => {
    // Save any pending changes from all pickers before closing
    pickerSaveCallbacksRef.current.forEach((saveCallback) => {
      saveCallback?.();
    });
    setIsExpanded(false);
    // Return focus to the container
    setTimeout(() => {
      containerRef.current?.focus();
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (!isExpanded) {
      // Handle navigation when collapsed
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
          setIsExpanded(true);
        }
      }
    }
  };

  const handleExpandedKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      handleClose();
    }
  };

  useClickOutside(
    expandedRef,
    handleClose,
    isExpanded,
    [
      '.picker-suggestions',
      '.picker-tag-remove',
      '.picker-suggestion-item',
      '.picker-tags-container',
      // Exclude these elements from triggering close - they are part of the picker UI
    ],
    100
  );

  const handleDialogBlur = (e: React.FocusEvent): void => {
    // Don't close if focus moved to another element within the dialog
    e.stopPropagation();
  };

  // Generate badge class name based on variant
  const getBadgeClass = (section: PickerSection): string => {
    if (section.badgeClass) return section.badgeClass;
    return `badge-${section.variant}`;
  };

  return (
    <div className={className} ref={containerRef} onKeyDown={handleKeyDown} tabIndex={0}>
      {!isExpanded ? (
        <div className="multi-picker-compact" onClick={() => setIsExpanded(true)}>
          {totalCount === 0 ? (
            <span className="no-items-text">-</span>
          ) : (
            <div className="multi-picker-summary">
              {sections.map((section, index) => 
                section.value.length > 0 ? (
                  <span
                    key={index}
                    className={`multi-picker-badge ${getBadgeClass(section)}`}
                    title={`${section.value.length} ${section.label.toLowerCase()}`}
                  >
                    {section.value.length}
                  </span>
                ) : null
              )}
            </div>
          )}
        </div>
      ) : null}

      {isExpanded &&
        createPortal(
          <div
            ref={expandedRef}
            className={`multi-picker-expanded multi-picker-theme-${themeVariant} ${position.renderUpward ? 'render-upward' : ''}`}
            style={{
              position: 'fixed',
              ...(position.renderUpward
                ? { bottom: `${window.innerHeight - position.top}px` }
                : { top: `${position.top}px` }),
              left: `${position.left}px`,
              width: `${position.width}px`,
              maxWidth: `${position.maxWidth}px`,
            }}
            onBlur={handleDialogBlur}
            onKeyDown={handleExpandedKeyDown}
          >
            <div className="multi-picker-header">
              <span className="multi-picker-title">{title}</span>
              <button
                className="multi-picker-close"
                onClick={handleClose}
                title="Collapse"
              >
                ×
              </button>
            </div>

            {sections.map((section, index) => (
              <div 
                key={index} 
                className="multi-picker-section"
                ref={(el) => { if (el) sectionRefs.current.set(index, el); }}
              >
                <label className="multi-picker-label">{section.label}</label>
                <EditablePicker
                  value={section.value}
                  availableItems={section.availableItems}
                  placeholder={section.placeholder}
                  variant={section.variant}
                  onSave={section.onChange}
                  autoEdit={activePickerIndex === index}
                  useInWrapper={true}
                  onTabPress={(shiftKey: boolean) => handlePickerTabPress(index, shiftKey)}
                  onDeactivate={() => setActivePickerIndex(null)}
                  onNavigate={(direction) => {
                    if (direction === 'up' || direction === 'down') {
                      handlePickerNavigate(index, direction);
                    }
                  }}
                  onRegisterSave={(saveCallback) => {
                    pickerSaveCallbacksRef.current.set(index, saveCallback);
                  }}
                />
              </div>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
