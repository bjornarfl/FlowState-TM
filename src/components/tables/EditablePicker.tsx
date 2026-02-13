import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useClickOutside } from '../../hooks/useClickOutside';
import './EditablePicker.css';

export interface PickerItem {
  ref: string;
  name: string;
}

interface EditablePickerProps {
  value: string[]; // Array of item refs currently assigned
  availableItems: PickerItem[]; // All available items to pick from
  placeholder?: string; // Placeholder text when no items selected
  variant?: 'default' | 'assets' | 'threats' | 'controls' | 'components' | 'dataflows'; // Color variant
  onSave?: (newItems: string[]) => void;
  onCreateItem?: (name: string) => string | Promise<string>; // Called when user wants to create a new item, returns the ref of the created item
  compactMode?: boolean; // Display as count badge instead of full tags
  autoEdit?: boolean; // Start in edit mode automatically
  useInWrapper?: boolean; // When true, requires Enter to start edit mode (used in MultiPickerCell)
  onTabPress?: (shiftKey: boolean) => void; // Called when Tab is pressed
  onDeactivate?: () => void; // Called when picker exits edit mode
  onNavigate?: (direction: 'up' | 'down' | 'left' | 'right') => void; // Called when arrow keys are pressed (not in edit mode)
  onRegisterSave?: (saveCallback: () => void) => void; // Register a save callback that can be called externally
}

/**
 * Generic multi-select picker component for use in table cells
 * Used for assets, threats, controls, components, and data flows
 * Supports searching, filtering selected items, and bulk operations
 * Can display in compact mode (count badge) or full mode (all tags)
 */
