import { useState, useCallback, useEffect, useMemo } from 'react';

export type TabView = 'tables' | 'yaml' | 'canvas' | 'tutorials';

const ALL_VIEWS: TabView[] = ['tables', 'canvas', 'yaml', 'tutorials'];

export interface Tab {
  id: string;
  view: TabView;
}

export interface TabLayout {
  tabs: Tab[];
  tabWidths: number[]; // percentages summing to 100
}

const STORAGE_KEY = 'tabLayout';
const MIN_TAB_WIDTH_PX = 500;

let nextTabId = 1;

function generateTabId(): string {
  return `tab-${nextTabId++}-${Date.now()}`;
}

function getDefaultLayout(): TabLayout {
  const id1 = generateTabId();
  const id2 = generateTabId();
  return {
    tabs: [
      { id: id1, view: 'tables' },
      { id: id2, view: 'canvas' },
    ],
    tabWidths: [50, 50],
  };
}

function loadLayout(): TabLayout {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as TabLayout;
      // Validate structure
      if (
        Array.isArray(parsed.tabs) &&
        parsed.tabs.length > 0 &&
        Array.isArray(parsed.tabWidths) &&
        parsed.tabs.length === parsed.tabWidths.length &&
        parsed.tabs.every(
          (t) => t.id && ['tables', 'yaml', 'canvas', 'tutorials'].includes(t.view)
        )
      ) {
        // Re-seed nextTabId to avoid collisions
        const maxNum = parsed.tabs.reduce((max, t) => {
          const match = t.id.match(/^tab-(\d+)/);
          return match ? Math.max(max, parseInt(match[1], 10)) : max;
        }, 0);
        nextTabId = maxNum + 1;
        return parsed;
      }
    }
  } catch {
    // ignore parse errors
  }
  return getDefaultLayout();
}

function saveLayout(layout: TabLayout): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // ignore quota errors
  }
}

/** Redistribute widths evenly */
function equalWidths(count: number): number[] {
  const width = 100 / count;
  return Array.from({ length: count }, () => width);
}

/** Clamp tab widths so no tab is below the minimum pixel width */
function clampWidths(
  widths: number[],
  containerWidth: number
): number[] {
  if (containerWidth <= 0 || widths.length === 0) return widths;

  const minPercent = (MIN_TAB_WIDTH_PX / containerWidth) * 100;
  const result = [...widths];

  // First pass: enforce minimums
  let deficit = 0;
  let flexibleCount = 0;
  for (let i = 0; i < result.length; i++) {
    if (result[i] < minPercent) {
      deficit += minPercent - result[i];
      result[i] = minPercent;
    } else {
      flexibleCount++;
    }
  }

  // Distribute deficit from flexible tabs
  if (deficit > 0 && flexibleCount > 0) {
    const perTab = deficit / flexibleCount;
    for (let i = 0; i < result.length; i++) {
      if (result[i] > minPercent) {
        result[i] -= perTab;
      }
    }
  }

  return result;
}

