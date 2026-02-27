import React from 'react';
import './CanvasToolbar.css';
import type { ComponentType } from '../../types/threatModel';

interface CanvasToolbarProps {
  onAddComponent: (componentType: ComponentType) => void;
  onAddBoundary: () => void;
}

/**
 * Toolbar overlay on the canvas for adding nodes
 */
export default function CanvasToolbar({ onAddComponent, onAddBoundary }: CanvasToolbarProps): React.JSX.Element {
  const createNodeDragImage = (componentType: ComponentType): HTMLElement => {
    const dragImage = document.createElement('div');
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    dragImage.style.padding = '4px';
    dragImage.style.border = '2px solid var(--node-border, #000)';
    dragImage.style.background = 'var(--bg-primary, white)';
    dragImage.style.minWidth = '140px';
    dragImage.style.minHeight = '46px';
    dragImage.style.opacity = '0.8';
    dragImage.style.fontSize = '14px';
    dragImage.style.fontWeight = '500';
    dragImage.style.textAlign = 'center';
    dragImage.style.padding = '10px';
    dragImage.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    
    // Apply component-specific styles
    switch (componentType) {
      case 'internal':
        dragImage.style.borderRadius = '25px';
        dragImage.textContent = 'New Component';
        break;
      case 'external':
        dragImage.style.borderRadius = '0';
        dragImage.textContent = 'New External';
        break;
      case 'data_store':
        dragImage.style.borderRadius = '0';
        dragImage.style.borderLeft = 'none';
        dragImage.style.borderRight = 'none';
        dragImage.textContent = 'New Data Store';
        break;
    }
    
    return dragImage;
  };

  const createBoundaryDragImage = (): HTMLElement => {
    const dragImage = document.createElement('div');
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    dragImage.style.width = '150px';
    dragImage.style.height = '75px';
    dragImage.style.border = '2px dashed #dc2626';
    dragImage.style.background = 'transparent';
    dragImage.style.opacity = '0.8';
    dragImage.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.15)';
    
    const label = document.createElement('div');
    label.style.position = 'absolute';
    label.style.top = '2px';
    label.style.left = '2px';
    label.style.fontWeight = '600';
    label.style.fontSize = '11px';
    label.style.color = '#dc2626';
    label.style.padding = '2px 4px';
    label.textContent = 'New Boundary';
    
    dragImage.appendChild(label);
    return dragImage;
  };

  const handleDragStart = (event: React.DragEvent, type: 'component' | 'boundary', componentType?: ComponentType) => {
    event.dataTransfer.effectAllowed = 'move';
    const dragData = type === 'component' 
      ? JSON.stringify({ type: 'component', componentType })
      : JSON.stringify({ type: 'boundary' });
    event.dataTransfer.setData('application/reactflow', dragData);

    // Add dragging class to the button
    const button = event.currentTarget as HTMLButtonElement;
    button.classList.add('dragging');

    // Create a custom drag image that looks like the actual node
    const dragImage = type === 'component' && componentType
      ? createNodeDragImage(componentType)
      : createBoundaryDragImage();
    
    document.body.appendChild(dragImage);
    event.dataTransfer.setDragImage(dragImage, 70, 25);
    
    // Clean up the drag image after a short delay
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);
  };

  const handleDragEnd = (event: React.DragEvent) => {
    // Remove dragging class when drag ends
    const button = event.currentTarget as HTMLButtonElement;
    button.classList.remove('dragging');
  };

  return (
    <div className="canvas-toolbar">
      <button 
        className="canvas-toolbar-button"
        onClick={() => onAddComponent('internal')}
        draggable
        onDragStart={(e) => handleDragStart(e, 'component', 'internal')}
        onDragEnd={handleDragEnd}
        title="Add internal component (click or drag)"
      >
        <div className="mini-node mini-internal">
          <span className="mini-label">Internal</span>
        </div>
      </button>
      <button 
        className="canvas-toolbar-button"
        onClick={() => onAddComponent('external')}
        draggable
        onDragStart={(e) => handleDragStart(e, 'component', 'external')}
        onDragEnd={handleDragEnd}
        title="Add external dependency (click or drag)"
      >
        <div className="mini-node mini-external">
          <span className="mini-label">External</span>
        </div>
      </button>
      <button 
        className="canvas-toolbar-button"
        onClick={() => onAddComponent('data_store')}
        draggable
        onDragStart={(e) => handleDragStart(e, 'component', 'data_store')}
        onDragEnd={handleDragEnd}
        title="Add data store (click or drag)"
      >
        <div className="mini-node mini-datastore">
          <span className="mini-label">Data Store</span>
        </div>
      </button>
      <button 
        className="canvas-toolbar-button"
        onClick={onAddBoundary}
        draggable
        onDragStart={(e) => handleDragStart(e, 'boundary')}
        onDragEnd={handleDragEnd}
        title="Add boundary (click or drag)"
      >
        <div className="mini-node mini-boundary">
          <span className="mini-label">Boundary</span>
        </div>
      </button>
    </div>
  );
}
