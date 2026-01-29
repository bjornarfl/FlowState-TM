import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import type { Direction } from '../../types/threatModel';
import './EditableDirectionCell.css';

interface DirectionOption {
  value: Direction;
  label: string;
}

const DIRECTIONS: DirectionOption[] = [
  { value: 'unidirectional', label: 'Unidirectional' },
  { value: 'bidirectional', label: 'Bidirectional' },
];

interface EditableDirectionCellProps {
  value: Direction;
  onSave?: (newValue: Direction) => void;
  onTabPress?: (shiftKey: boolean) => void;
  onNavigate?: (direction: 'up' | 'down' | 'left' | 'right') => void;
}

const EditableDirectionCell = forwardRef<HTMLDivElement, EditableDirectionCellProps>(({ 
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

  const getDisplayLabel = (direction: Direction): string => {
    return DIRECTIONS.find((d) => d.value === direction)?.label || direction;
  };

  const handleSelect = (newValue: Direction): void => {
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
        const currentIndex = DIRECTIONS.findIndex(d => d.value === value);
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
        setHighlightedIndex(prev => Math.min(prev + 1, DIRECTIONS.length - 1));
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
        return;
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < DIRECTIONS.length) {
          handleSelect(DIRECTIONS[highlightedIndex].value);
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
      const currentIndex = DIRECTIONS.findIndex(d => d.value === value);
      setHighlightedIndex(currentIndex);
    }
  };

  const handleOptionClick = (direction: Direction): void => {
    handleSelect(direction);
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
      className="always-editable-direction-cell"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="direction-display" onClick={handleClick}>
        {getDisplayLabel(value)}
        <span className="direction-arrow">▼</span>
      </div>
      {isOpen && (
        <div className="direction-dropdown">
          {DIRECTIONS.map((direction, index) => (
            <div
              key={direction.value}
              className={`direction-option ${
                index === highlightedIndex ? 'highlighted' : ''
              } ${direction.value === value ? 'selected' : ''}`}
              onClick={() => handleOptionClick(direction.value)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              {direction.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

EditableDirectionCell.displayName = 'EditableDirectionCell';

export default EditableDirectionCell;