export function useTabLayout(containerRef?: React.RefObject<HTMLElement | null>) {
  const [layout, setLayout] = useState<TabLayout>(loadLayout);
  const [containerWidth, setContainerWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );

  // Observe container width
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef?.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      } else {
        setContainerWidth(window.innerWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);

    let observer: ResizeObserver | null = null;
    if (containerRef?.current) {
      observer = new ResizeObserver(updateWidth);
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateWidth);
      observer?.disconnect();
    };
  }, [containerRef]);

  // Persist on change
  useEffect(() => {
    saveLayout(layout);
  }, [layout]);

  const maxTabsAllowed = useMemo(() => {
    return Math.max(1, Math.floor(containerWidth / MIN_TAB_WIDTH_PX));
  }, [containerWidth]);

  const canAddTab = layout.tabs.length < maxTabsAllowed;

  const addTab = useCallback(
    (view?: TabView) => {
      setLayout((prev) => {
        if (prev.tabs.length >= Math.max(1, Math.floor(containerWidth / MIN_TAB_WIDTH_PX))) {
          return prev;
        }
        const usedViews = new Set(prev.tabs.map((t) => t.view));
        const resolvedView = view ?? ALL_VIEWS.find((v) => !usedViews.has(v)) ?? 'tables';
        const newTab: Tab = { id: generateTabId(), view: resolvedView };
        const newTabs = [...prev.tabs, newTab];
        return {
          tabs: newTabs,
          tabWidths: equalWidths(newTabs.length),
        };
      });
    },
    [containerWidth]
  );

  const removeTab = useCallback((id: string) => {
    setLayout((prev) => {
      if (prev.tabs.length <= 1) return prev;
      const idx = prev.tabs.findIndex((t) => t.id === id);
      if (idx === -1) return prev;
      const newTabs = prev.tabs.filter((t) => t.id !== id);
      return {
        tabs: newTabs,
        tabWidths: equalWidths(newTabs.length),
      };
    });
  }, []);

  const changeTabView = useCallback((id: string, view: TabView) => {
    setLayout((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t) => (t.id === id ? { ...t, view } : t)),
    }));
  }, []);

  /** Reorder tabs by moving the tab at oldIndex to newIndex */
  const reorderTabs = useCallback((oldIndex: number, newIndex: number) => {
    setLayout((prev) => {
      if (
        oldIndex < 0 || oldIndex >= prev.tabs.length ||
        newIndex < 0 || newIndex >= prev.tabs.length ||
        oldIndex === newIndex
      ) {
        return prev;
      }
      const newTabs = [...prev.tabs];
      const newWidths = [...prev.tabWidths];
      const [movedTab] = newTabs.splice(oldIndex, 1);
      const [movedWidth] = newWidths.splice(oldIndex, 1);
      newTabs.splice(newIndex, 0, movedTab);
      newWidths.splice(newIndex, 0, movedWidth);
      return { tabs: newTabs, tabWidths: newWidths };
    });
  }, []);

  const resizeTabs = useCallback(
    (dividerIndex: number, clientX: number) => {
      setLayout((prev) => {
        if (dividerIndex < 0 || dividerIndex >= prev.tabs.length - 1) return prev;

        const cw = containerWidth;
        if (cw <= 0) return prev;

        // Calculate the left edge of the left tab
        let leftEdgePx = 0;
        for (let i = 0; i < dividerIndex; i++) {
          leftEdgePx += (prev.tabWidths[i] / 100) * cw;
        }

        const leftWidthPx = clientX - leftEdgePx;
        const combinedPercent =
          prev.tabWidths[dividerIndex] + prev.tabWidths[dividerIndex + 1];
        const combinedPx = (combinedPercent / 100) * cw;
        const rightWidthPx = combinedPx - leftWidthPx;

        // Enforce minimums
        if (leftWidthPx < MIN_TAB_WIDTH_PX || rightWidthPx < MIN_TAB_WIDTH_PX) {
          return prev;
        }

        const leftPercent = (leftWidthPx / cw) * 100;
        const rightPercent = (rightWidthPx / cw) * 100;

        const newWidths = [...prev.tabWidths];
        newWidths[dividerIndex] = leftPercent;
        newWidths[dividerIndex + 1] = rightPercent;

        return { ...prev, tabWidths: newWidths };
      });
    },
    [containerWidth]
  );

  // Auto-trim excess tabs if viewport shrinks
  useEffect(() => {
    setLayout((prev) => {
      const max = Math.max(1, Math.floor(containerWidth / MIN_TAB_WIDTH_PX));
      if (prev.tabs.length > max) {
        const trimmed = prev.tabs.slice(0, max);
        return {
          tabs: trimmed,
          tabWidths: equalWidths(trimmed.length),
        };
      }
      return prev;
    });
  }, [containerWidth]);

  /** Open a view: add as new tab if space, otherwise switch the rightmost tab */
  const openOrSwitchToView = useCallback(
    (view: TabView) => {
      setLayout((prev) => {
        // If there's already a tab with this view, do nothing
        if (prev.tabs.some((t) => t.view === view)) return prev;

        const max = Math.max(1, Math.floor(containerWidth / MIN_TAB_WIDTH_PX));
        if (prev.tabs.length < max) {
          // Add a new tab
          const newTab: Tab = { id: generateTabId(), view };
          const newTabs = [...prev.tabs, newTab];
          return { tabs: newTabs, tabWidths: equalWidths(newTabs.length) };
        }

        // Switch the rightmost tab
        const newTabs = prev.tabs.map((t, i) =>
          i === prev.tabs.length - 1 ? { ...t, view } : t
        );
        return { ...prev, tabs: newTabs };
      });
    },
    [containerWidth]
  );

  // Clamped widths for rendering
  const clampedWidths = useMemo(
    () => clampWidths(layout.tabWidths, containerWidth),
    [layout.tabWidths, containerWidth]
  );

  return {
    tabs: layout.tabs,
    tabWidths: clampedWidths,
    maxTabsAllowed,
    canAddTab,
    addTab,
    removeTab,
    changeTabView,
    reorderTabs,
    resizeTabs,
    openOrSwitchToView,
  };
}
