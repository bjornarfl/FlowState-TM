/**
 * Centralized application configuration.
 *
 * The base path is derived from Vite's `base` config, which is set via the
 * VITE_BASE_PATH environment variable (defaults to "/").
 *
 * Additional optional env vars:
 *   - VITE_REPO_URL: Repository URL for "Learn more" links
 */

/**
 * Base path for the application, always ends with "/".
 * Automatically set by Vite from the `base` config value.
 * Examples: "/" or "/FlowState-TM/"
 */
export const BASE_PATH: string = import.meta.env.BASE_URL;

/**
 * Full public URL of this deployment (no trailing slash).
 * Auto-detected from window.location at runtime.
 */
export function getAppUrl(): string {
  const base = BASE_PATH.length > 1 && BASE_PATH.endsWith('/')
    ? BASE_PATH.slice(0, -1)
    : BASE_PATH;
  return `${window.location.origin}${base === '/' ? '' : base}`;
}

/**
 * Repository URL for source / "Learn more" links.
 * Set via VITE_REPO_URL env var. Falls back to empty string if not set.
 */
export const REPO_URL: string = import.meta.env.VITE_REPO_URL || '';

/**
 * Basename for React Router (no trailing slash).
 * "/" stays as "/", "/FlowState-TM/" becomes "/FlowState-TM".
 */
export const ROUTER_BASENAME: string =
  BASE_PATH.length > 1 && BASE_PATH.endsWith('/')
    ? BASE_PATH.slice(0, -1)
    : BASE_PATH;

/**
 * Resolve a path relative to the base path for fetch() calls to public/ files.
 * Handles both leading-slash and no-leading-slash inputs.
 *
 * @example resolvePath('templates/simple.yaml')    → '/FlowState-TM/templates/simple.yaml'
 * @example resolvePath('/tutorials/index.json')     → '/FlowState-TM/tutorials/index.json'
 * @example resolvePath('empty.yaml')                → '/FlowState-TM/empty.yaml'
 */
export function resolvePath(path: string): string {
  const base = BASE_PATH.endsWith('/') ? BASE_PATH : BASE_PATH + '/';
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${base}${cleanPath}`;
}
