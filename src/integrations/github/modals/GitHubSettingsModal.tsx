import React, { useState } from 'react';
import { Eye, EyeOff, ExternalLink, Trash2, AlertCircle, Save, Loader2, RefreshCw } from 'lucide-react';
import {
  GitHubDomain,
  GitHubMetadata,
} from '../types';
import { GITHUB_DOMAINS } from '../githubDomains.config';
import {
  getPatConfig,
  clearPat,
  isPatPersisted,
  storePat,
} from '../utils/patStorage';
import { GitHubApiClient } from '../githubApi';
import './GitHubSettingsModal.css';

interface GitHubSettingsModalProps {
  domain: GitHubDomain;
  onDomainChange: (domain: GitHubDomain) => void;
  githubMetadata?: GitHubMetadata | null;
  onClose: () => void;
  onSync?: () => void;
}

export const GitHubSettingsModal: React.FC<GitHubSettingsModalProps> = ({
  domain,
  onDomainChange,
  githubMetadata,
  onSync,
  onClose,
}) => {
  const [showPatInfo, setShowPatInfo] = useState(false);
  const [showAddPat, setShowAddPat] = useState(false);
  const [newPat, setNewPat] = useState('');
  const [showNewPat, setShowNewPat] = useState(false);
  const [persistPat, setPersistPat] = useState(true);
  const [patError, setPatError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [patConfig, setPatConfig] = useState(() => getPatConfig());
  const [patPersisted, setPatPersisted] = useState(() => isPatPersisted());

  const handleClearPat = () => {
    clearPat();
    setShowPatInfo(false);
    setPatConfig(null);
    setPatPersisted(false);
  };

  const handleSavePat = async () => {
    if (!newPat.trim()) {
      setPatError('Please enter a token');
      return;
    }

    setPatError(null);
    setIsValidating(true);

    try {
      // Validate the token by making a test API call
      const client = new GitHubApiClient(newPat.trim(), domain);
      const isValid = await client.validateToken();

      if (!isValid) {
        setPatError('Invalid token or insufficient permissions');
        setIsValidating(false);
        return;
      }

      // Store the PAT
      storePat(newPat.trim(), domain, persistPat);
      
      // Update state to reflect the new PAT
      setPatConfig(getPatConfig());
      setPatPersisted(persistPat);
      
      // Reset form
      setNewPat('');
      setShowAddPat(false);
      setIsValidating(false);
    } catch (error) {
      setPatError(error instanceof Error ? error.message : 'Failed to validate token');
      setIsValidating(false);
    }
  };

  const handleCancelAddPat = () => {
    setShowAddPat(false);
    setNewPat('');
    setPatError(null);
    setShowNewPat(false);
    setPersistPat(true);
  };

  const patGuideUrl =
    domain === 'github.com'
      ? 'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token'
      : 'https://docs.github.com/en/enterprise-server@latest/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content github-settings-modal" onClick={(e) => e.stopPropagation()}>
        <h2>GitHub Settings</h2>

        {/* Domain Selection */}
        <div className="settings-section">
          <h3>GitHub Instance</h3>
          <p className="settings-description">
            Select which GitHub instance to use for loading and committing threat models.
          </p>
          <div className="domain-selector">
            {GITHUB_DOMAINS.map((config) => (
              <label key={config.domain} className="domain-option">
                <input
                  type="radio"
                  name="github-domain"
                  value={config.domain}
                  checked={domain === config.domain}
                  onChange={() => onDomainChange(config.domain)}
                />
                <span className="domain-label">
                  <strong>{config.domain}</strong>
                  <span className="domain-sublabel">
                    {config.isEnterprise ? 'GitHub Enterprise' : 'Public GitHub'}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* PAT Section */}
        <div className="settings-section">
          <h3>Personal Access Token</h3>
          {patConfig && patPersisted ? (
            <div className="pat-status">
              <div className="pat-status-info">
                <span className="pat-status-badge pat-stored">
                  Token stored for {patConfig.domain}
                </span>
                <button
                  className="toggle-visibility-btn"
                  onClick={() => setShowPatInfo(!showPatInfo)}
                >
                  {showPatInfo ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {showPatInfo && (
                <div className="pat-details">
                  <p>
                    <strong>Domain:</strong> {patConfig.domain}
                  </p>
                  <p>
                    <strong>Stored at:</strong>{' '}
                    {new Date(patConfig.storedAt).toLocaleString()}
                  </p>
                  <p>
                    <strong>Token:</strong> {patConfig.token.substring(0, 8)}...
                  </p>
                </div>
              )}
              <button
                className="button button-danger clear-pat-btn"
                onClick={handleClearPat}
              >
                <Trash2 size={16} />
                Clear stored token
              </button>
            </div>
          ) : (
            <>
              {!showAddPat ? (
                <div className="pat-status">
                  <span className="pat-status-badge pat-not-stored">
                    No token stored
                  </span>
                  <p className="pat-hint">
                    You'll be prompted to enter a PAT when performing GitHub actions.
                  </p>
                  <button
                    className="button button-secondary"
                    onClick={() => setShowAddPat(true)}
                  >
                    Add Token
                  </button>
                </div>
              ) : (
                <div className="pat-input-form">
                  <div className="pat-input-group">
                    <label htmlFor="pat-input" className="pat-input-label">
                      Enter Personal Access Token for {domain}
                    </label>
                    <div className="pat-input-wrapper">
                      <input
                        id="pat-input"
                        type={showNewPat ? 'text' : 'password'}
                        className="pat-input"
                        value={newPat}
                        onChange={(e) => setNewPat(e.target.value)}
                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                        disabled={isValidating}
                      />
                      <button
                        className="toggle-visibility-btn pat-input-toggle"
                        onClick={() => setShowNewPat(!showNewPat)}
                        type="button"
                      >
                        {showNewPat ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  
                  <label className="pat-persist-option">
                    <input
                      type="checkbox"
                      checked={persistPat}
                      onChange={(e) => setPersistPat(e.target.checked)}
                      disabled={isValidating}
                    />
                    <span>Keep token for this session</span>
                  </label>

                  {patError && (
                    <div className="pat-error">
                      <AlertCircle size={14} />
                      <span>{patError}</span>
                    </div>
                  )}

                  <div className="pat-input-actions">
                    <button
                      className="button button-primary"
                      onClick={handleSavePat}
                      disabled={isValidating || !newPat.trim()}
                    >
                      {isValidating ? (
                        <>
                          <Loader2 size={16} className="spinner" />
                          Validating...
                        </>
                      ) : (
                        <>
                          <Save size={16} />
                          Save Token
                        </>
                      )}
                    </button>
                    <button
                      className="button button-secondary"
                      onClick={handleCancelAddPat}
                      disabled={isValidating}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          <a
            href={patGuideUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="pat-guide-link"
          >
            Learn how to create a Personal Access Token <ExternalLink size={12} />
          </a>
        </div>

        {/* Current File Metadata */}
        {githubMetadata && (
          <div className="settings-section">
            <h3>Current File</h3>
            <div className="metadata-display">
              <div className="metadata-row">
                <span className="metadata-label">Domain:</span>
                <span className="metadata-value">{githubMetadata.domain}</span>
              </div>
              <div className="metadata-row">
                <span className="metadata-label">Repository:</span>
                <span className="metadata-value">
                  {githubMetadata.owner}/{githubMetadata.repository}
                </span>
              </div>
              <div className="metadata-row">
                <span className="metadata-label">Branch:</span>
                <span className="metadata-value">{githubMetadata.branch}</span>
              </div>
              <div className="metadata-row">
                <span className="metadata-label">Path:</span>
                <span className="metadata-value">{githubMetadata.path}</span>
              </div>
              <div className="metadata-row">
                <span className="metadata-label">Loaded at:</span>
                <span className="metadata-value">
                  {new Date(githubMetadata.loadedAt).toLocaleString()}
                </span>
              </div>

            {onSync && (
              <button className="button button-secondary sync-button" onClick={onSync}>
                <RefreshCw size={16} />
                Sync with Repository
              </button>
            )}

            </div>
            <div className="metadata-warning">
              <AlertCircle size={14} />
              <span>
                Changes to domain settings won't affect the current file's
                connection. They apply to new GitHub operations.
              </span>
            </div>
          </div>
        )}

        {/* Close Button */}
        <div className="modal-actions">
          <button className="button button-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
