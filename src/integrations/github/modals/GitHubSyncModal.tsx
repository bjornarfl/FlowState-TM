import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import './GitHubSyncModal.css';

interface GitHubSyncModalProps {
  onConfirm: () => void;
  onCancel: () => void;
  hasLocalChanges: boolean;
  remoteUpdatedAt: string;
  localLoadedAt: string;
}

export const GitHubSyncModal: React.FC<GitHubSyncModalProps> = ({
  onConfirm,
  onCancel,
  hasLocalChanges,
  remoteUpdatedAt,
  localLoadedAt,
}) => {
  return (
    <div className="modal-overlay">
      <div className="modal-content github-sync-modal">
        <div className="sync-modal-header">
          <RefreshCw size={24} className="sync-icon" />
          <h2>Sync Conflict Detected</h2>
        </div>

        <div className="sync-modal-body">
          <div className="sync-warning">
            <AlertCircle size={20} />
            <p>
              The threat model in the repository has been updated since you loaded it.
                {hasLocalChanges && (
                <><br /><br /><strong>Warning:</strong> You have unsaved local changes. Loading the latest
                version from GitHub will discard your current work.</>
                )}
            </p>

          </div>

          <div className="sync-details">
            <div className="sync-detail-row">
              <span className="detail-label">You loaded:</span>
              <span className="detail-value">{new Date(localLoadedAt).toLocaleString()}</span>
            </div>
            <div className="sync-detail-row">
              <span className="detail-label">Remote updated:</span>
              <span className="detail-value">{new Date(remoteUpdatedAt).toLocaleString()}</span>
            </div>
          </div>

          <div className="sync-options">
            <p><strong>What would you like to do?</strong></p>
            <ul>
              <li>
                <strong>Load Latest:</strong> Replace your current version with the latest from
                GitHub (your local changes will be lost)
              </li>
              <li>
                <strong>Keep Current:</strong> Continue working with your current version
              </li>
            </ul>
          </div>
        </div>

        <div className="modal-actions">
          <button className="button button-secondary" onClick={onCancel}>
            Keep Current
          </button>
          <button className="button button-primary button-warning" onClick={onConfirm}>
            Load Latest
          </button>
        </div>
      </div>
    </div>
  );
};
