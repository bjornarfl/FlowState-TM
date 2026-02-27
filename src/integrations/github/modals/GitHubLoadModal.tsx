import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronDown,
  Loader2,
  GitBranch,
  FolderGit2,
  FileText,
  AlertCircle,
  RefreshCw,
  Search,
  X,
  Folder,
} from 'lucide-react';
import { GitHubApiClient, GitHubApiError } from '../githubApi';
import { clearPatIfNotPersisted } from '../utils/patStorage';
import type {
  GitHubDomain,
  GitHubRepository,
  GitHubBranch,
  GitHubContent,
  GitHubMetadata,
} from '../types';
import './GitHubLoadModal.css';

export interface GitHubLoadModalProps {
  isOpen: boolean;
  token: string;
  domain: GitHubDomain;
  onFileSelect: (content: string, metadata: GitHubMetadata) => void;
  onClose: () => void;
  onError: (error: string) => void;
}

type LoadingState = 'idle' | 'loading' | 'error';

export const GitHubLoadModal: React.FC<GitHubLoadModalProps> = ({
  isOpen,
  token,
  domain,
  onFileSelect,
  onClose,
  onError,
}) => {
  const [client] = useState(() => new GitHubApiClient(token, domain));
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [filteredRepositories, setFilteredRepositories] = useState<GitHubRepository[]>([]);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [threatModels, setThreatModels] = useState<GitHubContent[]>([]);

  const [repoSearchQuery, setRepoSearchQuery] = useState('');
  const [selectedOwner, setSelectedOwner] = useState<string>('');
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');

  const [reposLoading, setReposLoading] = useState<LoadingState>('idle');
  const [branchesLoading, setBranchesLoading] = useState<LoadingState>('idle');
  const [filesLoading, setFilesLoading] = useState<LoadingState>('idle');
  const [fileLoading, setFileLoading] = useState<string | null>(null);

  // Initial repo load pagination state
  const [currentRepoPage, setCurrentRepoPage] = useState(1);
  const [hasMoreRepos, setHasMoreRepos] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Filter repositories based on search query (client-side only)
  useEffect(() => {
    if (!repoSearchQuery.trim()) {
      setFilteredRepositories(repositories);
    } else {
      const query = repoSearchQuery.toLowerCase();
      setFilteredRepositories(
        repositories.filter((repo) =>
          repo.full_name.toLowerCase().includes(query) ||
          repo.description?.toLowerCase().includes(query)
        )
      );
    }
  }, [repoSearchQuery, repositories]);

  // Load all accessible repositories on mount
  useEffect(() => {
    let cancelled = false;
    
    const loadRepositories = async () => {
      setReposLoading('loading');
      try {
        const reposResult = await client.listAccessibleRepositories();
        if (cancelled) return;
        setRepositories(reposResult);
        setCurrentRepoPage(1);
        // Detect if more repos might be available (hitting the 100 repo limit)
        const hasMore = reposResult.length === 100;
        setHasMoreRepos(hasMore);
        setReposLoading('idle');
      } catch (err) {
        if (cancelled) return;
        
        setReposLoading('error');
        const message =
          err instanceof GitHubApiError
            ? err.message
            : 'Failed to load repositories';
        onError(message);
      }
    };
    loadRepositories();
    
    return () => {
      cancelled = true;
    };
  }, [client, onError]);

  // Load branches when repository changes
  useEffect(() => {
    if (!selectedOwner || !selectedRepo) {
      setBranches([]);
      setSelectedBranch('');
      setThreatModels([]);
      return;
    }

    const loadBranches = async () => {
      setBranchesLoading('loading');
      setBranches([]);
      setSelectedBranch('');
      setThreatModels([]);

      try {
        const branchList = await client.listBranches(selectedOwner, selectedRepo);
        setBranches(branchList);

        // Auto-select default branch
        const repo = repositories.find((r) => r.name === selectedRepo);
        if (repo) {
          const defaultBranch = branchList.find(
            (b) => b.name === repo.default_branch
          );
          if (defaultBranch) {
            setSelectedBranch(defaultBranch.name);
          }
        }
        setBranchesLoading('idle');
      } catch (err) {
        setBranchesLoading('error');
        const message =
          err instanceof GitHubApiError
            ? err.message
            : 'Failed to load branches';
        onError(message);
      }
    };
    loadBranches();
  }, [client, selectedOwner, selectedRepo, repositories, onError]);

  // Load threat models when branch changes
  useEffect(() => {
    if (!selectedOwner || !selectedRepo || !selectedBranch) {
      setThreatModels([]);
      return;
    }

    const loadThreatModels = async () => {
      setFilesLoading('loading');
      setThreatModels([]);

      try {
        const files = await client.listThreatModels(
          selectedOwner,
          selectedRepo,
          selectedBranch
        );
        setThreatModels(files);
        setFilesLoading('idle');
      } catch (err) {
        setFilesLoading('error');
        const message =
          err instanceof GitHubApiError
            ? err.message
            : 'Failed to load threat models';
        onError(message);
      }
    };
    loadThreatModels();
  }, [client, selectedOwner, selectedRepo, selectedBranch, onError]);

  const handleLoadMoreRepos = useCallback(async () => {
    if (!hasMoreRepos || isLoadingMore || repoSearchQuery.trim()) return;

    const nextPage = currentRepoPage + 1;

    setIsLoadingMore(true);
    try {
      const moreRepos = await client.listAccessibleRepositoriesPage(nextPage);
      
      setRepositories((prev) => {
        return [...prev, ...moreRepos];
      });
      setCurrentRepoPage(nextPage);
      const hasMore = moreRepos.length === 100;
      setHasMoreRepos(hasMore);
    } catch (err) {
      const message =
        err instanceof GitHubApiError
          ? err.message
          : 'Failed to load more repositories';
      onError(message);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMoreRepos, isLoadingMore, repoSearchQuery, currentRepoPage, client, onError]);

  const handleRepoChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const repoFullName = e.target.value;
      
      // Handle Load More option
      if (repoFullName === '__LOAD_MORE__') {
        handleLoadMoreRepos();
        // Reset select to empty
        e.target.value = '';
        return;
      }
      
      if (!repoFullName) {
        setSelectedRepo('');
        setSelectedOwner('');
        return;
      }

      const repo = repositories.find((r) => r.full_name === repoFullName);
      if (repo) {
        setSelectedOwner(repo.owner.login);
        setSelectedRepo(repo.name);
      }
    },
    [repositories, handleLoadMoreRepos]
  );

  const handleFileClick = useCallback(
    async (file: GitHubContent) => {
      setFileLoading(file.path);

      try {
        const { content, sha } = await client.getFileContent(
          selectedOwner,
          selectedRepo,
          file.path,
          selectedBranch
        );

        const metadata: GitHubMetadata = {
          domain,
          owner: selectedOwner,
          repository: selectedRepo,
          branch: selectedBranch,
          path: file.path,
          sha,
          loadedAt: Date.now(),
        };

        onFileSelect(content, metadata);
      } catch (err) {
        const message =
          err instanceof GitHubApiError
            ? err.message
            : err instanceof Error
            ? `Failed to load file: ${err.message}`
            : 'Failed to load file';
        onError(message);
        console.error('GitHub file load error:', err);
      } finally {
        setFileLoading(null);
      }
    },
    [client, domain, selectedOwner, selectedRepo, selectedBranch, onFileSelect, onError]
  );

  const refreshFiles = useCallback(async () => {
    if (!selectedOwner || !selectedRepo || !selectedBranch) return;

    setFilesLoading('loading');
    try {
      const files = await client.listThreatModels(
        selectedOwner,
        selectedRepo,
        selectedBranch
      );
      setThreatModels(files);
      setFilesLoading('idle');
    } catch (err) {
      setFilesLoading('error');
      const message =
        err instanceof GitHubApiError
          ? err.message
          : 'Failed to refresh files';
      onError(message);
    }
  }, [client, selectedOwner, selectedRepo, selectedBranch, onError]);

  const handleClose = useCallback(() => {
    // Clean up temporary PAT when modal is closed without selecting a file
    clearPatIfNotPersisted();
    onClose();
  }, [onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="github-load-modal-overlay" onClick={handleClose}>
      <div className="github-load-modal" onClick={(e) => e.stopPropagation()}>
        <div className="github-load-modal-header">
          <FolderGit2 size={20} />
          <h2>Load from GitHub</h2>
          <button
            className="github-load-modal-close"
            onClick={handleClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="github-load-modal-body">

          {/* Repository search and selector */}
          <div className="github-selector-group">
            <label>
              <FolderGit2 size={14} />
              Repository
            </label>
            <div className="repo-search-wrapper">
              <div className="repo-search-input">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search repositories..."
                  value={repoSearchQuery}
                  onChange={(e) => setRepoSearchQuery(e.target.value)}
                  disabled={reposLoading === 'loading'}
                />
                {repoSearchQuery && (
                  <button
                    className="clear-search"
                    onClick={() => setRepoSearchQuery('')}
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
            <div className="select-wrapper">
              <select
                value={selectedRepo ? `${selectedOwner}/${selectedRepo}` : ''}
                onChange={handleRepoChange}
                disabled={reposLoading === 'loading' || isLoadingMore}
              >
                <option value="">Select a repository...</option>
                {filteredRepositories.map((repo) => (
                  <option key={repo.id} value={repo.full_name}>
                    {repo.full_name}
                  </option>
                ))}
                {hasMoreRepos && !repoSearchQuery.trim() && (
                  <option value="__LOAD_MORE__" className="load-more-option">
                    {isLoadingMore ? '⏳ Loading more...' : '↓ Load More Repositories'}
                  </option>
                )}
              </select>
              <ChevronDown size={16} className="select-icon" />
              {(reposLoading === 'loading' || isLoadingMore) && (
                <Loader2 size={16} className="loading-icon spin" />
              )}
            </div>
            {filteredRepositories.length === 0 && repositories.length > 0 && (
              <div className="no-results">No repositories match your search</div>
            )}
          </div>

          {/* Branch selector */}
          <div className="github-selector-group">
            <label>
              <GitBranch size={14} />
              Branch
            </label>
            <div className="select-wrapper">
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                disabled={!selectedRepo || branchesLoading === 'loading'}
              >
                <option value="">Select...</option>
                {branches.map((branch) => (
                  <option key={branch.name} value={branch.name}>
                    {branch.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="select-icon" />
              {branchesLoading === 'loading' && (
                <Loader2 size={16} className="loading-icon spin" />
              )}
            </div>
          </div>

          {/* Threat model files list */}
          <div className="github-files-section">
            <div className="files-header">
              <label>
                <FileText size={14} />
                Threat Models
              </label>
              {selectedBranch && (
                <button
                  className="refresh-btn"
                  onClick={refreshFiles}
                  disabled={filesLoading === 'loading'}
                  title="Refresh file list"
                >
                  <RefreshCw
                    size={14}
                    className={filesLoading === 'loading' ? 'spin' : ''}
                  />
                </button>
              )}
            </div>
            <div className="files-path-hint">
              <Folder size={12} />
              <span>Scanning <code>/.threat-models</code> and subfolders</span>
            </div>

            <div className="github-files-list">
              {filesLoading === 'loading' ? (
                <div className="files-loading">
                  <Loader2 size={20} className="spin" />
                  <span>Loading threat models...</span>
                </div>
              ) : threatModels.length === 0 && selectedBranch ? (
                <div className="files-empty">
                  <AlertCircle size={20} />
                  <span>No threat models found in /.threat-models</span>
                </div>
              ) : !selectedBranch ? (
                <div className="files-empty">
                  <span>Select a branch to view threat models</span>
                </div>
              ) : (
                threatModels.map((file) => {
                  // Show path relative to .threat-models/
                  const relativePath = file.path.startsWith('.threat-models/')
                    ? file.path.slice('.threat-models/'.length)
                    : file.name;
                  const subfolder = relativePath.includes('/')
                    ? relativePath.substring(0, relativePath.lastIndexOf('/'))
                    : null;

                  return (
                    <button
                      key={file.path}
                      className="github-file-item"
                      onClick={() => handleFileClick(file)}
                      disabled={fileLoading !== null}
                    >
                      <FileText size={16} />
                      <span className="file-name">
                        {file.name}
                        {subfolder && (
                          <span className="file-subfolder">
                            <Folder size={14} />
                            {subfolder}
                          </span>
                        )}
                      </span>
                      {fileLoading === file.path && (
                        <Loader2 size={14} className="spin" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
