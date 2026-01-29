import React, { useState, useEffect } from 'react';
import { GitBranch, AlertTriangle, X, XCircle, FileText, MessageSquare } from 'lucide-react';
import type { GitHubMetadata, GitHubDomain } from '../types';
import { GitHubApiClient } from '../githubApi';
import { clearPatIfNotPersisted } from '../patStorage';
import { RepositoryBranchSelector } from '../RepositoryBranchSelector';
import './GitHubCommitModal.css';

export interface GitHubCommitModalProps {
  isOpen: boolean;
  metadata: GitHubMetadata | null;
  threatModelName: string;
  domain: GitHubDomain;
  getApiClient: () => Promise<GitHubApiClient | null>;
  onClose: () => void;
  onCommit: (owner: string, repo: string, branch: string, path: string, commitMessage: string, sha?: string) => Promise<void>;
}

export function GitHubCommitModal({
  isOpen,
  metadata,
  threatModelName,
  getApiClient,
  onClose,
  onCommit,
}: GitHubCommitModalProps): React.JSX.Element | null {
  const [commitSummary, setCommitSummary] = useState('');
  const [commitDescription, setCommitDescription] = useState('');
  
  // Editable fields
  const [owner, setOwner] = useState('');
  const [repository, setRepository] = useState('');
  const [branch, setBranch] = useState('');
  const [filename, setFilename] = useState('');
  
  // For initializing the selector component
  const [initialRepos, setInitialRepos] = useState<Array<{name: string; owner: string; full_name: string}>>([]);
  const [initialBranches, setInitialBranches] = useState<Array<{name: string; protected: boolean}>>([]);
  const [apiClient, setApiClient] = useState<GitHubApiClient | null>(null);
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [conflictDetected, setConflictDetected] = useState(false);
  const [currentSha, setCurrentSha] = useState<string | undefined>();
  const [fileExistsAtNewLocation, setFileExistsAtNewLocation] = useState(false);
  const [newLocationSha, setNewLocationSha] = useState<string | undefined>();
  const [isCommitting, setIsCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCheckedConflicts, setHasCheckedConflicts] = useState(false);

  // Initialize fields from metadata or defaults
  useEffect(() => {
    if (isOpen) {
      // Reset conflict check state when modal opens
      setHasCheckedConflicts(false);
      setConflictDetected(false);
      setCurrentSha(undefined);
      setFileExistsAtNewLocation(false);
      setNewLocationSha(undefined);
      setError(null);
      
      if (metadata) {
        setOwner(metadata.owner);
        setRepository(metadata.repository);
        setBranch(metadata.branch);
        // Extract just the filename from the path
        const pathParts = metadata.path.split('/');
        setFilename(pathParts[pathParts.length - 1]);
        
        // Pre-populate initial values for selector
        setInitialRepos([{
          name: metadata.repository,
          owner: metadata.owner,
          full_name: `${metadata.owner}/${metadata.repository}`
        }]);
        
        setInitialBranches([{
          name: metadata.branch,
          protected: false
        }]);
      } else {
        // Set defaults for new commit
        setOwner('');
        setRepository('');
        setBranch('');
        setFilename(`${threatModelName.toLowerCase().replace(/\s+/g, '-')}.yaml`);
        setInitialRepos([]);
        setInitialBranches([]);
      }
      
      // Load API client
      getApiClient().then(client => setApiClient(client));
    }
  }, [isOpen, metadata, threatModelName, getApiClient]);

  // Set default commit message
  useEffect(() => {
    if (isOpen && !commitSummary) {
      if (metadata) {
        setCommitSummary(`Update threat model: ${threatModelName}`);
      } else {
        setCommitSummary(`Add threat model: ${threatModelName}`);
      }
    }
  }, [isOpen, metadata, threatModelName, commitSummary]);

  // Enter edit mode
  const handleEnterEditMode = () => {
    setIsEditMode(true);
  };

  // Check for conflicts when modal opens and metadata exists
  useEffect(() => {
    if (!isOpen || !metadata || hasCheckedConflicts) {
      return;
    }

    // Only check if we're NOT in edit mode
    // In edit mode, user might be changing destination, so conflict check doesn't apply
    if (isEditMode) {
      return;
    }

    const checkForConflicts = async () => {
      try {
        const apiClient = await getApiClient();
        if (!apiClient) {
          setError('GitHub authentication required');
          setHasCheckedConflicts(true);
          return;
        }

        const fileSha = await apiClient.getFileSha(
          metadata.owner,
          metadata.repository,
          metadata.path,
          metadata.branch
        );

        if (fileSha && fileSha !== metadata.sha) {
          setConflictDetected(true);
          setCurrentSha(fileSha);
        } else {
          setConflictDetected(false);
          setCurrentSha(metadata.sha);
        }
        setHasCheckedConflicts(true);
      } catch (err) {
        console.error('Failed to check for conflicts:', err);
        // If file doesn't exist, that's okay for new files
        setConflictDetected(false);
        setCurrentSha(undefined);
        setHasCheckedConflicts(true);
      }
    };

    checkForConflicts();
  }, [isOpen, metadata, hasCheckedConflicts, isEditMode, getApiClient]);

  // Check if file exists at new location when user changes filename/repo/branch
  useEffect(() => {
    if (!isOpen || !owner || !repository || !branch || !filename.trim()) {
      setFileExistsAtNewLocation(false);
      setNewLocationSha(undefined);
      return;
    }

    // Don't check if we're still using original metadata values
    if (
      metadata &&
      owner === metadata.owner &&
      repository === metadata.repository &&
      branch === metadata.branch &&
      filename === metadata.path.split('/').pop()
    ) {
      setFileExistsAtNewLocation(false);
      setNewLocationSha(undefined);
      return;
    }

    const checkFileExists = async () => {
      try {
        const apiClient = await getApiClient();
        if (!apiClient) {
          return;
        }

        const path = `.threat-models/${filename.trim()}`;
        const fileSha = await apiClient.getFileSha(owner, repository, path, branch);

        if (fileSha) {
          setFileExistsAtNewLocation(true);
          setNewLocationSha(fileSha);
        } else {
          setFileExistsAtNewLocation(false);
          setNewLocationSha(undefined);
        }
      } catch (err) {
        // File doesn't exist, which is fine
        setFileExistsAtNewLocation(false);
        setNewLocationSha(undefined);
      }
    };

    // Debounce the check slightly to avoid too many API calls while typing
    const timeoutId = setTimeout(checkFileExists, 500);
    return () => clearTimeout(timeoutId);
  }, [isOpen, owner, repository, branch, filename, metadata, getApiClient]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!commitSummary.trim()) {
      setError('Please enter a commit summary');
      return;
    }

    if (!owner || !repository || !branch) {
      setError('Please select owner, repository, and branch');
      return;
    }

    if (!filename.trim()) {
      setError('Please enter a filename');
      return;
    }

    setIsCommitting(true);
    setError(null);

    try {
      const path = `.threat-models/${filename.trim()}`;
      
      // Determine SHA to use:
      // - If conflict detected, use currentSha (the latest SHA from the repo)
      // - If file exists at new location (changed filename/repo/branch), use that SHA
      // - If metadata exists AND we haven't changed repo/branch/filename, use metadata.sha
      // - Otherwise (new file), don't pass SHA
      let sha: string | undefined;
      if (conflictDetected && currentSha) {
        sha = currentSha;
      } else if (fileExistsAtNewLocation && newLocationSha) {
        sha = newLocationSha;
      } else if (
        metadata && 
        owner === metadata.owner && 
        repository === metadata.repository && 
        branch === metadata.branch &&
        filename === metadata.path.split('/').pop()
      ) {
        sha = metadata.sha;
      }
      // else: sha remains undefined for new files
      
      // Combine summary and description with proper formatting
      const fullMessage = commitDescription.trim() 
        ? `${commitSummary.trim()}\n\n${commitDescription.trim()}`
        : commitSummary.trim();
      await onCommit(owner, repository, branch, path, fullMessage, sha);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to commit changes');
    } finally {
      setIsCommitting(false);
    }
  };

  const handleClose = () => {
    if (!isCommitting) {
      // Clean up temporary PAT when modal is closed without committing
      clearPatIfNotPersisted();
      setHasCheckedConflicts(false);
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="github-commit-modal-overlay" onClick={handleClose}>
      <div className="github-commit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="github-commit-modal-header">
          <GitBranch size={24} />
          <h2>Commit to GitHub</h2>
          <button
            onClick={handleClose}
            disabled={isCommitting}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '0.25rem',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="github-commit-modal-body">
            {/* Destination info - static display or editable */}
            {!isEditMode ? (
              <div className="commit-form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label className="commit-form-label">Destination</label>
                  <button
                    type="button"
                    onClick={handleEnterEditMode}
                    disabled={isCommitting}
                    style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.875rem',
                      background: 'var(--button-background)',
                      color: 'var(--button-text)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Edit
                  </button>
                </div>
                <div style={{ 
                  padding: '0.75rem',
                  background: 'var(--bg-secondary)',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  color: 'var(--text-primary)'
                }}>
                  <div><strong>Repository:</strong> {owner}/{repository}</div>
                  <div style={{ marginTop: '0.25rem' }}><strong>Branch:</strong> {branch}</div>
                  <div style={{ marginTop: '0.25rem' }}><strong>Path:</strong> /.threat-models/{filename}</div>
                </div>
              </div>
            ) : (
              <>
                <RepositoryBranchSelector
                  apiClient={apiClient}
                  selectedOwner={owner}
                  selectedRepo={repository}
                  selectedBranch={branch}
                  onRepoChange={(newOwner, newRepo) => {
                    setOwner(newOwner);
                    setRepository(newRepo);
                    setBranch(''); // Reset branch when repo changes
                  }}
                  onBranchChange={setBranch}
                  disabled={isCommitting}
                  autoSelectDefaultBranch={false}
                  initialRepos={initialRepos}
                  initialBranches={initialBranches}
                />

            {/* Filename input */}
            <div className="github-selector-group">
              <label>
                <FileText size={14} />
                Filename *
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  .threat-models/
                </span>
                <input
                  type="text"
                  id="filename-input"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  placeholder="threat-model.yaml"
                  disabled={isCommitting}
                  required
                  style={{ flex: 1 }}
                />
              </div>
            </div>
              </>
            )}

            {/* Conflict warning */}
            {conflictDetected && (
              <div className="commit-warning">
                <AlertTriangle size={20} />
                <div className="commit-warning-content">
                  <p className="commit-warning-title">File has been modified</p>
                  <p className="commit-warning-message">
                    The file in the repository has been modified since you loaded it.
                    Committing will overwrite those changes.
                  </p>
                </div>
              </div>
            )}

            {/* File exists at new location warning */}
            {fileExistsAtNewLocation && !conflictDetected && (
              <div className="commit-warning">
                <AlertTriangle size={20} />
                <div className="commit-warning-content">
                  <p className="commit-warning-title">File already exists</p>
                  <p className="commit-warning-message">
                    A file with this name already exists at the specified location.
                    Committing will overwrite the existing file.
                  </p>
                </div>
              </div>
            )}

            {/* Commit summary */}
            <div className="github-selector-group">
              <label>
                <GitBranch size={14} />
                Commit Summary *
              </label>
              <input
                type="text"
                id="commit-summary"
                value={commitSummary}
                onChange={(e) => setCommitSummary(e.target.value)}
                placeholder="Brief summary of changes"
                disabled={isCommitting}
                required
                maxLength={72}
              />
            </div>

            {/* Commit description */}
            <div className="github-selector-group">
              <label>
                <MessageSquare size={14} />
                Description (optional)
              </label>
              <textarea
                id="commit-description"
                value={commitDescription}
                onChange={(e) => setCommitDescription(e.target.value)}
                placeholder="Additional details about your changes..."
                disabled={isCommitting}
                rows={4}
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="commit-error">
                <XCircle size={20} />
                <p className="commit-error-message">{error}</p>
              </div>
            )}
          </div>

          <div className="github-commit-modal-footer">
            <button
              type="button"
              className="cancel-button"
              onClick={handleClose}
              disabled={isCommitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="commit-button"
              disabled={isCommitting || !commitSummary.trim() || !owner || !repository || !branch || !filename.trim()}
            >
              {isCommitting ? (
                <>
                  <span className="commit-loading-spinner" />
                  Committing...
                </>
              ) : (
                <>
                  <GitBranch size={16} />
                  Commit Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
