import React, { useState, useEffect, useCallback } from 'react';
import { FolderGit2, GitBranch, Search, ChevronDown, Loader2 } from 'lucide-react';
import { GitHubApiClient } from './githubApi';

export interface RepositoryBranchSelectorProps {
  apiClient: GitHubApiClient | null;
  selectedOwner: string;
  selectedRepo: string;
  selectedBranch: string;
  onRepoChange: (owner: string, repo: string) => void;
  onBranchChange: (branch: string) => void;
  disabled?: boolean;
  autoSelectDefaultBranch?: boolean;
  initialRepos?: Array<{ name: string; owner: string; full_name: string }>;
  initialBranches?: Array<{ name: string; protected: boolean }>;
}

export function RepositoryBranchSelector({
  apiClient,
  selectedOwner,
  selectedRepo,
  selectedBranch,
  onRepoChange,
  onBranchChange,
  disabled = false,
  autoSelectDefaultBranch = true,
  initialRepos = [],
  initialBranches = [],
}: RepositoryBranchSelectorProps): React.JSX.Element {
  const [repositories, setRepositories] = useState<Array<{ name: string; owner: string; full_name: string }>>(initialRepos);
  const [branches, setBranches] = useState<Array<{ name: string; protected: boolean }>>(initialBranches);
  const [repoSearchQuery, setRepoSearchQuery] = useState('');
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [hasLoadedRepos, setHasLoadedRepos] = useState(false);
  const [hasLoadedBranches, setHasLoadedBranches] = useState(false);
  
  // Pagination state for repositories
  const [currentRepoPage, setCurrentRepoPage] = useState(1);
  const [hasMoreRepos, setHasMoreRepos] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Load accessible repositories on demand
  const loadRepositories = async () => {
    if (hasLoadedRepos || loadingRepos || !apiClient) {
      return;
    }

    setLoadingRepos(true);
    try {
      const repos = await apiClient.listAccessibleRepositories();
      setRepositories(repos.map(r => ({
        name: r.name,
        owner: r.owner.login,
        full_name: r.full_name
      })));
      setCurrentRepoPage(1);
      setHasMoreRepos(repos.length === 100);
      setHasLoadedRepos(true);
    } catch (err) {
      console.error('Failed to load repositories:', err);
    } finally {
      setLoadingRepos(false);
    }
  };

  // Load more repositories
  const handleLoadMoreRepos = useCallback(async () => {
    if (!hasMoreRepos || isLoadingMore || repoSearchQuery.trim() || !apiClient) {
      return;
    }

    const nextPage = currentRepoPage + 1;
    setIsLoadingMore(true);
    try {
      const moreRepos = await apiClient.listAccessibleRepositoriesPage(nextPage);
      setRepositories((prev) => [
        ...prev,
        ...moreRepos.map(r => ({
          name: r.name,
          owner: r.owner.login,
          full_name: r.full_name
        }))
      ]);
      setCurrentRepoPage(nextPage);
      setHasMoreRepos(moreRepos.length === 100);
    } catch (err) {
      console.error('Failed to load more repositories:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMoreRepos, isLoadingMore, repoSearchQuery, currentRepoPage, apiClient]);

  // Load branches when repository changes
  useEffect(() => {
    if (!selectedOwner || !selectedRepo || hasLoadedBranches || loadingBranches || !apiClient) {
      return;
    }

    const loadBranches = async () => {
      setLoadingBranches(true);
      try {
        const branchList = await apiClient.listBranches(selectedOwner, selectedRepo);
        setBranches(branchList.map(b => ({
          name: b.name,
          protected: b.protected
        })));

        // Auto-select default branch if enabled
        if (autoSelectDefaultBranch && !selectedBranch) {
          const repos = await apiClient.listAccessibleRepositories();
          const repo = repos.find((r) => r.name === selectedRepo);
          if (repo) {
            const defaultBranch = branchList.find((b) => b.name === repo.default_branch);
            if (defaultBranch) {
              onBranchChange(defaultBranch.name);
            }
          }
        }
        setHasLoadedBranches(true);
      } catch (err) {
        console.error('Failed to load branches:', err);
      } finally {
        setLoadingBranches(false);
      }
    };

    loadBranches();
  }, [selectedOwner, selectedRepo, hasLoadedBranches, loadingBranches, apiClient, autoSelectDefaultBranch, selectedBranch, onBranchChange]);

  // Load repositories automatically when apiClient becomes available (for edit mode)
  useEffect(() => {
    if (apiClient && !hasLoadedRepos && !loadingRepos && repositories.length <= 1) {
      loadRepositories();
    }
  }, [apiClient, hasLoadedRepos, loadingRepos, repositories.length]);

  // Reset branch loading state when owner/repository changes
  useEffect(() => {
    if (hasLoadedBranches) {
      setHasLoadedBranches(false);
      setBranches([]);
    }
  }, [selectedOwner, selectedRepo]);

  const handleRepoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const repoFullName = e.target.value;
    
    // Handle Load More option
    if (repoFullName === '__LOAD_MORE__') {
      handleLoadMoreRepos();
      e.target.value = selectedRepo ? `${selectedOwner}/${selectedRepo}` : '';
      return;
    }
    
    if (!repoFullName) {
      onRepoChange('', '');
      return;
    }

    const [owner, repo] = repoFullName.split('/');
    onRepoChange(owner || '', repo || '');
  };

  // Filter repositories based on search
  const filteredRepositories = repoSearchQuery.trim()
    ? repositories.filter((repo) =>
        repo.full_name.toLowerCase().includes(repoSearchQuery.toLowerCase())
      )
    : repositories;

  return (
    <>
      {/* Repository selection */}
      <div className="github-selector-group">
        <label>
          <FolderGit2 size={14} />
          Repository *
        </label>
        <div className="repo-search-wrapper">
          <div className="repo-search-input">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search repositories..."
              value={repoSearchQuery}
              onChange={(e) => setRepoSearchQuery(e.target.value)}
              onFocus={loadRepositories}
              disabled={disabled || loadingRepos}
            />
            {repoSearchQuery && (
              <button
                className="clear-search"
                onClick={() => setRepoSearchQuery('')}
                aria-label="Clear search"
                type="button"
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
            disabled={disabled || loadingRepos || isLoadingMore}
            required
          >
            <option value="">Select a repository...</option>
            {filteredRepositories.map((repo) => (
              <option key={repo.full_name} value={repo.full_name}>
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
          {(loadingRepos || isLoadingMore) && (
            <Loader2 size={16} className="loading-icon spin" />
          )}
        </div>
        {repositories.length > 0 && filteredRepositories.length === 0 && (
          <div className="no-results">No repositories match your search</div>
        )}
      </div>

      {/* Branch selection */}
      <div className="github-selector-group">
        <label>
          <GitBranch size={14} />
          Branch *
        </label>
        <div className="select-wrapper">
          <select
            value={selectedBranch}
            onChange={(e) => onBranchChange(e.target.value)}
            disabled={disabled || loadingBranches || !selectedOwner || !selectedRepo}
            required
          >
            <option value="">
              {loadingBranches ? 'Loading branches...' : 'Select...'}
            </option>
            {branches.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name} {b.protected ? '🛡️' : ''}
              </option>
            ))}
          </select>
          <ChevronDown size={16} className="select-icon" />
          {loadingBranches && (
            <Loader2 size={16} className="loading-icon spin" />
          )}
        </div>
      </div>
    </>
  );
}
