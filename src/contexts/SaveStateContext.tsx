/**
 * SaveStateContext
 * Unified save-state tracking across browser storage, local file, and GitHub.
 * Tracks the active save source, last-saved timestamp, and dirty state.
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { GitHubMetadata } from '../components/integrations/github/types';

// ── Save source discriminated union ──────────────────────────────────────────

export interface BrowserSaveSource {
  type: 'browser';
  /** IndexedDB key for the saved model entry */
  modelId: string;
  /** Display name of the model */
  modelName: string;
}

export interface FileSaveSource {
  type: 'file';
  /** File System Access API handle (for writing back) */
  handle: FileSystemFileHandle;
  /** Display name (filename) */
  fileName: string;
}

export interface GitHubSaveSource {
  type: 'github';
  /** Full GitHub metadata for the commit target */
  metadata: GitHubMetadata;
}

export type SaveSource = BrowserSaveSource | FileSaveSource | GitHubSaveSource;

// ── Auto-save settings ──────────────────────────────────────────────────────

export interface AutoSaveSettings {
  /** Auto-save to local files when save source is a local file */
  autoSaveLocalFiles: boolean;
  /** Auto-save to browser storage when save source is browser */
  autoSaveBrowserFiles: boolean;
}

const AUTOSAVE_SETTINGS_KEY = 'flowstate-autosave-settings';

function loadAutoSaveSettings(): AutoSaveSettings {
  try {
    const stored = localStorage.getItem(AUTOSAVE_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        autoSaveLocalFiles: typeof parsed.autoSaveLocalFiles === 'boolean' ? parsed.autoSaveLocalFiles : false,
        autoSaveBrowserFiles: typeof parsed.autoSaveBrowserFiles === 'boolean' ? parsed.autoSaveBrowserFiles : false,
      };
    }
  } catch {
    // ignore
  }
  return { autoSaveLocalFiles: false, autoSaveBrowserFiles: false };
}

function persistAutoSaveSettings(settings: AutoSaveSettings): void {
  localStorage.setItem(AUTOSAVE_SETTINGS_KEY, JSON.stringify(settings));
}

// ── Context type ────────────────────────────────────────────────────────────

export interface SaveStateContextType {
  /** The currently-active save source, or null if never saved / new model */
  saveSource: SaveSource | null;
  /** Timestamp of the last successful save (any method), or null */
  lastSavedAt: number | null;
  /** Whether the model has been modified since the last save */
  isDirty: boolean;
  /** Set the active save source (called after save or after loading a file) */
  setSaveSource: (source: SaveSource | null) => void;
  /** Mark the model as just-saved (updates timestamp, clears dirty flag). Pass savedAt to restore a persisted timestamp. */
  markSaved: (source?: SaveSource, savedAt?: number) => void;
  /** Mark the model as modified since last save */
  markDirty: () => void;
  /** Clear save source and dirty state (e.g., when loading new/empty model) */
  clearSaveState: () => void;
  /** Auto-save settings */
  autoSaveSettings: AutoSaveSettings;
  /** Update auto-save settings */
  setAutoSaveSettings: (settings: AutoSaveSettings) => void;
}

const SaveStateContext = createContext<SaveStateContextType | undefined>(undefined);

// ── Provider ────────────────────────────────────────────────────────────────

export const SaveStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [saveSource, setSaveSourceState] = useState<SaveSource | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [autoSaveSettings, setAutoSaveSettingsState] = useState<AutoSaveSettings>(loadAutoSaveSettings);

  // Ref to avoid stale closures in callbacks
  const saveSourceRef = useRef<SaveSource | null>(null);

  const setSaveSource = useCallback((source: SaveSource | null) => {
    saveSourceRef.current = source;
    setSaveSourceState(source);
  }, []);

  const markSaved = useCallback((source?: SaveSource, savedAt?: number) => {
    setLastSavedAt(savedAt ?? Date.now());
    setIsDirty(false);
    if (source) {
      saveSourceRef.current = source;
      setSaveSourceState(source);
    }
  }, []);

  const markDirty = useCallback(() => {
    setIsDirty(true);
  }, []);

  const clearSaveState = useCallback(() => {
    saveSourceRef.current = null;
    setSaveSourceState(null);
    setLastSavedAt(null);
    setIsDirty(false);
  }, []);

  const setAutoSaveSettings = useCallback((settings: AutoSaveSettings) => {
    setAutoSaveSettingsState(settings);
    persistAutoSaveSettings(settings);
  }, []);

  return (
    <SaveStateContext.Provider
      value={{
        saveSource,
        lastSavedAt,
        isDirty,
        setSaveSource,
        markSaved,
        markDirty,
        clearSaveState,
        autoSaveSettings,
        setAutoSaveSettings,
      }}
    >
      {children}
    </SaveStateContext.Provider>
  );
};

// ── Hook ────────────────────────────────────────────────────────────────────

export function useSaveState(): SaveStateContextType {
  const context = useContext(SaveStateContext);
  if (!context) {
    throw new Error('useSaveState must be used within a SaveStateProvider');
  }
  return context;
}
