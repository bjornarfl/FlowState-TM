import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import './EditableTextarea.css';

interface EditableTextareaProps {
  value: string;
  onSave?: (newValue: string) => void;
  onTabPress?: (shiftKey: boolean) => void;
  onNavigate?: (direction: 'up' | 'down' | 'left' | 'right') => void;
}

const EditableTextarea = forwardRef<HTMLTextAreaElement, EditableTextareaProps>(({ 
  value, 
  onSave,
  onTabPress,
  onNavigate 
}, ref) => {
  const [editValue, setEditValue] = React.useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Expose the textarea ref to parent components
  useImperativeHandle(ref, () => textareaRef.current as HTMLTextAreaElement);

  // Update internal state when value prop changes
  useEffect(() => {
    setEditValue(value);
  }, [value]);

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
    if (onSave && editValue !== value) {
      onSave(editValue);
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
    } else if (e.key === 'Escape') {
      setEditValue(value);
      textareaRef.current?.blur();
    }
    // Allow Shift+Enter or Ctrl+Enter to create new lines
    // Save on Ctrl/Cmd + S
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <textarea
      ref={textareaRef}
      className="always-editable-textarea-input"
      value={editValue}
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

EditableTextarea.displayName = 'EditableTextarea';

export default EditableTextarea;
