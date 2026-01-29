import React, { useState, useRef } from 'react';
import { useClickOutside } from '../../hooks/useClickOutside';
import './NavbarDropdown.css';

export interface DropdownItem {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
}

interface NavbarDropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  title?: string;
}

export function NavbarDropdown({ trigger, items, title }: NavbarDropdownProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(dropdownRef, () => setIsOpen(false), isOpen);

  const handleItemClick = (onClick: () => void) => {
    onClick();
    setIsOpen(false);
  };

  return (
    <div className="navbar-dropdown" ref={dropdownRef} title={title} data-testid="navbar-dropdown">
      <button
        className="navbar-dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        {trigger}
      </button>
      {isOpen && (
        <div className="navbar-dropdown-menu">
          {items.map((item, index) => (
            <button
              key={index}
              className="navbar-dropdown-item"
              onClick={() => handleItemClick(item.onClick)}
            >
              {item.icon && <span className="navbar-dropdown-icon">{item.icon}</span>}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
