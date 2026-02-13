import React from 'react';
import './DiscardModal.css';

interface ExternalChangeModalProps {
  fileName: string;
  onKeepMine: () => void;
  onLoadExternal: () => void;
  onSaveAs: () => void;
}

export const ExternalChangeModal: React.FC<ExternalChangeModalProps> = ({
  fileName,
  onKeepMine,
  onLoadExternal,
  onSaveAs,
}) => {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>File Changed Externally</h2>
        <p>
          <strong>{fileName}</strong> has been modified outside the editor.
          You have unsaved changes that may conflict with the external version.
        </p>
        <p>
          <strong>Choose how to resolve this:</strong>
        </p>
        <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem', lineHeight: '1.6' }}>
          <li><strong>Keep My Changes:</strong> Ignore the external changes and continue editing</li>
          <li><strong>Load External Changes:</strong> Discard your edits and reload from disk</li>
          <li><strong>Save Copy & Load External:</strong> Save your version to a new file, then load the external version</li>
        </ul>
        <div className="modal-actions external-change-actions">
          <button className="button button-secondary" onClick={onSaveAs}>
            Save Copy & Load External
          </button>
          <button className="button button-secondary" onClick={onKeepMine}>
            Keep My Changes
          </button>
          <button className="button button-primary" onClick={onLoadExternal}>
            Load External Changes
          </button>
        </div>
      </div>
    </div>
  );
};
