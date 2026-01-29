/**
 * Browser Storage Utility using IndexedDB
 * Handles persistent storage for threat models using idb-keyval
 */

import { get, set, del, entries, clear } from 'idb-keyval';
import type { GitHubMetadata } from '../components/integrations/github/types';

export interface SavedModel {
  id: string;
  name: string;
  content: string;
  savedAt: number;
  githubMetadata?: GitHubMetadata;
}

export interface AutoSaveDraft {
  name: string;
  content: string;
  savedAt: number;
  githubMetadata?: GitHubMetadata;
}

const AUTOSAVE_KEY = 'autosave-draft';
const MODEL_PREFIX = 'threat-model-';
const MIGRATION_FLAG = 'indexeddb-migrated';

/**
 * Save a threat model to IndexedDB
 */
export const saveToBrowserStorage = async (
  name: string,
  content: string,
  timestamp?: number,
  githubMetadata?: GitHubMetadata
): Promise<string> => {
  const id = `${MODEL_PREFIX}${Date.now()}`;
  const metadata: SavedModel = {
    id,
    name,
    content,
    savedAt: timestamp || Date.now(),
    ...(githubMetadata && { githubMetadata }),
  };
  await set(id, metadata);
  return id;
};

/**
 * Get all saved threat models from IndexedDB
 */
export const getSavedModelsFromBrowser = async (): Promise<SavedModel[]> => {
  const allEntries = await entries<string, SavedModel>();
  return allEntries
    .filter(([key]) => key.startsWith(MODEL_PREFIX))
    .map(([_, value]) => value)
    .sort((a, b) => b.savedAt - a.savedAt);
};

/**
 * Load a saved threat model from IndexedDB
 */
export const loadFromBrowserStorage = async (id: string): Promise<string | null> => {
  const model = await get<SavedModel>(id);
  return model?.content || null;
};

/**
 * Load a saved threat model with all metadata from IndexedDB
 */
export const loadModelWithMetadata = async (id: string): Promise<SavedModel | null> => {
  const model = await get<SavedModel>(id);
  return model || null;
};

/**
 * Update GitHub metadata for a saved model
 */
export const updateModelGitHubMetadata = async (
  id: string,
  githubMetadata: GitHubMetadata | undefined
): Promise<void> => {
  const model = await get<SavedModel>(id);
  if (model) {
    if (githubMetadata) {
      model.githubMetadata = githubMetadata;
    } else {
      delete model.githubMetadata;
    }
    await set(id, model);
  }
};

/**
 * Delete a saved threat model from IndexedDB
 */
export const deleteFromBrowserStorage = async (id: string): Promise<void> => {
  await del(id);
};

/**
 * Rename a saved threat model
 */
export const renameModelInBrowserStorage = async (
  id: string,
  newName: string
): Promise<void> => {
  const model = await get<SavedModel>(id);
  if (model) {
    model.name = newName;
    await set(id, model);
  }
};

/**
 * Duplicate a saved threat model with a new ID
 */
export const duplicateModelInBrowserStorage = async (
  id: string,
  newName?: string
): Promise<string | null> => {
  const model = await get<SavedModel>(id);
  if (!model) return null;
  
  const newId = `${MODEL_PREFIX}${Date.now()}`;
  const duplicate: SavedModel = {
    ...model,
    id: newId,
    name: newName || `${model.name} (Copy)`,
    savedAt: Date.now(),
  };
  await set(newId, duplicate);
  return newId;
};

/**
 * Save auto-save draft (current state only)
 */
export const saveAutoSaveDraft = async (
  name: string,
  content: string,
  githubMetadata?: GitHubMetadata
): Promise<void> => {
  const draft: AutoSaveDraft = {
    name,
    content,
    savedAt: Date.now(),
    ...(githubMetadata && { githubMetadata }),
  };
  await set(AUTOSAVE_KEY, draft);
};

/**
 * Get auto-save draft
 */
export const getAutoSaveDraft = async (): Promise<AutoSaveDraft | null> => {
  const draft = await get<AutoSaveDraft>(AUTOSAVE_KEY);
  return draft || null;
};

/**
 * Clear auto-save draft
 */
export const clearAutoSaveDraft = async (): Promise<void> => {
  await del(AUTOSAVE_KEY);
};

/**
 * Check if auto-save draft exists
 */
