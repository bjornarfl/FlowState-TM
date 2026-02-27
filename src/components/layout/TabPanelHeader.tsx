import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Table2, Code2, Shapes, BookOpen, X, Plus, ChevronDown, GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import type { Tab, TabView } from '../../hooks/useTabLayout';
import './TabPanelHeader.css';

interface TabPanelHeaderProps {
  tab: Tab;
  tabCount: number;
  canAddTab: boolean;
  onAddTab: (view?: TabView) => void;
  onRemoveTab: (id: string) => void;
  onChangeView: (id: string, view: TabView) => void;
}

const VIEW_OPTIONS: { view: TabView; label: string; icon: React.ReactNode }[] = [
  { view: 'tables', label: 'Tables', icon: <Table2 size={14} /> },
  { view: 'canvas', label: 'Canvas', icon: <Shapes size={14} /> },
  { view: 'yaml', label: 'YAML', icon: <Code2 size={14} /> },
  { view: 'tutorials', label: 'Tutorials', icon: <BookOpen size={14} /> },
];

function getViewIcon(view: TabView, size = 14): React.ReactNode {
  switch (view) {
    case 'tables':
      return <Table2 size={size} />;
    case 'yaml':
      return <Code2 size={size} />;
    case 'canvas':
      return <Shapes size={size} />;
    case 'tutorials':
      return <BookOpen size={size} />;
  }
}

function getViewLabel(view: TabView): string {
  switch (view) {
    case 'tables':
      return 'Tables';
    case 'yaml':
      return 'YAML';
    case 'canvas':
      return 'Canvas';
    case 'tutorials':
      return 'Tutorials';
  }
}

/** Static header content — used both in-place and inside the DragOverlay */
export function TabPanelHeaderContent({
  tab,
  showDragHandle = false,
  dragHandleProps,
  dragHandleRef,
}: {
  tab: Tab;
  showDragHandle?: boolean;
  dragHandleProps?: Record<string, unknown>;
  dragHandleRef?: (node: HTMLElement | null) => void;
}): React.JSX.Element {
  return (
    <>
      <div className="tab-panel-header-left">
        {showDragHandle && (
          <button
            className="tab-panel-header-drag-handle"
            ref={dragHandleRef}
            {...dragHandleProps}
            title="Drag to reorder"
          >
            <GripVertical size={12} />
          </button>
        )}
        <span className="tab-panel-header-icon">{getViewIcon(tab.view)}</span>
        <span className="tab-panel-header-label">{getViewLabel(tab.view)}</span>
      </div>
    </>
  );
}

export function TabPanelHeader({
  tab,
  tabCount,
  canAddTab,
  onAddTab,
  onRemoveTab,
  onChangeView,
}: TabPanelHeaderProps): React.JSX.Element {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    isDragging,
  } = useSortable({ id: tab.id });

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const handleViewChange = useCallback(
    (view: TabView) => {
      onChangeView(tab.id, view);
      setDropdownOpen(false);
    },
    [onChangeView, tab.id]
  );

  return (
    <div
      className={`tab-panel-header${isDragging ? ' tab-panel-header--dragging' : ''}`}
      ref={(node) => { setNodeRef(node); (headerRef as React.MutableRefObject<HTMLDivElement | null>).current = node; }}
      {...attributes}
    >
      <div className="tab-panel-header-left">
        {tabCount > 1 && (
          <button
            className="tab-panel-header-drag-handle"
            ref={setActivatorNodeRef}
            {...listeners}
            title="Drag to reorder"
          >
            <GripVertical size={12} />
          </button>
        )}
        <span className="tab-panel-header-icon">{getViewIcon(tab.view)}</span>
        <span className="tab-panel-header-label">{getViewLabel(tab.view)}</span>

        <button
          className="tab-panel-header-chevron"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          title="Change view"
        >
          <ChevronDown size={12} />
        </button>

        {dropdownOpen && (
          <div className="tab-panel-header-dropdown">
            {VIEW_OPTIONS.map((opt) => (
              <button
                key={opt.view}
                className={`tab-panel-header-dropdown-item ${opt.view === tab.view ? 'active' : ''}`}
                onClick={() => handleViewChange(opt.view)}
              >
                {opt.icon}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="tab-panel-header-right">
        {canAddTab && (
          <button
            className="tab-panel-header-btn"
            onClick={() => onAddTab()}
            title="Add tab"
          >
            <Plus size={14} />
          </button>
        )}
        {tabCount > 1 && (
          <button
            className="tab-panel-header-btn"
            onClick={() => onRemoveTab(tab.id)}
            title="Close tab"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
