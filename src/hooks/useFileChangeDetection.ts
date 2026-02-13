/**
 * useFileChangeDetection Hook
 *
 * Detects when a locally-opened file has been modified outside the editor
 * by polling `FileSystemFileHandle.getFile()` on tab focus / visibility change.
 *
 * - If the editor state is clean (not dirty): auto-reloads the new content.
 * - If the editor state is dirty: notifies the caller so a conflict modal
 *   can be shown.
 */

import { useEffect, useRef, useCallback } from 'react';

export interface FileChangeDetectionOptions {
  /** The active local file handle (null when not working with a local file) */
  fileHandle: FileSystemFileHandle | null;
  /** Whether the editor has unsaved changes */
  isDirty: boolean;
  /** Called when an external change is detected and the editor is clean */
  onExternalChange: (newContent: string) => void;
  /** Called when an external change is detected and the editor is dirty */
  onConflictDetected: (newContent: string) => void;
  /** Minimum interval between checks in ms (default: 2000) */
  throttleMs?: number;
  /** Whether detection is enabled (default: true) */
  enabled?: boolean;
}

export interface FileChangeDetectionHandle {
  /** Call after your own write to update the baseline timestamp */
  updateLastKnownModified: (timestamp: number) => void;
  /** Whether a conflict is currently pending user resolution */
  isConflictPending: boolean;
  /** Call when the user resolves a conflict (keeps theirs, loads external, etc.) */
  resolveConflict: () => void;
  /** Pause detection (e.g. while auto-save is writing) */
  pause: () => void;
  /** Resume detection */
  resume: () => void;
}

export function useFileChangeDetection(
  options: FileChangeDetectionOptions
): FileChangeDetectionHandle {
  const {
    fileHandle,
    isDirty,
    onExternalChange,
    onConflictDetected,
    throttleMs = 2000,
    enabled = true,
  } = options;

  const lastKnownModifiedRef = useRef<number | null>(null);
  const lastCheckTimeRef = useRef<number>(0);
  const conflictPendingRef = useRef(false);
  const pausedRef = useRef(false);
  const isCheckingRef = useRef(false);

  // Keep callback refs up to date
  const onExternalChangeRef = useRef(onExternalChange);
  const onConflictDetectedRef = useRef(onConflictDetected);
  const isDirtyRef = useRef(isDirty);
  const fileHandleRef = useRef(fileHandle);
  const enabledRef = useRef(enabled);

  onExternalChangeRef.current = onExternalChange;
  onConflictDetectedRef.current = onConflictDetected;
  isDirtyRef.current = isDirty;
  fileHandleRef.current = fileHandle;
  enabledRef.current = enabled;

  // Initialize lastKnownModified when we get a new file handle
  useEffect(() => {
    if (!fileHandle) {
      lastKnownModifiedRef.current = null;
      conflictPendingRef.current = false;
      return;
    }

    // Seed the baseline timestamp from the current file
    let cancelled = false;
    (async () => {
      try {
        const file = await fileHandle.getFile();
        if (!cancelled) {
          lastKnownModifiedRef.current = file.lastModified;
        }
      } catch {
        // Permission may not be granted yet — will seed on next successful check
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileHandle]);

  const checkForChanges = useCallback(async () => {
    const handle = fileHandleRef.current;
    if (
      !handle ||
      !enabledRef.current ||
      pausedRef.current ||
      isCheckingRef.current ||
      conflictPendingRef.current
    ) {
      return;
    }

    // Throttle: skip if we checked too recently
    const now = Date.now();
    if (now - lastCheckTimeRef.current < throttleMs) {
      return;
    }

    isCheckingRef.current = true;
    lastCheckTimeRef.current = now;

    try {
      const file = await handle.getFile();
      const fileModified = file.lastModified;

      // If we don't have a baseline yet, just seed it
      if (lastKnownModifiedRef.current === null) {
        lastKnownModifiedRef.current = fileModified;
        isCheckingRef.current = false;
        return;
      }

      // No change detected
      if (fileModified <= lastKnownModifiedRef.current) {
        isCheckingRef.current = false;
        return;
      }

      // File has been modified externally — read its new content
      const newContent = await file.text();

      // Update baseline so we don't re-fire for the same change
      lastKnownModifiedRef.current = fileModified;

      if (isDirtyRef.current) {
        // Editor has unsaved changes — conflict
        conflictPendingRef.current = true;
        onConflictDetectedRef.current(newContent);
      } else {
        // Editor is clean — auto-reload
        onExternalChangeRef.current(newContent);
      }
    } catch (error) {
      // Likely permission revoked or file deleted — silently ignore.
      // The user will notice on their next explicit save/load.
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        console.warn('Local file no longer exists on disk');
      }
    } finally {
      isCheckingRef.current = false;
    }
  }, [throttleMs]);

  // Set up event listeners for visibility change and window focus
  useEffect(() => {
    if (!fileHandle || !enabled) return;

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkForChanges();
      }
    };

    const handleFocus = () => {
      checkForChanges();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Do an initial check when hook is first set up with a file handle
    checkForChanges();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fileHandle, enabled, checkForChanges]);

  const updateLastKnownModified = useCallback((timestamp: number) => {
    lastKnownModifiedRef.current = timestamp;
  }, []);

  const resolveConflict = useCallback(() => {
    conflictPendingRef.current = false;
  }, []);

  const pause = useCallback(() => {
    pausedRef.current = true;
  }, []);

  const resume = useCallback(() => {
    pausedRef.current = false;
  }, []);

  return {
    updateLastKnownModified,
    isConflictPending: conflictPendingRef.current,
    resolveConflict,
    pause,
    resume,
  };
}
