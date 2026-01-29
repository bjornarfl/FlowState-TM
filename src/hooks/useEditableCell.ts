import { useState } from 'react';

/**
 * Reusable hook for managing editable cell state and handlers.
 * Provides common editing logic for cell components.
 * 
 * @template T The type of value being edited
 * @param initialValue The initial value of the cell
 * @param onSave Callback function called when the value is saved
 * @returns Object containing editing state and handlers
 */
export function useEditableCell<T>(
  initialValue: T,
  onSave?: (newValue: T) => void
) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(initialValue);

  const startEditing = (): void => {
    setIsEditing(true);
    setEditValue(initialValue);
  };

  const save = (valueToSave?: T): void => {
    const finalValue = valueToSave !== undefined ? valueToSave : editValue;
    if (finalValue !== initialValue) {
      onSave?.(finalValue);
    }
    setIsEditing(false);
  };

  const cancel = (): void => {
    setIsEditing(false);
  };

  return {
    isEditing,
    editValue,
    setEditValue,
    startEditing,
    save,
    cancel,
  };
}
