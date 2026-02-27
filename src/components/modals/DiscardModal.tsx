import React from 'react';
import './DiscardModal.css';

interface DiscardModalProps {
  onConfirm: () => void;
  onCancel: () => void;
  onSave: () => Promise<void>;
}

export const DiscardModal: React.FC<DiscardModalProps> = ({ onConfirm, onCancel, onSave }) => {
  const [isSaving, setIsSaving] = React.useState(false);

  const handleSaveAndContinue = async () => {
    setIsSaving(true);
    try {
      await onSave();
      onConfirm();
    } catch (error) {
      console.error('Failed to save:', error);
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Discard Current Threat Model?</h2>
        <p>
          Opening a new threat model will discard any unsaved changes to your current threat model.
        </p>
        <p>
          You can save your changes before continuing, or discard them.
        </p>
        <div className="modal-actions">
          <button className="button button-secondary" onClick={onCancel} disabled={isSaving}>
            Cancel
          </button>
          <button className="button button-primary" onClick={handleSaveAndContinue} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save & Continue'}
          </button>
          <button className="button button-danger" onClick={onConfirm} disabled={isSaving}>
            Discard & Continue
          </button>
        </div>
      </div>
    </div>
  );
};
