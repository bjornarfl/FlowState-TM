import React from 'react';
import './DiscardModal.css';

interface DiscardModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export const DiscardModal: React.FC<DiscardModalProps> = ({ onConfirm, onCancel }) => {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Discard Current Threat Model?</h2>
        <p>
          Opening a new threat model will discard any unsaved changes to your current threat model.
        </p>
        <p>
          Make sure you've saved your work before continuing.
        </p>
        <div className="modal-actions">
          <button className="button button-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="button button-primary button-danger" onClick={onConfirm}>
            Discard & Continue
          </button>
        </div>
      </div>
    </div>
  );
};
