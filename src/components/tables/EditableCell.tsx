import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import './EditableCell.css';

interface EditableCellProps {
  value: string;
  onSave?: (newValue: string) => void;
  allowEmpty?: boolean;
  onTabPress?: (shiftKey: boolean) => void;
  onNavigate?: (direction: 'up' | 'down' | 'left' | 'right') => void;
  placeholder?: string;
}

const EditableCell = forwardRef<HTMLTextAreaElement, EditableCellProps>(({ 
  value, 
  onSave, 
  allowEmpty = false,
  onTabPress,
  onNavigate,
  placeholder
}, ref) => {
  const isPlaceholder = placeholder && value === placeholder;
  const [editValue, setEditValue] = React.useState(isPlaceholder ? '' : value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Expose the textarea ref to parent components
  useImperativeHandle(ref, () => textareaRef.current as HTMLTextAreaElement);

  // Update internal state when value prop changes
  useEffect(() => {
    const isPlaceholder = placeholder && value === placeholder;
    setEditValue(isPlaceholder ? '' : value);
  }, [value, placeholder]);

  // Auto-resize textarea as content changes
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [editValue]);

  // Recalculate height when container width changes
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const resizeObserver = new ResizeObserver(() => {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    });

    resizeObserver.observe(textarea);
    return () => resizeObserver.disconnect();
  }, []);

  const handleSave = (): void => {
    const currentIsPlaceholder = placeholder && value === placeholder;
    const newValueToSave = editValue.trim() ? editValue : (placeholder || '');
    
    if (allowEmpty || editValue.trim()) {
      if (onSave && newValueToSave !== value) {
        onSave(newValueToSave);
      }
    } else {
      // Reset to empty if it was a placeholder, otherwise keep original value
      setEditValue(currentIsPlaceholder ? '' : value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    const cursorPosition = textareaRef.current?.selectionStart ?? 0;
    const textLength = editValue.length;
    const isAtStart = cursorPosition === 0;
    const isAtEnd = cursorPosition === textLength;

    // Alt + Arrow key navigation (force navigation regardless of cursor position)
    if (onNavigate && e.altKey) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        handleSave();
        if (e.key === 'ArrowRight') onNavigate('right');
        else if (e.key === 'ArrowLeft') onNavigate('left');
        else if (e.key === 'ArrowDown') onNavigate('down');
        else if (e.key === 'ArrowUp') onNavigate('up');
        return;
      }
    }

    // Arrow key navigation (only at boundaries)
    if (onNavigate) {
      if (e.key === 'ArrowRight' && isAtEnd) {
        e.preventDefault();
        handleSave();
        onNavigate('right');
        return;
      } else if (e.key === 'ArrowLeft' && isAtStart) {
        e.preventDefault();
        handleSave();
        onNavigate('left');
        return;
      } else if (e.key === 'ArrowDown' && isAtEnd) {
        e.preventDefault();
        handleSave();
        onNavigate('down');
        return;
      } else if (e.key === 'ArrowUp' && isAtStart) {
        e.preventDefault();
        handleSave();
        onNavigate('up');
        return;
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      handleSave();
      if (onTabPress) {
        onTabPress(e.shiftKey);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
      textareaRef.current?.blur();
    } else if (e.key === 'Escape') {
      setEditValue(value);
      textareaRef.current?.blur();
    }
  };

  return (
    <textarea
      ref={textareaRef}
      className="always-editable-cell-input"
      value={editValue}
      placeholder={placeholder}
      onChange={(e) => setEditValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleSave}
      onClick={(e) => e.stopPropagation()}
      rows={1}
      spellCheck={false}
      autoCorrect="off"
      autoCapitalize="off"
      autoComplete="off"
    />
  );
});

EditableCell.displayName = 'EditableCell';

export default EditableCell;
