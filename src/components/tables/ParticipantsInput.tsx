import { useState, useCallback, useRef, useImperativeHandle, forwardRef, KeyboardEvent } from 'react';
import './ParticipantsInput.css';

export interface ParticipantsInputRef {
  focus: () => void;
}

interface ParticipantsInputProps {
  value: string[];
  placeholder?: string;
  onSave: (participants: string[]) => void;
  onNavigate?: (direction: 'up' | 'down') => void;
  onTabPress?: (shiftKey: boolean) => void;
}

/**
 * Tag-style input for managing a list of participant strings.
 * Items are added by pressing Enter. Each item is displayed as a label
 * that can be removed via a close button.
 */
const ParticipantsInput = forwardRef<ParticipantsInputRef, ParticipantsInputProps>(({
  value,
  placeholder = 'Add participants...',
  onSave,
  onNavigate,
  onTabPress,
}, ref) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    },
  }));

  const handleAdd = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    // Prevent duplicates
    if (value.includes(trimmed)) {
      setInputValue('');
      return;
    }

    const updated = [...value, trimmed];
    setInputValue('');
    onSave(updated);
  }, [inputValue, value, onSave]);

  const handleRemove = useCallback((index: number) => {
    const updated = value.filter((_, i) => i !== index);
    onSave(updated);
  }, [value, onSave]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    } else if (e.key === 'Backspace' && inputValue === '' && value.length > 0) {
      // Remove last tag on backspace when input is empty
      handleRemove(value.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onNavigate?.('up');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onNavigate?.('down');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Commit any pending input before navigating
      const trimmed = inputValue.trim();
      if (trimmed && !value.includes(trimmed)) {
        const updated = [...value, trimmed];
        setInputValue('');
        onSave(updated);
      }
      onTabPress?.(e.shiftKey);
    }
  }, [handleAdd, handleRemove, inputValue, value, onSave, onNavigate, onTabPress]);

  const handleContainerClick = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="participants-input-container" onClick={handleContainerClick}>
      {value.map((participant, index) => (
        <span key={index} className={`participant-tag participant-color-${index % 6}`}>
          <span className="participant-tag-text">{participant}</span>
          <button
            className="participant-tag-remove"
            onClick={(e) => {
              e.stopPropagation();
              handleRemove(index);
            }}
            aria-label={`Remove ${participant}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        className="participants-text-input"
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleAdd}
        placeholder={value.length === 0 ? placeholder : ''}
        aria-label="Add participants"
      />
    </div>
  );
});

ParticipantsInput.displayName = 'ParticipantsInput';

export default ParticipantsInput;
