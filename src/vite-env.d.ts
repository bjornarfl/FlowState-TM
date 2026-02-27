/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base path for the application (set via VITE_BASE_PATH env var) */
  readonly VITE_BASE_PATH?: string;
  /** Repository URL for source links (set via VITE_REPO_URL env var) */
  readonly VITE_REPO_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
