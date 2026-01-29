import React from 'react';
import './CanvasOverlay.css';

export interface KeyBinding {
  keys: string[];
  label: string;
  isArrowKeys?: boolean;
}

interface CanvasOverlayProps {
  /** Main title/action text displayed at the top */
  title: string;
  /** Instruction text displayed at the bottom */
  instruction?: string;
  /** Array of keybindings to display */
  keybindings?: KeyBinding[];
  /** Whether to show the overlay */
  show: boolean;
}

export const CanvasOverlay: React.FC<CanvasOverlayProps> = ({ 
  title, 
  instruction, 
  keybindings = [],
  show
}) => {
  // Don't render if not visible
  if (!show) {
    return null;
  }

  return (
    <div className="canvas-overlay">
      <div className="overlay-content">
        <div className="overlay-action">{title}</div>
        
        {keybindings.length > 0 && (
          <div className="overlay-keybinds">
            {keybindings.map((binding, index) => (
              <React.Fragment key={index}>
                {index > 0 && <span className="keybind-separator"></span>}
                <span className="keybind-group">
                  <span className="keybind-keys">
                    {binding.isArrowKeys ? (
                      <>
                        <kbd className="key key-arrow">↑</kbd>
                        <kbd className="key key-arrow">↓</kbd>
                        <kbd className="key key-arrow">←</kbd>
                        <kbd className="key key-arrow">→</kbd>
                      </>
                    ) : (
                      binding.keys.map((key, keyIndex) => (
                        <kbd key={keyIndex} className="key">{key}</kbd>
                      ))
                    )}
                  </span>
                  <span className="keybind-label">{binding.label}</span>
                </span>
              </React.Fragment>
            ))}
          </div>
        )}
        
        {instruction && (
          <div className="overlay-instruction">{instruction}</div>
        )}
      </div>
    </div>
  );
};
