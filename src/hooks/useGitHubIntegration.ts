/**
 * Custom hook to manage GitHub integration state
 */

import { useState, useCallback, useEffect } from 'react';
import {
  GitHubDomain,
  GitHubMetadata,
  GitHubAction,
} from '../components/integrations/github/types';
import { getDefaultDomain } from '../components/integrations/github/githubDomains.config';
import {
  initPatStorage,
  getPat,
  storePat,
  hasPatForDomain,
  clearPatIfNotPersisted,
} from '../components/integrations/github/patStorage';
import { GitHubApiClient, GitHubApiError, parseIssueUrl } from '../components/integrations/github/githubApi';
import { ThreatModel, ControlStatus } from '../types/threatModel';

const DOMAIN_STORAGE_KEY = 'flowstate-github-domain';

export interface ControlSyncResult {
  ref: string;
  name: string;
  oldStatus?: ControlStatus;
  newStatus?: ControlStatus;
  statusLink?: string;
  synced: boolean;
  error?: string;
}

export interface SyncResult {
  fileConflict: boolean;
  fileUpdatedAt?: string;
  controlsSynced: ControlSyncResult[];
}

export interface UseGitHubIntegrationResult {
  // State
  domain: GitHubDomain;
  githubMetadata: GitHubMetadata | null;
  isPatModalOpen: boolean;
  isSettingsModalOpen: boolean;
  patModalAction: GitHubAction | null;
  patError: string | null;
  isValidatingPat: boolean;

  // Actions
  setDomain: (domain: GitHubDomain) => void;
  setGitHubMetadata: (metadata: GitHubMetadata | null) => void;
  openPatModal: (action: GitHubAction) => void;
  closePatModal: () => void;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
  submitPat: (token: string, persistInSession: boolean) => Promise<boolean>;
  getApiClient: () => GitHubApiClient | null;
  requirePat: (action: GitHubAction) => Promise<GitHubApiClient | null>;
  cleanupPat: () => void;
  commitFile: (
    content: string,
    commitMessage: string,
    branch?: string,
    sha?: string
  ) => Promise<GitHubMetadata>;
  syncWithRepository: (
    currentModel: ThreatModel
  ) => Promise<SyncResult>;
}

