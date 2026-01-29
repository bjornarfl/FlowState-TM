import React, { useState, useRef, useEffect } from 'react';
import { Settings, Moon, Sun, Share2 } from 'lucide-react';
import './SettingsDropdown.css';

interface SettingsDropdownProps {
  isDarkMode: boolean;
  onDarkModeChange: (isDarkMode: boolean) => void;
  onGenerateShareLink?: () => void;
}

export const SettingsDropdown: React.FC<SettingsDropdownProps> = ({
  isDarkMode,
  onDarkModeChange,
  onGenerateShareLink,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  return (
    <div className="settings-dropdown" ref={dropdownRef}>
      <button
        className="settings-dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Settings"
        title="Settings"
        aria-expanded={isOpen}
      >
        <Settings size={20} />
      </button>

      {isOpen && (
        <div className="settings-dropdown-menu">
          <button
            className="settings-dropdown-item"
            onClick={() => {
              onDarkModeChange(!isDarkMode);
              setIsOpen(false);
            }}
          >
            <span className="settings-dropdown-icon">
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            </span>
            <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          
          {onGenerateShareLink && (
            <button
              className="settings-dropdown-item"
              onClick={() => {
                onGenerateShareLink();
                setIsOpen(false);
              }}
            >
              <span className="settings-dropdown-icon">
                <Share2 size={16} />
              </span>
              <span>Generate Share Link</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
