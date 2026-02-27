/**
 * PAT (Personal Access Token) Storage Utilities
 *
 * Manages GitHub PAT storage in sessionStorage with:
 * - Optional persistence (default: single use)
 * - 1-hour inactivity timeout
 * - Automatic cleanup on beforeunload
 */

import { PatConfig, GitHubDomain } from '../types';

const PAT_STORAGE_KEY = 'flowstate-github-pat';
const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
let isInitialized = false;

/**
 * Initialize PAT storage - sets up beforeunload handler
 * Should be called once when the app starts
 */
export function initPatStorage(): void {
  if (isInitialized) return;

  // Clean up PAT on browser/tab close
  window.addEventListener('beforeunload', () => {
    clearPat();
  });

  // Start inactivity timer if PAT exists
  const existingPat = getPatConfig();
  if (existingPat) {
    resetInactivityTimer();
  }

  isInitialized = true;
}

/**
 * Reset the inactivity timer
 * Should be called after any GitHub API activity
 */
export function resetInactivityTimer(): void {
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
  }

  inactivityTimer = setTimeout(() => {
    console.log('[PAT Storage] Clearing PAT due to inactivity');
    clearPat();
  }, INACTIVITY_TIMEOUT_MS);
}

/**
 * Get the stored PAT configuration
 */
export function getPatConfig(): PatConfig | null {
  try {
    const stored = sessionStorage.getItem(PAT_STORAGE_KEY);
    if (!stored) return null;

    const config: PatConfig = JSON.parse(stored);

    // Check if PAT has expired due to inactivity
    const timeSinceStored = Date.now() - config.storedAt;
    if (timeSinceStored > INACTIVITY_TIMEOUT_MS) {
      clearPat();
      return null;
    }

    return config;
  } catch (error) {
    console.error('[PAT Storage] Error reading PAT config:', error);
    return null;
  }
}

/**
 * Get the PAT token for a specific domain
 */
export function getPat(domain: GitHubDomain): string | null {
  const config = getPatConfig();
  if (!config || config.domain !== domain) return null;
  return config.token;
}

/**
 * Check if a PAT is stored for any domain
 */
export function hasPat(): boolean {
  return getPatConfig() !== null;
}

/**
 * Check if a PAT is stored for a specific domain
 */
export function hasPatForDomain(domain: GitHubDomain): boolean {
  const config = getPatConfig();
  return config !== null && config.domain === domain;
}

/**
 * Store a PAT
 * @param token The PAT token
 * @param domain The GitHub domain this PAT is for
 * @param persistInSession Whether to keep the PAT in sessionStorage across page reloads (default: true)
 */
export function storePat(
  token: string,
  domain: GitHubDomain,
  persistInSession: boolean = true
): void {
  const config: PatConfig = {
    token,
    domain,
    storedAt: Date.now(),
    persistInSession,
  };

  // Always store in sessionStorage so it's available for the current session
  try {
    sessionStorage.setItem(PAT_STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('[PAT Storage] Error storing PAT:', error);
  }

  // Always reset the inactivity timer when storing
  resetInactivityTimer();
}

/**
 * Clear the stored PAT
 */
export function clearPat(): void {
  try {
    sessionStorage.removeItem(PAT_STORAGE_KEY);
  } catch (error) {
    console.error('[PAT Storage] Error clearing PAT:', error);
  }

  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
}

/**
 * Update the stored timestamp to extend the inactivity timeout
 * Should be called after successful GitHub API calls
 */
export function touchPat(): void {
  const config = getPatConfig();
  if (config && config.persistInSession) {
    config.storedAt = Date.now();
    try {
      sessionStorage.setItem(PAT_STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      console.error('[PAT Storage] Error updating PAT timestamp:', error);
    }
  }
  resetInactivityTimer();
}

/**
 * Get the current domain for the stored PAT
 */
export function getPatDomain(): GitHubDomain | null {
  const config = getPatConfig();
  return config?.domain ?? null;
}

/**
 * Check if PAT is configured to persist in session
 */
export function isPatPersisted(): boolean {
  const config = getPatConfig();
  return config?.persistInSession ?? false;
}

/**
 * Clear the PAT if it's not configured to persist in session
 * This should be called after completing a GitHub action to clean up temporary PATs
 */
export function clearPatIfNotPersisted(): void {
  const config = getPatConfig();
  if (config && !config.persistInSession) {
    clearPat();
    console.log('[PAT Storage] Cleared temporary PAT');
  }
}
