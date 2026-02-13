/**
 * GitHub Domains Configuration
 * 
 * To add support for your enterprise GitHub instance:
 * 1. Add a new entry to the GITHUB_DOMAINS array below
 * 2. Specify the domain (e.g., 'github.example.com')
 * 3. Provide the API base URL (typically 'https://api.{domain}' or 'https://{domain}/api/v3')
 * 4. Add a display name for the UI
 * 5. Set whether it's the default domain (only one should be true)
 * 6. Update connect-src in Content Security Policy in index.html to include the API base URL
 */

export interface GitHubDomainConfig {
  /** The domain name (e.g., 'github.com' or 'github.enterprise.com') */
  domain: string;
  /** The API base URL for this GitHub instance */
  apiBaseUrl: string;
  /** Display name shown in the UI */
  displayName: string;
  /** Whether this is an enterprise instance (affects UI labels) */
  isEnterprise: boolean;
  /** Whether this should be the default selection */
  isDefault: boolean;
}

/**
 * Configured GitHub domains
 * 
 * By default, only github.com is configured.
 * Add your enterprise GitHub instances here.
 * Remember to aslo update connect-src in Content Security Policy in index.html to include the API base URL
 */
export const GITHUB_DOMAINS: readonly GitHubDomainConfig[] = [
  {
    domain: 'github.com',
    apiBaseUrl: 'https://api.github.com',
    displayName: 'GitHub.com',
    isEnterprise: false,
    isDefault: true,
  },
  // Add your enterprise GitHub instances here:
  // {
  //   domain: 'github.yourcompany.com',
  //   apiBaseUrl: 'https://github.yourcompany.com/api/v3', OR 'https://api.yourcompany.ghe.com',
  //   displayName: 'Your Company GitHub',
  //   isEnterprise: true,
  //   isDefault: false,
  // },
] as const;

// ============================================================
// Derived values and helper functions
// ============================================================

/**
 * Union type of all configured domain strings
 */
export type GitHubDomain = (typeof GITHUB_DOMAINS)[number]['domain'];

/**
 * Map of domain to API base URL
 */
export const API_BASE_URLS = Object.fromEntries(
  GITHUB_DOMAINS.map((config) => [config.domain, config.apiBaseUrl])
) as Record<GitHubDomain, string>;

/**
 * Get the default domain
 */
export function getDefaultDomain(): GitHubDomain {
  const defaultDomain = GITHUB_DOMAINS.find((d) => d.isDefault);
  if (!defaultDomain) {
    throw new Error('No default GitHub domain configured');
  }
  return defaultDomain.domain;
}

/**
 * Get domain configuration by domain string
 */
export function getDomainConfig(domain: string): GitHubDomainConfig | undefined {
  return GITHUB_DOMAINS.find((d) => d.domain === domain);
}

/**
 * Check if a domain string is valid
 */
export function isValidDomain(domain: string): domain is GitHubDomain {
  return GITHUB_DOMAINS.some((d) => d.domain === domain);
}

/**
 * Build a regex pattern to match any configured domain in URLs
 * Returns a pattern with proper escaping for use in hostname matching
 */
export function buildDomainRegexPattern(): string {
  // Escape dots and wrap in non-capturing group for safe URL matching
  return GITHUB_DOMAINS.map((d) => {
    // Escape special regex characters in domain
    const escapedDomain = d.domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escapedDomain;
  }).join('|');
}
