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
} from './types';
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
   * List threat model files in /.threat-models directory
   */
  async listThreatModels(
    owner: string,
    repo: string,
    ref?: string
  ): Promise<GitHubContent[]> {
    try {
      const contents = await this.getContents(
        owner,
        repo,
        '.threat-models',
        ref
      );

      if (!Array.isArray(contents)) {
        return [];
      }

      // Filter for YAML files only
      return contents.filter(
        (item) =>
          item.type === 'file' &&
          (item.name.endsWith('.yaml') || item.name.endsWith('.yml'))
      );
    } catch (error) {
      if (error instanceof GitHubApiError && error.status === 404) {
        // Directory doesn't exist
        return [];
      }
      throw error;
    }
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
