/**
 * useAutoSave Hook
 * Provides debounced auto-save functionality to IndexedDB
 */

import { useEffect, useRef } from 'react';
import { saveAutoSaveDraft } from '../utils/browserStorage';
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
}

/**
 * Hook that automatically saves content to IndexedDB with debouncing
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
  } = options;

  const timeoutRef = useRef<number | null>(null);
  const previousContentRef = useRef<string>(content);
  const previousMetadataRef = useRef<GitHubMetadata | null | undefined>(githubMetadata);
  const isSavingRef = useRef<boolean>(false);

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
        await saveAutoSaveDraft(name, content, githubMetadata ?? undefined);
        previousContentRef.current = content;
        previousMetadataRef.current = githubMetadata;
        onSave?.();
      } catch (error) {
        console.error('Auto-save failed:', error);
        onError?.(error as Error);
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
  }, [name, content, delay, enabled, githubMetadata, onSave, onError]);
}
