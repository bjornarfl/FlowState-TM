/**
 * Custom hook for managing undo/redo history
 * Tracks snapshots of state and provides undo/redo functionality
 */

import { useState, useCallback, useRef } from 'react';
import type { ThreatModel } from '../types/threatModel';

export interface StateSnapshot {
  threatModel: ThreatModel | null;
  nodes: any[];
  edges: any[];
  yamlContent: string;
}

export interface UseUndoRedoResult {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  recordState: (snapshot: StateSnapshot) => void;
  clearHistory: () => void;
}

interface HistoryState {
  past: StateSnapshot[];
  present: StateSnapshot | null;
  future: StateSnapshot[];
}

const MAX_HISTORY_SIZE = 50;

export function useUndoRedo(
  onRestore: (snapshot: StateSnapshot) => void
): UseUndoRedoResult {
  const [historyState, setHistoryState] = useState<HistoryState>({
    past: [],
    present: null,
    future: [],
  });
  const isRestoringRef = useRef(false);

  const canUndo = historyState.past.length > 0;
  const canRedo = historyState.future.length > 0;

  const recordState = useCallback((snapshot: StateSnapshot) => {
    // Don't record state changes that are happening due to undo/redo
    if (isRestoringRef.current) {
      return;
    }

    setHistoryState((prev) => {
      const newPast = prev.present ? [...prev.past, prev.present] : prev.past;
      
      // Limit history size
      const limitedPast = newPast.length >= MAX_HISTORY_SIZE
        ? newPast.slice(newPast.length - MAX_HISTORY_SIZE + 1)
        : newPast;
      
      return {
        past: limitedPast,
        present: snapshot,
        future: [], // Clear future when recording new state
      };
    });
  }, []);

  const undo = useCallback(() => {
    if (!canUndo || !historyState.present) return;

    const previous = historyState.past[historyState.past.length - 1];
    const newPast = historyState.past.slice(0, historyState.past.length - 1);

    setHistoryState({
      past: newPast,
      present: previous,
      future: [historyState.present, ...historyState.future],
    });

    isRestoringRef.current = true;
    onRestore(previous);
    
    // Use setTimeout to reset the flag after the restore is complete
    setTimeout(() => {
      isRestoringRef.current = false;
    }, 0);
  }, [canUndo, historyState, onRestore]);

  const redo = useCallback(() => {
    if (!canRedo || !historyState.present) return;

    const next = historyState.future[0];
    const newFuture = historyState.future.slice(1);

    setHistoryState({
      past: [...historyState.past, historyState.present],
      present: next,
      future: newFuture,
    });

    isRestoringRef.current = true;
    onRestore(next);
    
    // Use setTimeout to reset the flag after the restore is complete
    setTimeout(() => {
      isRestoringRef.current = false;
    }, 0);
  }, [canRedo, historyState, onRestore]);

  const clearHistory = useCallback(() => {
    setHistoryState({
      past: [],
      present: null,
      future: [],
    });
  }, []);

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    recordState,
    clearHistory,
  };
}
