import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import type { ComponentType } from '../../types/threatModel';
import './EditableTypeCell.css';

interface TypeOption {
  value: ComponentType;
  label: string;
}

const COMPONENT_TYPES: TypeOption[] = [
  { value: 'internal', label: 'Internal' },
  { value: 'external', label: 'External' },
  { value: 'data_store', label: 'Data Store' },
];

interface EditableTypeCellProps {
  value: ComponentType;
  onSave?: (newValue: ComponentType) => void;
  onTabPress?: (shiftKey: boolean) => void;
  onNavigate?: (direction: 'up' | 'down' | 'left' | 'right') => void;
}

const EditableTypeCell = forwardRef<HTMLDivElement, EditableTypeCellProps>(({ 
  value, 
  onSave,
  onTabPress,
  onNavigate 
}, ref) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Expose the container ref to parent components
  useImperativeHandle(ref, () => containerRef.current as HTMLDivElement);

  const getDisplayLabel = (type: ComponentType): string => {
    return COMPONENT_TYPES.find((t) => t.value === type)?.label || type;
  };

  const handleSelect = (newValue: ComponentType): void => {
    if (onSave && newValue !== value) {
      onSave(newValue);
    }
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (!isOpen) {
      // When dropdown is closed
      if (e.key === 'Enter') {
        e.preventDefault();
        setIsOpen(true);
        const currentIndex = COMPONENT_TYPES.findIndex(t => t.value === value);
        setHighlightedIndex(currentIndex);
        return;
      } else if (e.key === 'Tab') {
        e.preventDefault();
        if (onTabPress) {
          onTabPress(e.shiftKey);
        }
        return;
      }

      // Arrow key navigation between cells
      if (onNavigate) {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          onNavigate('right');
          return;
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          onNavigate('left');
          return;
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          onNavigate('down');
          return;
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          onNavigate('up');
          return;
        }
      }
    } else {
      // When dropdown is open
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex(prev => Math.min(prev + 1, COMPONENT_TYPES.length - 1));
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
        return;
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < COMPONENT_TYPES.length) {
          handleSelect(COMPONENT_TYPES[highlightedIndex].value);
        }
        return;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        return;
      } else if (e.key === 'Tab') {
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        if (onTabPress) {
          onTabPress(e.shiftKey);
        }
        return;
      }
    }
  };

  const handleClick = (): void => {
    if (!isOpen) {
      setIsOpen(true);
      const currentIndex = COMPONENT_TYPES.findIndex(t => t.value === value);
      setHighlightedIndex(currentIndex);
    }
  };

  const handleOptionClick = (type: ComponentType): void => {
    handleSelect(type);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className="always-editable-type-cell"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="type-display" onClick={handleClick}>
        {getDisplayLabel(value)}
        <span className="type-arrow">▼</span>
      </div>
      {isOpen && (
        <div className="type-dropdown">
          {COMPONENT_TYPES.map((type, index) => (
            <div
              key={type.value}
              className={`type-option ${
                index === highlightedIndex ? 'highlighted' : ''
              } ${type.value === value ? 'selected' : ''}`}
              onClick={() => handleOptionClick(type.value)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              {type.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

EditableTypeCell.displayName = 'EditableTypeCell';

export default EditableTypeCell;
