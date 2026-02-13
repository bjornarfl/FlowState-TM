/**
 * GitHub Integration Types
 */

import type { GitHubDomain } from './githubDomains.config';

// Re-export types and constants from config
export type { GitHubDomain };

/**
 * Metadata stored alongside threat model YAML to track GitHub source
 */
export interface GitHubMetadata {
  domain: GitHubDomain;
  owner: string;
  repository: string;
  branch: string;
  path: string;
  sha: string; // File SHA for conflict detection
  loadedAt: number; // Timestamp when loaded from GitHub
}

/**
 * PAT storage configuration
 */
export interface PatConfig {
  token: string;
  domain: GitHubDomain;
  storedAt: number;
  persistInSession: boolean;
}

/**
 * GitHub API response types
 */

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string | null;
}

export interface GitHubOrganization {
  login: string;
  id: number;
  description: string | null;
  avatar_url: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  default_branch: string;
  owner: {
    login: string;
    type: string;
  };
}

export interface GitHubSearchRepositoriesResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubRepository[];
}

export interface PaginationInfo {
  hasNext: boolean;
  hasPrev: boolean;
  nextPage?: number;
  prevPage?: number;
  lastPage?: number;
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
  };
  protected: boolean;
}

export interface GitHubContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  content?: string; // Base64 encoded, only present when fetching a file
  encoding?: string;
  download_url: string | null;
}

export interface GitHubCommitResponse {
  content: GitHubContent;
  commit: {
    sha: string;
    message: string;
    html_url: string;
  };
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  state_reason?: 'completed' | 'reopened' | 'not_planned' | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  labels: Array<{
    name: string;
    color: string;
  }>;
}

export interface GitHubCreateIssueRequest {
  title: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
}

export interface GitHubError {
  message: string;
  documentation_url?: string;
  errors?: Array<{
    resource: string;
    field: string;
    code: string;
  }>;
}

/**
 * Action types for PAT modal context
 */
export type GitHubAction =
  | 'load' // Loading threat model from repo
  | 'commit' // Committing changes
  | 'create-issue' // Creating GitHub issue
  | 'sync'; // Syncing with remote

export const ACTION_DESCRIPTIONS: Record<GitHubAction, string> = {
  load: 'Load a threat model from GitHub',
  commit: 'Commit changes to GitHub',
  'create-issue': 'Create a GitHub issue',
  sync: 'Sync with GitHub repository',
};

export const ACTION_REQUIRED_SCOPES: Record<GitHubAction, string[]> = {
  load: ['Contents (Read)'],
  commit: ['Contents (Read & Write)'],
  'create-issue': ['Issues (Write)'],
  sync: ['Contents (Read)', 'Issues (Read)'],
};

/**
 * Required classic PAT scopes per action.
 * Each entry is an array of scope groups (OR logic within a group).
 */
export const CLASSIC_REQUIRED_SCOPES: Record<GitHubAction, string[][]> = {
  load: [['repo', 'public_repo']],
  commit: [['repo']],
  'create-issue': [['repo']],
  sync: [['repo']],
};

/**
 * Result of validating a PAT's permissions for a specific action
 */
export interface TokenValidationResult {
  valid: boolean;
  user?: GitHubUser;
  missingPermissions: string[];
  tokenType: 'classic' | 'fine-grained' | 'unknown';
}

/**
 * Git Data API types - for multi-file atomic commits
 */

export interface GitRef {
  ref: string;
  node_id: string;
  url: string;
  object: {
    sha: string;
    type: string;
    url: string;
  };
}

export interface GitCommit {
  sha: string;
  tree: {
    sha: string;
    url: string;
  };
  message: string;
  parents: Array<{
    sha: string;
    url: string;
  }>;
  html_url?: string;
}

export interface GitBlob {
  sha: string;
  url: string;
}

export interface GitTreeItem {
  path: string;
  mode: '100644' | '100755' | '040000' | '160000' | '120000';
  type: 'blob' | 'tree' | 'commit';
  sha?: string;
  content?: string;
}

export interface GitTree {
  sha: string;
  url: string;
  tree: GitTreeItem[];
}

/**
 * File to include in a multi-file commit
 */
export interface CommitFile {
  path: string;
  content: string;
  /** Whether content is base64-encoded (e.g. for binary files like PNG) */
  isBase64?: boolean;
}

/**
 * Options for additional files to include in a GitHub commit
 */
export interface CommitExtraFilesOptions {
  includeDiagramImage: boolean;
  includeMarkdownFile: boolean;
}
