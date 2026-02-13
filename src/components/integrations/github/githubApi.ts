/**
 * GitHub API Client
 *
 * Multi-domain support for all configured GitHub instances
 */

import type {
  GitHubUser,
  GitHubOrganization,
  GitHubRepository,
  GitHubBranch,
  GitHubContent,
  GitHubCommitResponse,
  GitHubIssue,
  GitHubCreateIssueRequest,
  GitHubError,
  PaginationInfo,
  GitRef,
  GitCommit,
  GitBlob,
  GitTree,
  GitTreeItem,
  CommitFile,
  GitHubAction,
  TokenValidationResult,
} from './types';
import { CLASSIC_REQUIRED_SCOPES } from './types';
import type { GitHubDomain } from './githubDomains.config';
import { API_BASE_URLS, buildDomainRegexPattern, isValidDomain } from './githubDomains.config';
import { touchPat } from './patStorage';

export class GitHubApiError extends Error {
  status: number;
  githubError?: GitHubError;

  constructor(message: string, status: number, githubError?: GitHubError) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
    this.githubError = githubError;
  }
}

/**
 * Parse Link header from GitHub API response to extract pagination info
 */
function parseLinkHeader(linkHeader: string | null): PaginationInfo {
  const info: PaginationInfo = {
    hasNext: false,
    hasPrev: false,
  };

  if (!linkHeader) {
    return info;
  }

  // Link header format: <url>; rel="next", <url>; rel="last", ...
  const links = linkHeader.split(',').map(link => link.trim());

  for (const link of links) {
    const match = link.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (!match) continue;

    const [, url, rel] = match;
    const urlObj = new URL(url);
    const page = urlObj.searchParams.get('page');
    const pageNum = page ? parseInt(page, 10) : undefined;

    switch (rel) {
      case 'next':
        info.hasNext = true;
        info.nextPage = pageNum;
        break;
      case 'prev':
        info.hasPrev = true;
        info.prevPage = pageNum;
        break;
      case 'last':
        info.lastPage = pageNum;
        break;
    }
  }

  return info;
}

/**
 * GitHub API Client class
 */
export class GitHubApiClient {
  private token: string;
  private domain: GitHubDomain;
  private baseUrl: string;

  constructor(token: string, domain: GitHubDomain) {
    this.token = token;
    this.domain = domain;
    
    const baseUrl = API_BASE_URLS[domain];
    if (!baseUrl) {
      throw new Error(
        `No API base URL configured for domain: ${domain}. ` +
        `Please check githubDomains.config.ts`
      );
    }
    this.baseUrl = baseUrl;
  }

  /**
   * Make an authenticated API request
   */
  private async request<T>(
    endpoint: string,
    options: {
      method?: string;
      body?: string;
      headers?: Record<string, string>;
    } = {}
  ): Promise<T> {
    const response = await this.requestWithHeaders<T>(endpoint, options);
    return response.data;
  }