export const hasAutoSaveDraft = async (): Promise<boolean> => {
  const draft = await get(AUTOSAVE_KEY);
  return draft !== undefined;
};

/**
 * Migrate existing localStorage data to IndexedDB (one-time operation)
 */
export const migrateFromLocalStorage = async (): Promise<number> => {
  // Check if migration already done
  const migrated = localStorage.getItem(MIGRATION_FLAG);
  if (migrated) return 0;

  let migratedCount = 0;
  
  // Migrate saved models
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('threat-model-')) {
      const item = localStorage.getItem(key);
      if (item) {
        try {
          const parsed = JSON.parse(item);
          const model: SavedModel = {
            id: key,
            name: parsed.name,
            content: parsed.content,
            savedAt: parsed.savedAt,
          };
          await set(key, model);
          migratedCount++;
        } catch (e) {
          console.error(`Failed to migrate ${key}:`, e);
        }
      }
    }
  }

  // Mark migration as complete
  localStorage.setItem(MIGRATION_FLAG, 'true');
  
  return migratedCount;
};

/**
 * Clear all stored threat models (for testing/cleanup)
 */
export const clearAllStoredModels = async (): Promise<void> => {
  await clear();
};

// File System Access API support

const FILE_HANDLE_KEY = 'local-file-handle';

/**
 * Check if File System Access API is supported
 */
export const isFileSystemAccessSupported = (): boolean => {
  return 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;
};

/**
 * Store a file handle for future write operations.
 * Note: File handles can be stored in IndexedDB and persist across sessions.
 */
export const storeFileHandle = async (handle: FileSystemFileHandle): Promise<void> => {
  await set(FILE_HANDLE_KEY, handle);
};

/**
 * Get the stored file handle
 */
export const getStoredFileHandle = async (): Promise<FileSystemFileHandle | null> => {
  const handle = await get<FileSystemFileHandle>(FILE_HANDLE_KEY);
  return handle || null;
};

/**
 * Clear the stored file handle
 */
export const clearFileHandle = async (): Promise<void> => {
  await del(FILE_HANDLE_KEY);
};

/**
 * Request permission for a file handle (required before read/write operations)
 * Returns true if permission granted, false otherwise
 */
export const requestFileHandlePermission = async (
  handle: FileSystemFileHandle,
  mode: 'read' | 'readwrite' = 'readwrite'
): Promise<boolean> => {
  try {
    // Check current permission state
    const options = { mode } as FileSystemHandlePermissionDescriptor;
    let permission = await handle.queryPermission(options);
    
    if (permission === 'granted') {
      return true;
    }
    
    // Request permission if not granted
    permission = await handle.requestPermission(options);
    return permission === 'granted';
  } catch (error) {
    console.error('Error requesting file handle permission:', error);
    return false;
  }
};

/**
 * Write content to a file handle
 */
export const writeToFileHandle = async (
  handle: FileSystemFileHandle,
  content: string
): Promise<void> => {
  const writable = await handle.createWritable();
  try {
    await writable.write(content);
  } finally {
    await writable.close();
  }
};

/**
 * Open a file using the File System Access API
 * Returns the file handle and content, or null if cancelled
 */
export const openFileWithPicker = async (): Promise<{ handle: FileSystemFileHandle; content: string; name: string } | null> => {
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [
        {
          description: 'YAML files',
          accept: {
            'text/yaml': ['.yaml', '.yml'],
          },
        },
      ],
      multiple: false,
    });
    
    const file = await handle.getFile();
    const content = await file.text();
    
    return { handle, content, name: file.name };
  } catch (error) {
    // User cancelled the picker
    if (error instanceof Error && error.name === 'AbortError') {
      return null;
    }
    throw error;
  }
};

/**
 * Save content using the File System Access API picker
 * Returns the file handle for future operations, or null if cancelled
 */
export const saveFileWithPicker = async (
  content: string,
  suggestedName?: string
): Promise<FileSystemFileHandle | null> => {
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: suggestedName || 'threat_model.yaml',
      types: [
        {
          description: 'YAML files',
          accept: {
            'text/yaml': ['.yaml', '.yml'],
          },
        },
      ],
    });
    
    await writeToFileHandle(handle, content);
    return handle;
  } catch (error) {
    // User cancelled the picker
    if (error instanceof Error && error.name === 'AbortError') {
      return null;
    }
    throw error;
  }
};