export function useGitHubIntegration(): UseGitHubIntegrationResult {
  // Initialize PAT storage on mount
  useEffect(() => {
    initPatStorage();
  }, []);

  // Load saved domain preference
  const [domain, setDomainState] = useState<GitHubDomain>(() => {
    const saved = localStorage.getItem(DOMAIN_STORAGE_KEY);
    return (saved as GitHubDomain) || getDefaultDomain();
  });

  const [githubMetadata, setGitHubMetadata] = useState<GitHubMetadata | null>(null);
  const [isPatModalOpen, setIsPatModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [patModalAction, setPatModalAction] = useState<GitHubAction | null>(null);
  const [patError, setPatError] = useState<string | null>(null);
  const [isValidatingPat, setIsValidatingPat] = useState(false);
  const [pendingPatResolve, setPendingPatResolve] = useState<((client: GitHubApiClient | null) => void) | null>(null);

  // Save domain preference
  const setDomain = useCallback((newDomain: GitHubDomain) => {
    setDomainState(newDomain);
    localStorage.setItem(DOMAIN_STORAGE_KEY, newDomain);
  }, []);

  const openPatModal = useCallback((action: GitHubAction) => {
    setPatModalAction(action);
    setPatError(null);
    setIsPatModalOpen(true);
  }, []);

  const closePatModal = useCallback(() => {
    setIsPatModalOpen(false);
    setPatModalAction(null);
    setPatError(null);
    // Resolve any pending promise with null
    if (pendingPatResolve) {
      pendingPatResolve(null);
      setPendingPatResolve(null);
    }
  }, [pendingPatResolve]);

  const openSettingsModal = useCallback(() => {
    setIsSettingsModalOpen(true);
  }, []);

  const closeSettingsModal = useCallback(() => {
    setIsSettingsModalOpen(false);
  }, []);

  const submitPat = useCallback(async (token: string, persistInSession: boolean): Promise<boolean> => {
    setIsValidatingPat(true);
    setPatError(null);

    try {
      const client = new GitHubApiClient(token, domain);
      const isValid = await client.validateToken();

      if (!isValid) {
        setPatError('Invalid token. Please check your PAT and try again.');
        setIsValidatingPat(false);
        return false;
      }

      // Store the PAT
      storePat(token, domain, persistInSession);
      
      // Resolve any pending promise with the client
      if (pendingPatResolve) {
        pendingPatResolve(client);
        setPendingPatResolve(null);
      }

      setIsPatModalOpen(false);
      setPatModalAction(null);
      setIsValidatingPat(false);
      return true;
    } catch (err) {
      const message = err instanceof GitHubApiError
        ? err.message
        : 'Failed to validate token. Please try again.';
      setPatError(message);
      setIsValidatingPat(false);
      return false;
    }
  }, [domain, pendingPatResolve]);

  const getApiClient = useCallback((): GitHubApiClient | null => {
    const token = getPat(domain);
    if (!token) return null;
    return new GitHubApiClient(token, domain);
  }, [domain]);

  /**
   * Require a PAT for an action. If no PAT is available, opens the PAT modal.
   * Returns a promise that resolves to the API client when PAT is available,
   * or null if the user cancels.
   */
  const requirePat = useCallback((action: GitHubAction): Promise<GitHubApiClient | null> => {
    // Check if we already have a valid PAT for this domain
    if (hasPatForDomain(domain)) {
      const client = getApiClient();
      if (client) {
        return Promise.resolve(client);
      }
    }

    // Need to prompt for PAT
    return new Promise((resolve) => {
      setPendingPatResolve(() => resolve);
      openPatModal(action);
    });
  }, [domain, getApiClient, openPatModal]);

  /**
   * Clean up the PAT after a GitHub action completes
   * Only clears the PAT if it was not configured to persist in session
   */
  const cleanupPat = useCallback(() => {
    clearPatIfNotPersisted();
  }, []);

  /**
   * Commit a threat model file to GitHub
   * Requires metadata to be set or branch to be provided
   */
  const commitFile = useCallback(
    async (
      content: string,
      commitMessage: string,
      branch?: string,
      sha?: string
    ): Promise<GitHubMetadata> => {
      if (!githubMetadata) {
        throw new Error('No GitHub metadata available. Cannot determine where to commit.');
      }

      // Try to get existing API client first, only prompt if needed
      let client = getApiClient();
      if (!client) {
        // No existing PAT, need to prompt
        client = await requirePat('commit');
        if (!client) {
          throw new Error('GitHub authentication required');
        }
      }

      try {
        // Use provided branch or default to metadata branch
        const targetBranch = branch || githubMetadata.branch;
        const targetSha = sha || githubMetadata.sha;

        // Commit the file
        const response = await client.createOrUpdateFile(
          githubMetadata.owner,
          githubMetadata.repository,
          githubMetadata.path,
          content,
          commitMessage,
          targetBranch,
          targetSha
        );

        // Create updated metadata with new SHA and timestamp
        const updatedMetadata: GitHubMetadata = {
          ...githubMetadata,
          branch: targetBranch,
          sha: response.content.sha,
          loadedAt: Date.now(),
        };

        // Update the metadata state
        setGitHubMetadata(updatedMetadata);

        // Clean up PAT if not persisted
        cleanupPat();

        return updatedMetadata;
      } catch (error) {
        // Don't clean up PAT on error - user might want to retry
        if (error instanceof GitHubApiError) {
          throw new Error(`Failed to commit: ${error.message}`);
        }
        throw error;
      }
    },
    [githubMetadata, getApiClient, requirePat, cleanupPat, setGitHubMetadata]
  );

  /**
   * Sync with GitHub repository:
   * 1. Check if file has been updated remotely (conflict detection)
   * 2. Sync status_links with GitHub issues
   */
  const syncWithRepository = useCallback(
    async (currentModel: ThreatModel): Promise<SyncResult> => {
      if (!githubMetadata) {
        throw new Error('No GitHub metadata available. Cannot sync.');
      }

      // Try to get existing API client first, only prompt if needed
      let client = getApiClient();
      if (!client) {
        client = await requirePat('sync');
        if (!client) {
          throw new Error('GitHub authentication required');
        }
      }

      const result: SyncResult = {
        fileConflict: false,
        controlsSynced: [],
      };

      try {
        // Check if file has been updated remotely
        const { sha: currentSha } = await client.getFileContent(
          githubMetadata.owner,
          githubMetadata.repository,
          githubMetadata.path,
          githubMetadata.branch
        );

        if (currentSha !== githubMetadata.sha) {
          // File has been updated remotely
          result.fileConflict = true;
          
          // Get the actual commit date for this file
          try {
            const commits = await client.getFileCommits(
              githubMetadata.owner,
              githubMetadata.repository,
              githubMetadata.path,
              githubMetadata.branch,
              1 // Get only the most recent commit
            );
            
            if (commits.length > 0 && commits[0].commit.author.date) {
              result.fileUpdatedAt = commits[0].commit.author.date;
            } else {
              // Fallback to current time if we can't get commit date
              result.fileUpdatedAt = new Date().toISOString();
            }
          } catch (error) {
            // If fetching commits fails, use current time as fallback
            console.warn('Failed to fetch commit date:', error);
            result.fileUpdatedAt = new Date().toISOString();
          }
        }

        // Sync status_links with GitHub issues
        if (currentModel.controls && currentModel.controls.length > 0) {
          for (const control of currentModel.controls) {
            if (!control.status_link) continue;

            const syncResult: ControlSyncResult = {
              ref: control.ref,
              name: control.name,
              statusLink: control.status_link,
              oldStatus: control.status,
              synced: false,
            };

            try {
              // Parse the issue URL
              const issueInfo = parseIssueUrl(control.status_link);
              
              if (!issueInfo) {
                syncResult.error = 'Invalid issue URL format';
                result.controlsSynced.push(syncResult);
                continue;
              }

              // Only sync issues from the same domain, owner, and repo
              if (
                issueInfo.domain !== githubMetadata.domain ||
                issueInfo.owner !== githubMetadata.owner ||
                issueInfo.repo !== githubMetadata.repository
              ) {
                // Skip issues from other repositories
                continue;
              }

              // Fetch the issue status
              try {
                const issue = await client.getIssue(
                  issueInfo.owner,
                  issueInfo.repo,
                  issueInfo.number
                );

                // Map GitHub issue state to control status
                let newStatus: ControlStatus | undefined;
                if (issue.state === 'closed') {
                  // Check state_reason to distinguish between completed and not planned
                  if (issue.state_reason === 'not_planned') {
                    newStatus = 'Cancelled';
                  } else {
                    // Default to 'Done' for completed or unspecified reasons
                    newStatus = 'Done';
                  }
                } else if (issue.state === 'open') {
                  // Try to infer from labels
                  const labelNames = issue.labels.map(l => l.name.toLowerCase());
                  if (labelNames.includes('in progress') || labelNames.includes('in-progress')) {
                    newStatus = 'In Progress';
                  } else {
                    newStatus = 'To Do';
                  }
                }

                if (newStatus && newStatus !== control.status) {
                  syncResult.newStatus = newStatus;
                  syncResult.synced = true;
                } else {
                  syncResult.synced = true;
                  syncResult.newStatus = control.status;
                }
              } catch (error) {
                if (error instanceof GitHubApiError && error.status === 404) {
                  // Issue not found - should be removed
                  syncResult.error = 'Issue not found (404)';
                  syncResult.newStatus = undefined; // Signal to remove status_link
                } else {
                  syncResult.error = error instanceof Error ? error.message : 'Unknown error';
                }
              }
            } catch (error) {
              syncResult.error = error instanceof Error ? error.message : 'Failed to parse URL';
            }

            result.controlsSynced.push(syncResult);
          }
        }

        // Only clean up PAT if not persisted AND no file conflict
        // If there's a file conflict, user may need to load latest version
        if (!result.fileConflict) {
          cleanupPat();
        }

        return result;
      } catch (error) {
        // Don't clean up PAT on error - user might want to retry
        if (error instanceof GitHubApiError) {
          throw new Error(`Failed to sync: ${error.message}`);
        }
        throw error;
      }
    },
    [githubMetadata, getApiClient, requirePat, cleanupPat]
  );

  return {
    // State
    domain,
    githubMetadata,
    isPatModalOpen,
    isSettingsModalOpen,
    patModalAction,
    patError,
    isValidatingPat,

    // Actions
    setDomain,
    setGitHubMetadata,
    openPatModal,
    closePatModal,
    openSettingsModal,
    closeSettingsModal,
    submitPat,
    getApiClient,
    requirePat,
    cleanupPat,
    commitFile,
    syncWithRepository,
  };
}
