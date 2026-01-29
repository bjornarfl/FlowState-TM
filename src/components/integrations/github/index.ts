/**
 * GitHub Integration Module - Public Exports
 */

// Types
export type {
  GitHubDomain,
  GitHubMetadata,
  PatConfig,
  GitHubUser,
  GitHubOrganization,
  GitHubRepository,
  GitHubBranch,
  GitHubContent,
  GitHubCommitResponse,
  GitHubIssue,
  GitHubCreateIssueRequest,
  GitHubError,
  GitHubAction,
} from './types';

export {
  API_BASE_URLS,
  ACTION_DESCRIPTIONS,
  ACTION_REQUIRED_SCOPES,
} from './types';

// PAT Storage
export {
  initPatStorage,
  resetInactivityTimer,
  getPatConfig,
  getPat,
  hasPat,
  hasPatForDomain,
  storePat,
  clearPat,
  touchPat,
  getPatDomain,
  isPatPersisted,
  clearPatIfNotPersisted,
} from './patStorage';

// API Client
export { GitHubApiClient, GitHubApiError, parseIssueUrl, buildIssueUrl } from './githubApi';
