import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, ExternalLink } from 'lucide-react';
import {
  GitHubDomain,
  GitHubAction,
  ACTION_DESCRIPTIONS,
  ACTION_REQUIRED_SCOPES,
} from '../types';
import { GITHUB_DOMAINS } from '../githubDomains.config';
import './PatModal.css';

interface PatModalProps {
  action: GitHubAction;
  domain: GitHubDomain;
  onSubmit: (token: string, persistInSession: boolean) => void;
  onCancel: () => void;
  onChangeDomain?: (domain: GitHubDomain) => void;
  isValidating?: boolean;
  error?: string;
}

export const PatModal: React.FC<PatModalProps> = ({
  action,
  domain,
  onSubmit,
  onCancel,
  onChangeDomain,
  isValidating = false,
  error,
}) => {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [persistInSession, setPersistInSession] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus the input when the modal opens
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    if (token.trim()) {
      onSubmit(token.trim(), persistInSession);
    }
  };

  const requiredScopes = ACTION_REQUIRED_SCOPES[action];
  const actionDescription = ACTION_DESCRIPTIONS[action];

  const patGuideUrl =
    domain === 'github.com'
      ? 'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token'
      : 'https://docs.github.com/en/enterprise-server@latest/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token';

  return (
    <div className="modal-overlay">
      <div className="modal-content pat-modal">
        <h2>Enter GitHub Token</h2>

        <p className="action-description">
          Action: <strong>{actionDescription}</strong>
        </p>

        <div>
          {/* Domain selector */}
          {onChangeDomain && (
            <div className="form-group">
              <label htmlFor="github-domain">GitHub Instance</label>
              <select
                id="github-domain"
                value={domain}
                onChange={(e) => onChangeDomain(e.target.value as GitHubDomain)}
                disabled={isValidating}
              >
                {GITHUB_DOMAINS.map((config) => (
                  <option key={config.domain} value={config.domain}>
                    {config.displayName}
                    {config.isEnterprise ? ' (Enterprise)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* PAT Input */}
          <div className="form-group">
            <label htmlFor="pat-input">Personal Access Token (PAT)</label>
            <div className="pat-input-wrapper">
              <input
                ref={inputRef}
                id="pat-input"
                name="github-token"
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && token.trim() && !isValidating) {
                    handleSubmit();
                  }
                }}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                disabled={isValidating}
              />
              <button
                type="button"
                className="toggle-visibility"
                onClick={() => setShowToken(!showToken)}
                title={showToken ? 'Hide token' : 'Show token'}
              >
                {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Error display */}
          {error && <div className="pat-error">{error}</div>}
          
          {/* Persist toggle */}
          <div className="form-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={persistInSession}
                onChange={(e) => setPersistInSession(e.target.checked)}
                disabled={isValidating}
              />
              <span>Remember token for this session</span>
            </label>
            <p className="field-hint">
              Token will be stored in sessionStorage and deleted when you close
              the browser tab. Without this option, you'll need to enter your
              token for each action.
            </p>
          </div>

          {/* Required scopes info */}
          <div className="scopes-info">
            <h4>Required Permissions</h4>
            <p>
              Your{' '}
              <a href={patGuideUrl} target="_blank" rel="noopener noreferrer">
                Personal Access Token <ExternalLink size={12} />
              </a>{' '}
              needs these scopes:
            </p>
            <ul>
              {requiredScopes.map((scope) => (
                <li key={scope}>{scope}</li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          <div className="modal-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={onCancel}
              disabled={isValidating}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={handleSubmit}
              disabled={!token.trim() || isValidating}
            >
              {isValidating ? 'Validating...' : 'Authenticate'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
