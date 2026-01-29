import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUndoRedo } from '../useUndoRedo';
import type { StateSnapshot } from '../useUndoRedo';

describe('useUndoRedo', () => {
  it('should initialize with no undo/redo capability', () => {
    const onRestore = vi.fn();
    const { result } = renderHook(() => useUndoRedo(onRestore));

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('should record state and enable undo', () => {
    const onRestore = vi.fn();
    const { result } = renderHook(() => useUndoRedo(onRestore));

    const snapshot1: StateSnapshot = {
      threatModel: null,
      nodes: [],
      edges: [],
      yamlContent: 'test',
    };

    const snapshot2: StateSnapshot = {
      threatModel: null,
      nodes: [],
      edges: [],
      yamlContent: 'test2',
    };

    act(() => {
      result.current.recordState(snapshot1);
      result.current.recordState(snapshot2);
    });

    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('should undo to previous state', () => {
    const onRestore = vi.fn();
    const { result } = renderHook(() => useUndoRedo(onRestore));

    const snapshot1: StateSnapshot = {
      threatModel: null,
      nodes: [],
      edges: [],
      yamlContent: 'state1',
    };

    const snapshot2: StateSnapshot = {
      threatModel: null,
      nodes: [],
      edges: [],
      yamlContent: 'state2',
    };

    act(() => {
      result.current.recordState(snapshot1);
      result.current.recordState(snapshot2);
    });

    act(() => {
      result.current.undo();
    });

    expect(onRestore).toHaveBeenCalledWith(snapshot1);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it('should redo to next state', async () => {
    const onRestore = vi.fn();
    const { result } = renderHook(() => useUndoRedo(onRestore));

    const snapshot1: StateSnapshot = {
      threatModel: null,
      nodes: [],
      edges: [],
      yamlContent: 'state1',
    };

    const snapshot2: StateSnapshot = {
      threatModel: null,
      nodes: [],
      edges: [],
      yamlContent: 'state2',
    };

    act(() => {
      result.current.recordState(snapshot1);
    });

    act(() => {
      result.current.recordState(snapshot2);
    });

    act(() => {
      result.current.undo();
    });

    // Now we should be able to redo
    expect(result.current.canRedo).toBe(true);

    // Clear the mock calls from undo
    onRestore.mockClear();

    act(() => {
      result.current.redo();
    });

    expect(onRestore).toHaveBeenCalledWith(snapshot2);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('should clear redo history when new state is recorded after undo', () => {
    const onRestore = vi.fn();
    const { result } = renderHook(() => useUndoRedo(onRestore));

    const snapshot1: StateSnapshot = {
      threatModel: null,
      nodes: [],
      edges: [],
      yamlContent: 'state1',
    };

    const snapshot2: StateSnapshot = {
      threatModel: null,
      nodes: [],
      edges: [],
      yamlContent: 'state2',
    };

    const snapshot3: StateSnapshot = {
      threatModel: null,
      nodes: [],
      edges: [],
      yamlContent: 'state3',
    };

    act(() => {
      result.current.recordState(snapshot1);
      result.current.recordState(snapshot2);
      result.current.undo();
      result.current.recordState(snapshot3);
    });

    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('should clear all history', () => {
    const onRestore = vi.fn();
    const { result } = renderHook(() => useUndoRedo(onRestore));

    const snapshot: StateSnapshot = {
      threatModel: null,
      nodes: [],
      edges: [],
      yamlContent: 'test',
    };

    act(() => {
      result.current.recordState(snapshot);
      result.current.clearHistory();
    });

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('should limit history size to MAX_HISTORY_SIZE', () => {
    const onRestore = vi.fn();
    const { result } = renderHook(() => useUndoRedo(onRestore));

    // Record 52 states (MAX_HISTORY_SIZE is 50)
    // After recording, we should only have the last 50 in history
    for (let i = 0; i < 52; i++) {
      act(() => {
        result.current.recordState({
          threatModel: null,
          nodes: [],
          edges: [],
          yamlContent: `state${i}`,
        });
      });
    }

    // Should be able to undo
    expect(result.current.canUndo).toBe(true);

    // Count how many undos we can do
    let undoCount = 0;
    while (result.current.canUndo && undoCount < 100) {
      act(() => {
        result.current.undo();
      });
      undoCount++;
    }

    // Should have been able to undo at most 50 times (MAX_HISTORY_SIZE - 1 because present doesn't count)
    // We recorded 52 states, but only kept the last 50, so we can undo 49 times
    expect(undoCount).toBeLessThanOrEqual(50);
    expect(result.current.canUndo).toBe(false);
  });
});