  /**
   * Make an authenticated API request and return both data and headers
   */
  private async requestWithHeaders<T>(
    endpoint: string,
    options: {
      method?: string;
      body?: string;
      headers?: Record<string, string>;
    } = {}
  ): Promise<{ data: T; headers: Headers; pagination?: PaginationInfo }> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    };

    if (options.body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Touch PAT on any successful communication (even 4xx)
    touchPat();

    if (!response.ok) {
      let githubError: GitHubError | undefined;
      try {
        githubError = await response.json();
      } catch {
        // Response body might not be JSON
      }

      const message =
        githubError?.message || `GitHub API error: ${response.status}`;
      throw new GitHubApiError(message, response.status, githubError);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {
        data: {} as T,
        headers: response.headers,
      };
    }

    const data = await response.json();
    const linkHeader = response.headers.get('Link');
    const pagination = parseLinkHeader(linkHeader);

    return {
      data,
      headers: response.headers,
      pagination,
    };
  }

  /**
   * Get the current domain
   */
  getDomain(): GitHubDomain {
    return this.domain;
  }

  // ============================================================
  // User & Organization endpoints
  // ============================================================

  /**
   * Get the authenticated user
   */
  async getUser(): Promise<GitHubUser> {
    return this.request<GitHubUser>('/user');
  }

  /**
   * List organizations for the authenticated user
   */
  async listOrganizations(): Promise<GitHubOrganization[]> {
    return this.request<GitHubOrganization[]>('/user/orgs');
  }

  // ============================================================
  // Repository endpoints
  // ============================================================

  /**
   * List all repositories accessible to the authenticated user
   * This includes repos from orgs where you're not a member but have repo access
   */
  async listAccessibleRepositories(): Promise<GitHubRepository[]> {
    return this.request<GitHubRepository[]>(
      '/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member'
    );
  }

  /**
   * List accessible repositories with pagination support
   * @param page - Page number (default: 1)
   * @returns Array of repositories for the requested page
   */
  async listAccessibleRepositoriesPage(page: number = 1): Promise<GitHubRepository[]> {
    return this.request<GitHubRepository[]>(
      `/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`
    );
  }

  /**
   * List repositories for a user or organization
   */
  async listRepositories(
    owner: string,
    type: 'user' | 'org' = 'org'
  ): Promise<GitHubRepository[]> {
    const endpoint =
      type === 'org' ? `/orgs/${owner}/repos` : `/users/${owner}/repos`;

    return this.request<GitHubRepository[]>(
      `${endpoint}?per_page=100&sort=updated`
    );
  }

  /**
   * Get a specific repository
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    return this.request<GitHubRepository>(`/repos/${owner}/${repo}`);
  }

  // ============================================================
  // Branch endpoints
  // ============================================================

  /**
   * List branches for a repository
   */
  async listBranches(owner: string, repo: string): Promise<GitHubBranch[]> {
    return this.request<GitHubBranch[]>(
      `/repos/${owner}/${repo}/branches?per_page=100`
    );
  }

  /**
   * Get a specific branch
   */
  async getBranch(
    owner: string,
    repo: string,
    branch: string
  ): Promise<GitHubBranch> {
    return this.request<GitHubBranch>(
      `/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`
    );
  }

  // ============================================================
  // Content endpoints
  // ============================================================

  /**
   * Get contents of a directory or file
   */
  async getContents(
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<GitHubContent | GitHubContent[]> {
    // Encode each path segment to handle special characters
    const encodedPath = path
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    const params = ref ? `?ref=${encodeURIComponent(ref)}` : '';
    return this.request<GitHubContent | GitHubContent[]>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}${params}`
    );
  }

  /**
   * Get a file's content decoded from base64
   */
  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<{ content: string; sha: string }> {
    const result = await this.getContents(owner, repo, path, ref);

    if (Array.isArray(result)) {
      throw new GitHubApiError('Path is a directory, not a file', 400);
    }

    if (result.type !== 'file' || !result.content) {
      throw new GitHubApiError('Path is not a file or has no content', 400);
    }

    // Decode base64 content - handle UTF-8 properly
    const base64Content = result.content.replace(/\n/g, '');
    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const content = new TextDecoder('utf-8').decode(bytes);
    
    return { content, sha: result.sha };
  }

  /**
   * List threat model files in /.threat-models directory (including subfolders)
   */
  async listThreatModels(
    owner: string,
    repo: string,
    ref?: string
  ): Promise<GitHubContent[]> {
    try {
      return await this.listThreatModelsRecursive(owner, repo, '.threat-models', ref);
    } catch (error) {
      if (error instanceof GitHubApiError && error.status === 404) {
        // Directory doesn't exist
        return [];
      }
      throw error;
    }
  }

  /**
   * Recursively list YAML files in a directory and its subdirectories
   */
  private async listThreatModelsRecursive(
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<GitHubContent[]> {
    const contents = await this.getContents(owner, repo, path, ref);

    if (!Array.isArray(contents)) {
      return [];
    }

    const files: GitHubContent[] = [];

    // Collect subdirectories to recurse into
    const subdirs = contents.filter((item) => item.type === 'dir');

    // Collect YAML files at this level
    for (const item of contents) {
      if (
        item.type === 'file' &&
        (item.name.endsWith('.yaml') || item.name.endsWith('.yml'))
      ) {
        files.push(item);
      }
    }

    // Recurse into subdirectories in parallel
    const subResults = await Promise.all(
      subdirs.map((dir) =>
        this.listThreatModelsRecursive(owner, repo, dir.path, ref)
      )
    );

    for (const result of subResults) {
      files.push(...result);
    }

    return files;
  }

  /**
   * Create or update a file
   */
  async createOrUpdateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    branch: string,
    sha?: string // Required when updating existing file
  ): Promise<GitHubCommitResponse> {
    // Encode content to base64
    const encodedContent = btoa(unescape(encodeURIComponent(content)));

    const body: Record<string, string> = {
      message,
      content: encodedContent,
      branch,
    };

    if (sha) {
      body.sha = sha;
    }

    return this.request<GitHubCommitResponse>(
      `/repos/${owner}/${repo}/contents/${path}`,
      {
        method: 'PUT',
        body: JSON.stringify(body),
      }
    );
  }

  // ============================================================
  // Issue endpoints
  // ============================================================

  /**
   * Get an issue by number
   */
  async getIssue(
    owner: string,
    repo: string,
    issueNumber: number
  ): Promise<GitHubIssue> {
    return this.request<GitHubIssue>(
      `/repos/${owner}/${repo}/issues/${issueNumber}`
    );
  }

  /**
   * Create an issue
   */
  async createIssue(
    owner: string,
    repo: string,
    issue: GitHubCreateIssueRequest
  ): Promise<GitHubIssue> {
    return this.request<GitHubIssue>(`/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      body: JSON.stringify(issue),
    });
  }

  // ============================================================
  // Git Data API endpoints (for multi-file atomic commits)
  // ============================================================

  /**
   * Get a git reference (branch/tag)
   */
  async getRef(
    owner: string,
    repo: string,
    ref: string
  ): Promise<GitRef> {
    return this.request<GitRef>(
      `/repos/${owner}/${repo}/git/ref/${ref}`
    );
  }

  /**
   * Get a git commit by SHA
   */
  async getGitCommit(
    owner: string,
    repo: string,
    sha: string
  ): Promise<GitCommit> {
    return this.request<GitCommit>(
      `/repos/${owner}/${repo}/git/commits/${sha}`
    );
  }

  /**
   * Create a blob (for binary or large content)
   */
  async createBlob(
    owner: string,
    repo: string,
    content: string,
    encoding: 'utf-8' | 'base64' = 'utf-8'
  ): Promise<GitBlob> {
    return this.request<GitBlob>(
      `/repos/${owner}/${repo}/git/blobs`,
      {
        method: 'POST',
        body: JSON.stringify({ content, encoding }),
      }
    );
  }

  /**
   * Create a new tree
   */
  async createTree(
    owner: string,
    repo: string,
    tree: GitTreeItem[],
    baseTree?: string
  ): Promise<GitTree> {
    const body: Record<string, unknown> = { tree };
    if (baseTree) {
      body.base_tree = baseTree;
    }
    return this.request<GitTree>(
      `/repos/${owner}/${repo}/git/trees`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );
  }

  /**
   * Create a new commit
   */
  async createGitCommit(
    owner: string,
    repo: string,
    message: string,
    tree: string,
    parents: string[]
  ): Promise<GitCommit> {
    return this.request<GitCommit>(
      `/repos/${owner}/${repo}/git/commits`,
      {
        method: 'POST',
        body: JSON.stringify({ message, tree, parents }),
      }
    );
  }

  /**
   * Update a git reference to point to a new commit
   */
  async updateRef(
    owner: string,
    repo: string,
    ref: string,
    sha: string,
    force: boolean = false
  ): Promise<GitRef> {
    return this.request<GitRef>(
      `/repos/${owner}/${repo}/git/refs/${ref}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ sha, force }),
      }
    );
  }

  /**
   * Create an atomic commit with multiple files.
   * Uses the Git Data API to bundle all files into a single commit.
   *
   * Flow:
   * 1. Get the branch ref → base commit SHA
   * 2. Get the base commit → base tree SHA
   * 3. Create blobs for binary files (base64 content)
   * 4. Create a new tree with all files
   * 5. Create a new commit pointing to the new tree
   * 6. Update the branch ref to the new commit
   */
  async createMultiFileCommit(
    owner: string,
    repo: string,
    branch: string,
    message: string,
    files: CommitFile[]
  ): Promise<{ commitSha: string; commitUrl: string }> {
    // 1. Get the branch reference
    const ref = await this.getRef(owner, repo, `heads/${branch}`);
    const baseCommitSha = ref.object.sha;

    // 2. Get the base commit to find its tree
    const baseCommit = await this.getGitCommit(owner, repo, baseCommitSha);
    const baseTreeSha = baseCommit.tree.sha;

    // 3. Build tree items — create blobs for binary (base64) content
    const treeItems: GitTreeItem[] = [];
    for (const file of files) {
      if (file.isBase64) {
        // Binary content: create a blob first, then reference it by SHA
        const blob = await this.createBlob(owner, repo, file.content, 'base64');
        treeItems.push({
          path: file.path,
          mode: '100644',
          type: 'blob',
          sha: blob.sha,
        });
      } else {
        // Text content: can be inlined via content property
        treeItems.push({
          path: file.path,
          mode: '100644',
          type: 'blob',
          content: file.content,
        });
      }
    }

    // 4. Create a new tree based on the existing tree
    const newTree = await this.createTree(owner, repo, treeItems, baseTreeSha);

    // 5. Create a new commit
    const newCommit = await this.createGitCommit(
      owner, repo, message, newTree.sha, [baseCommitSha]
    );

    // 6. Update the branch reference
    await this.updateRef(owner, repo, `heads/${branch}`, newCommit.sha);

    return {
      commitSha: newCommit.sha,
      commitUrl: newCommit.html_url || `https://${this.domain}/${owner}/${repo}/commit/${newCommit.sha}`,
    };
  }

  // ============================================================
  // Utility methods
  // ============================================================

  /**
   * Test if the PAT is valid by making a simple API call
   */
  async validateToken(): Promise<boolean> {
    try {
      await this.getUser();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate token and verify it has the required permissions for a given action.
   *
   * For classic PATs: checks the X-OAuth-Scopes response header.
   * For fine-grained PATs: performs targeted test API calls to verify permissions.
   */
  async validateTokenForAction(action: GitHubAction): Promise<TokenValidationResult> {
    try {
      // Step 1: Call /user and capture response headers
      const { data: user, headers } = await this.requestWithHeaders<GitHubUser>('/user');

      const oauthScopes = headers.get('X-OAuth-Scopes');

      if (oauthScopes !== null) {
        // Classic PAT — scopes are listed in the header
        return this.validateClassicTokenScopes(action, user, oauthScopes);
      } else {
        // Fine-grained PAT (or GitHub App token) — no scopes header
        return this.validateFineGrainedTokenPermissions(action, user);
      }
    } catch (err) {
      if (err instanceof GitHubApiError && err.status === 401) {
        return {
          valid: false,
          missingPermissions: ['Valid authentication — token may be expired or revoked'],
          tokenType: 'unknown',
        };
      }
      throw err;
    }
  }

  /**
   * Check classic PAT scopes from the X-OAuth-Scopes header
   */
  private validateClassicTokenScopes(
    action: GitHubAction,
    user: GitHubUser,
    oauthScopesHeader: string
  ): TokenValidationResult {
    const grantedScopes = oauthScopesHeader
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const requirements = CLASSIC_REQUIRED_SCOPES[action];
    const missing: string[] = [];

    for (const acceptableScopes of requirements) {
      // At least one of the acceptable scopes must be present
      const hasSome = acceptableScopes.some((scope) => grantedScopes.includes(scope));
      if (!hasSome) {
        missing.push(acceptableScopes.join(' or '));
      }
    }

    return {
      valid: missing.length === 0,
      user,
      missingPermissions: missing.length > 0
        ? missing.map((m) => `Missing scope: ${m}`)
        : [],
      tokenType: 'classic',
    };
  }

  /**
   * Verify fine-grained PAT permissions by making targeted test API calls.
   * Fine-grained tokens don't expose scopes via headers, so we probe endpoints.
   */
  private async validateFineGrainedTokenPermissions(
    action: GitHubAction,
    user: GitHubUser
  ): Promise<TokenValidationResult> {
    const missing: string[] = [];

    // Determine which permissions need testing based on the action
    const needsContentsRead = ['load', 'commit', 'sync'].includes(action);
    const needsContentsWrite = action === 'commit';
    const needsIssuesRead = action === 'sync';
    const needsIssuesWrite = action === 'create-issue';

    // Test Contents:Read by listing repos and then trying to list branches
    if (needsContentsRead || needsContentsWrite) {
      try {
        // First, check we can list repos at all (needs at least Metadata:Read)
        const repos = await this.request<GitHubRepository[]>(
          '/user/repos?per_page=1&sort=updated'
        );

        if (repos.length > 0) {
          // Try listing branches on the first repo — requires Contents:Read
          try {
            await this.request(
              `/repos/${repos[0].owner.login}/${repos[0].name}/branches?per_page=1`
            );
          } catch (err) {
            if (err instanceof GitHubApiError && (err.status === 403 || err.status === 404)) {
              missing.push('Contents (Read) — token cannot read repository contents');
            }
          }
        } else {
          // No repos accessible at all — token lacks repository permissions
          missing.push('Contents (Read) — token has no access to any repositories');
        }
      } catch (err) {
        if (err instanceof GitHubApiError && err.status === 403) {
          missing.push('Metadata (Read) — no repository access');
        } else {
          missing.push('Contents (Read) — could not verify repository access');
        }
      }
    }

    // We can't reliably pre-test write permissions or issue permissions
    // without side effects, so we just flag them as warnings if relevant
    if (needsContentsWrite && !missing.includes('Contents (Read)')) {
      // Can't test write without actually writing — skip, will fail at commit time
    }

    if (needsIssuesRead || needsIssuesWrite) {
      // Issues permissions are repo-specific and can't be tested globally.
      // We'll let it fail at call time with a clear error.
    }

    return {
      valid: missing.length === 0,
      user,
      missingPermissions: missing,
      tokenType: 'fine-grained',
    };
  }

  /**
   * Get commits for a specific file path
   * Returns the most recent commit
   */
  async getFileCommits(
    owner: string,
    repo: string,
    path: string,
    branch?: string,
    perPage: number = 1
  ): Promise<Array<{
    sha: string;
    commit: {
      author: {
        name: string;
        email: string;
        date: string;
      };
      message: string;
    };
  }>> {
    const params = new URLSearchParams({
      path,
      per_page: perPage.toString(),
    });
    if (branch) {
      params.append('sha', branch);
    }
    
    return this.request(
      `/repos/${owner}/${repo}/commits?${params.toString()}`
    );
  }

  /**
   * Get the current SHA of a file (for conflict detection)
   */
  async getFileSha(
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<string | null> {
    try {
      const contents = await this.getContents(owner, repo, path, ref);
      if (Array.isArray(contents)) return null;
      return contents.sha;
    } catch (error) {
      if (error instanceof GitHubApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }
}

/**
 * Parse issue URL to extract owner, repo, and issue number
 * Supports all configured GitHub domains
 */
export function parseIssueUrl(
  url: string
): { domain: GitHubDomain; owner: string; repo: string; number: number } | null {
  // Build regex pattern from configured domains
  const domainPattern = buildDomainRegexPattern();
  const regex = new RegExp(
    `https:\\/\\/(${domainPattern})\\/([^/]+)\\/([^/]+)\\/issues\\/(\\d+)`
  );
  
  const match = url.match(regex);
  if (!match) return null;

  const domain = match[1];
  if (!isValidDomain(domain)) return null;

  return {
    domain,
    owner: match[2],
    repo: match[3],
    number: parseInt(match[4], 10),
  };
}

/**
 * Build issue URL from components
 */
export function buildIssueUrl(
  domain: GitHubDomain,
  owner: string,
  repo: string,
  issueNumber: number
): string {
  return `https://${domain}/${owner}/${repo}/issues/${issueNumber}`;
}
