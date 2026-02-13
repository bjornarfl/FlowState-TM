/**
 * useAutoSave Hook
 * Provides debounced auto-save functionality.
 * Supports three targets:
 *  - 'draft' (default): saves to the singleton IndexedDB autosave draft
 *  - 'browser': overwrites the active browser-storage entry in-place
 *  - 'file': writes to the active local-file handle via File System Access API
 *
 * In 'browser' and 'file' modes the ephemeral draft is ALSO written as a
 * crash-recovery safety net.
 */

import { useEffect, useRef } from 'react';
import {
  saveAutoSaveDraft,
  updateModelContent,
  writeToFileHandle,
  requestFileHandlePermission,
} from '../utils/browserStorage';
import type { SerializedSaveSource } from '../utils/browserStorage';
import type { GitHubMetadata } from '../components/integrations/github/types';

export interface AutoSaveOptions {
  /** Debounce delay in milliseconds (default: 2000) */
  delay?: number;
  /** Whether auto-save is enabled (default: true) */
  enabled?: boolean;
  /** GitHub metadata to save alongside the threat model */
  githubMetadata?: GitHubMetadata | null;
  /** Callback when auto-save completes */
  onSave?: () => void;
  /** Callback when auto-save fails */
  onError?: (error: Error) => void;
  /** Whether to auto-save to the browser storage entry */
  autoSaveToBrowser?: boolean;
  /** Whether to auto-save to the local file */
  autoSaveToFile?: boolean;
  /** Browser-storage model ID (required when autoSaveToBrowser is true) */
  browserModelId?: string | null;
  /** Local file handle (required when autoSaveToFile is true) */
  fileHandle?: FileSystemFileHandle | null;
  /** Serialised save source metadata to persist in the draft */
  saveSourceMeta?: SerializedSaveSource;
  /** Timestamp of the last save-to-source (passed through to draft for recovery) */
  lastSavedToSourceAt?: number | null;
  /** Current dirty state to persist in the draft */
  isDirty?: boolean;
  /** Called after a successful file write with the new file lastModified timestamp */
  onFileWritten?: (lastModified: number) => void;
}

/**
 * Hook that automatically saves content with debouncing.
 * @param name - Name of the threat model
 * @param content - YAML content to save
 * @param options - Auto-save configuration options
 */
export function useAutoSave(
  name: string,
  content: string,
  options: AutoSaveOptions = {}
): void {
  const {
    delay = 2000,
    enabled = true,
    githubMetadata,
    onSave,
    onError,
    autoSaveToBrowser = false,
    autoSaveToFile = false,
    browserModelId,
    fileHandle,
    saveSourceMeta,
    lastSavedToSourceAt,
    isDirty,
    onFileWritten,
  } = options;

  const timeoutRef = useRef<number | null>(null);
  const previousContentRef = useRef<string>(content);
  const previousMetadataRef = useRef<GitHubMetadata | null | undefined>(githubMetadata);
  const isSavingRef = useRef<boolean>(false);

  // Use refs for values that are only read at save-time and should NOT
  // trigger re-debounce when they change (avoids unnecessary effect runs
  // during node dragging and other high-frequency re-renders).
  const autoSaveToBrowserRef = useRef(autoSaveToBrowser);
  const autoSaveToFileRef = useRef(autoSaveToFile);
  const browserModelIdRef = useRef(browserModelId);
  const fileHandleRef = useRef(fileHandle);
  const saveSourceMetaRef = useRef(saveSourceMeta);
  const lastSavedToSourceAtRef = useRef(lastSavedToSourceAt ?? undefined);
  const isDirtyRef = useRef(isDirty);
  const onSaveRef = useRef(onSave);
  const onErrorRef = useRef(onError);
  const onFileWrittenRef = useRef(onFileWritten);

  autoSaveToBrowserRef.current = autoSaveToBrowser;
  autoSaveToFileRef.current = autoSaveToFile;
  browserModelIdRef.current = browserModelId;
  fileHandleRef.current = fileHandle;
  saveSourceMetaRef.current = saveSourceMeta;
  lastSavedToSourceAtRef.current = lastSavedToSourceAt ?? undefined;
  isDirtyRef.current = isDirty;
  onSaveRef.current = onSave;
  onErrorRef.current = onError;
  onFileWrittenRef.current = onFileWritten;

  useEffect(() => {
    // Update metadata ref when it changes, even if we're not saving
    if (githubMetadata !== previousMetadataRef.current) {
      previousMetadataRef.current = githubMetadata;
    }

    // Skip if auto-save is disabled or content hasn't changed
    if (!enabled || content === previousContentRef.current) {
      return;
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set up new debounced save
    timeoutRef.current = setTimeout(async () => {
      if (isSavingRef.current) return;

      isSavingRef.current = true;
      try {
        const willSaveToSource =
          (autoSaveToBrowserRef.current && !!browserModelIdRef.current) ||
          (autoSaveToFileRef.current && !!fileHandleRef.current);

        // If we're about to save to source, record the timestamp
        if (willSaveToSource) {
          lastSavedToSourceAtRef.current = Date.now();
        }

        // Always write the draft as a safety net
        await saveAutoSaveDraft(
          name,
          content,
          githubMetadata ?? undefined,
          saveSourceMetaRef.current,
          lastSavedToSourceAtRef.current,
          isDirtyRef.current
        );

        // Auto-save to browser storage if enabled and active
        if (autoSaveToBrowserRef.current && browserModelIdRef.current) {
          await updateModelContent(
            browserModelIdRef.current,
            content,
            name,
            githubMetadata ?? undefined
          );
        }

        // Auto-save to local file if enabled and active
        if (autoSaveToFileRef.current && fileHandleRef.current) {
          try {
            const hasPermission = await requestFileHandlePermission(fileHandleRef.current, 'readwrite');
            if (hasPermission) {
              const newLastModified = await writeToFileHandle(fileHandleRef.current, content);
              onFileWrittenRef.current?.(newLastModified);
            }
          } catch {
            // Silently ignore file-write failures during auto-save
          }
        }

        previousContentRef.current = content;
        previousMetadataRef.current = githubMetadata;
        onSaveRef.current?.();
      } catch (error) {
        console.error('Auto-save failed:', error);
        onErrorRef.current?.(error as Error);
      } finally {
        isSavingRef.current = false;
      }
    }, delay);

    // Cleanup timeout on unmount or when dependencies change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [name, content, delay, enabled, githubMetadata]);
}