export default function EditablePicker({ value, availableItems, placeholder = "Add item...", variant = 'default', onSave, onCreateItem, compactMode = false, autoEdit = false, useInWrapper = false, onTabPress, onDeactivate, onNavigate, onRegisterSave }: EditablePickerProps): React.JSX.Element {
  const [isEditing, setIsEditing] = useState(autoEdit);
  const [selectedItems, setSelectedItems] = useState<string[]>(value || []);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const saveChangesRef = useRef<() => void>(() => {});

  const variantClass = `picker-variant-${variant}`;

  // Scroll suggestions dropdown into view when it opens
  useEffect(() => {
    if (showSuggestions && suggestionsRef.current && inputRef.current) {
      setTimeout(() => {
        const suggestions = suggestionsRef.current;
        const input = inputRef.current;
        if (!suggestions || !input) return;

        // Calculate positions
        const suggestionsRect = suggestions.getBoundingClientRect();
        const inputRect = input.getBoundingClientRect();
        
        // Find the scrollable parent
        let scrollParent = suggestions.parentElement;
        while (scrollParent && scrollParent !== document.body) {
          const style = window.getComputedStyle(scrollParent);
          if (style.overflow === 'auto' || style.overflow === 'scroll' || 
              style.overflowY === 'auto' || style.overflowY === 'scroll') {
            break;
          }
          scrollParent = scrollParent.parentElement;
        }

        if (scrollParent && scrollParent !== document.body) {
          const parentRect = scrollParent.getBoundingClientRect();
          
          // Check if suggestions are cut off at the bottom
          if (suggestionsRect.bottom > parentRect.bottom) {
            // Calculate how much to scroll, but keep input visible
            const scrollAmount = suggestionsRect.bottom - parentRect.bottom + 20; // 20px padding
            
            // Make sure we don't scroll the input out of view
            const inputTopAfterScroll = inputRect.top - scrollAmount;
            if (inputTopAfterScroll >= parentRect.top) {
              scrollParent.scrollBy({ top: scrollAmount, behavior: 'smooth' });
            } else {
              // If input would be hidden, center it instead
              const centerOffset = (parentRect.height / 2) - (inputRect.height / 2);
              const targetScroll = inputRect.top - parentRect.top - centerOffset;
              scrollParent.scrollBy({ top: targetScroll, behavior: 'smooth' });
            }
          }
        }
      }, 100);
    }
  }, [showSuggestions]);

  // Reset highlighted index when filtered items change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchTerm]);

  // Enter edit mode when autoEdit becomes true (but not in wrapper mode)
  useEffect(() => {
    if (autoEdit && !isEditing && !useInWrapper) {
      setIsEditing(true);
      setShowSuggestions(false);
      setSearchTerm('');
      setHighlightedIndex(-1);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else if (!autoEdit && isEditing) {
      // Exit edit mode when autoEdit becomes false
      setIsEditing(false);
      setShowSuggestions(false);
      setSearchTerm('');
      setHighlightedIndex(-1);
    }
  }, [autoEdit, useInWrapper]);

  const saveChanges = useCallback((): void => {
    // Only save if the selected items have actually changed
    const hasChanged = selectedItems.length !== value.length || 
                       !selectedItems.every(item => value.includes(item));
    if (hasChanged) {
      onSave?.(selectedItems);
    }
  }, [selectedItems, value, onSave]);

  // Keep the ref updated with the latest saveChanges function
  useEffect(() => {
    saveChangesRef.current = saveChanges;
  }, [saveChanges]);

  // Register a stable save callback that calls the latest version
  useEffect(() => {
    if (onRegisterSave) {
      onRegisterSave(() => saveChangesRef.current());
    }
  }, [onRegisterSave]);

  // Click-outside handler to exit edit mode
  const handleClickOutside = useCallback((): void => {
    saveChanges();
    setIsEditing(false);
    setShowSuggestions(false);
    setSearchTerm('');
    if (compactMode) {
      setIsExpanded(false);
    }
  }, [saveChanges, compactMode]);

  useClickOutside(
    containerRef,
    handleClickOutside,
    isEditing,
    [
      '.picker-suggestions',
      '.picker-tag-remove',
      '.picker-suggestion-item',
      '.picker-tags-container'
    ],
    100
  );

  const handleClick = (): void => {
    if (compactMode && !isExpanded) {
      // In compact mode, first click expands to show all tags
      setIsExpanded(true);
    } else {
      // Second click or non-compact mode goes into edit mode
      setIsEditing(true);
      setSelectedItems(value || []);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const handleRemoveItem = (itemRef: string): void => {
    const newItems = selectedItems.filter((ref) => ref !== itemRef);
    setSelectedItems(newItems);
    // Keep focus on input after removing
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleAddItem = (itemRef: string): void => {
    if (!selectedItems.includes(itemRef)) {
      const newItems = [...selectedItems, itemRef];
      setSelectedItems(newItems);
    }
    setSearchTerm('');
    // Keep suggestions open after adding
    setTimeout(() => {
      inputRef.current?.focus();
      setShowSuggestions(true);
    }, 0);
  };

  const handleCreateItem = async (): Promise<void> => {
    if (!searchTerm.trim() || !onCreateItem) return;
    
    try {
      const newItemRef = await onCreateItem(searchTerm.trim());
      // Add the newly created item to selected items
      if (newItemRef && !selectedItems.includes(newItemRef)) {
        const newItems = [...selectedItems, newItemRef];
        setSelectedItems(newItems);
      }
      setSearchTerm('');
      setHighlightedIndex(-1);
      // Keep suggestions open and focus on input
      setTimeout(() => {
        inputRef.current?.focus();
        setShowSuggestions(true);
      }, 100);
    } catch (error) {
      console.error('Failed to create item:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    const filteredItems = getFilteredItems();
    const canCreateNew = onCreateItem && searchTerm.trim() && 
      !availableItems.some(item => item.name.toLowerCase() === searchTerm.trim().toLowerCase());
    const totalOptions = filteredItems.length + (canCreateNew ? 1 : 0);
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!showSuggestions && totalOptions > 0) {
        setShowSuggestions(true);
        setHighlightedIndex(0);
      } else if (highlightedIndex < totalOptions - 1) {
        setHighlightedIndex(highlightedIndex + 1);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (highlightedIndex > 0) {
        setHighlightedIndex(highlightedIndex - 1);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (canCreateNew && highlightedIndex === filteredItems.length) {
        // Create new item (last option in the list)
        handleCreateItem();
      } else if (highlightedIndex >= 0 && highlightedIndex < filteredItems.length) {
        // Add the highlighted item
        handleAddItem(filteredItems[highlightedIndex].ref);
        setHighlightedIndex(-1);
      } else if (!searchTerm && showSuggestions) {
        setShowSuggestions(false);
      }
    } else if (e.key === 'Backspace' && searchTerm === '' && selectedItems.length > 0) {
      // Remove the last selected item when backspace is pressed with empty search
      e.preventDefault();
      const lastItem = selectedItems[selectedItems.length - 1];
      handleRemoveItem(lastItem);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      saveChanges();
      setIsEditing(false);
      setShowSuggestions(false);
      setSearchTerm('');
      setHighlightedIndex(-1);
      if (onTabPress) {
        onTabPress(e.shiftKey);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      // Exit picker's edit mode and refocus wrapper
      // Don't call onDeactivate here - that should only happen from the wrapper
      saveChanges();
      setIsEditing(false);
      setShowSuggestions(false);
      setSearchTerm('');
      setHighlightedIndex(-1);
      // Refocus the container so arrow navigation can work
      setTimeout(() => containerRef.current?.focus(), 0);
    }
  };

  // Get available items that haven't been selected yet
  const getAvailableItems = (): PickerItem[] => {
    return availableItems.filter((item) => !selectedItems.includes(item.ref));
  };

  // Filter items based on search term
  const getFilteredItems = (): PickerItem[] => {
    const available = getAvailableItems();
    if (!searchTerm) return available;
    
    return available.filter((item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const getItemName = (ref: string): string => {
    return availableItems.find((item) => item.ref === ref)?.name || ref;
  };

  // Get label for the variant
  const getVariantLabel = (): string => {
    switch (variant) {
      case 'components': return 'component';
      case 'dataflows': return 'flow';
      case 'assets': return 'asset';
      case 'threats': return 'threat';
      case 'controls': return 'control';
      default: return 'item';
    }
  };

  return (
    <div 
      className={`editable-picker-wrapper ${variantClass}`} 
      ref={containerRef}
      tabIndex={0}
      onKeyDown={(e) => {
        if (isEditing) {
          // Stop Escape from propagating to parent when in edit mode
          if (e.key === 'Escape') {
            e.stopPropagation();
          }
        } else {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          } else if (e.key === 'Tab') {
            // Let Tab pass through for navigation
            if (onTabPress) {
              e.preventDefault();
              onTabPress(e.shiftKey);
            }
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            // When picker is focused but not in edit mode, exit node edit mode
            onDeactivate?.();
          } else if (onNavigate && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
            e.preventDefault();
            const directionMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
              'ArrowUp': 'up',
              'ArrowDown': 'down',
              'ArrowLeft': 'left',
              'ArrowRight': 'right'
            };
            onNavigate(directionMap[e.key]);
          }
        }
      }}
      onClick={(e) => {
        // Only handle click when not in edit mode and not clicking on interactive elements
        if (!isEditing && !(e.target as HTMLElement).closest('button')) {
          e.stopPropagation();
        }
      }}
    >
      {isEditing ? (
        <div className="picker-tags-container">
          <div className="picker-tags">
            {selectedItems.map((itemRef) => (
              <span key={itemRef} className={`picker-tag ${variantClass}`}>
                {getItemName(itemRef)}
                <button
                  className="picker-tag-remove"
                  onClick={() => handleRemoveItem(itemRef)}
                  title="Remove item"
                >
                  ×
                </button>
              </span>
            ))}
            <input
              ref={inputRef}
              type="text"
              className="picker-tag-input"
              placeholder={selectedItems.length === 0 ? placeholder : ""}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleKeyDown}
            />
          </div>
          {showSuggestions && (() => {
            const filteredItems = getFilteredItems();
            const canCreateNew = onCreateItem && searchTerm.trim() && 
              !availableItems.some(item => item.name.toLowerCase() === searchTerm.trim().toLowerCase());
            const hasOptions = filteredItems.length > 0 || canCreateNew;
            
            return hasOptions ? (
              <div className="picker-suggestions" ref={suggestionsRef}>
                {filteredItems.map((item, index) => (
                  <div
                    key={item.ref}
                    className={`picker-suggestion-item ${index === highlightedIndex ? 'highlighted' : ''}`}
                    onClick={() => handleAddItem(item.ref)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    {item.name}
                  </div>
                ))}
                {canCreateNew && (
                  <div
                    className={`picker-suggestion-item picker-create-new ${filteredItems.length === highlightedIndex ? 'highlighted' : ''}`}
                    onClick={handleCreateItem}
                    onMouseEnter={() => setHighlightedIndex(filteredItems.length)}
                  >
                    <span className="create-new-icon">+</span> Create "{searchTerm.trim()}"
                  </div>
                )}
              </div>
            ) : null;
          })()}
        </div>
      ) : compactMode && !isExpanded ? (
        // Compact mode: show count badge
        <div className="picker-compact-display" onClick={handleClick}>
          {selectedItems.length === 0 ? (
            <span className="no-items-text">-</span>
          ) : (
            <span className={`picker-count-badge ${variantClass}`} title={selectedItems.map(ref => getItemName(ref)).join(', ')}>
              {selectedItems.length} {getVariantLabel()}{selectedItems.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      ) : (
        // Expanded mode or non-compact: show all tags
        <div className="picker-tags-display" onClick={handleClick}>
          {selectedItems.length === 0 ? (
            <span className="no-items-text">-</span>
          ) : (
            selectedItems.map((itemRef) => (
              <span key={itemRef} className={`picker-tag-readonly ${variantClass}`}>
                {getItemName(itemRef)}
              </span>
            ))
          )}
        </div>
      )}
    </div>
  );
}