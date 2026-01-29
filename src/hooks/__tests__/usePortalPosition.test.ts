import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePortalPosition } from '../usePortalPosition';
import { RefObject } from 'react';

describe('usePortalPosition', () => {
  let mockElement: HTMLElement;

  beforeEach(() => {
    mockElement = document.createElement('div');
    window.innerHeight = 768;
    window.innerWidth = 1024;
  });

  const createMockRef = (rect: Partial<DOMRect>): RefObject<HTMLElement> => {
    const fullRect: DOMRect = {
      top: rect.top ?? 0,
      left: rect.left ?? 0,
      right: rect.right ?? 100,
      bottom: rect.bottom ?? 30,
      width: rect.width ?? 100,
      height: rect.height ?? 30,
      x: rect.x ?? 0,
      y: rect.y ?? 0,
      toJSON: () => ({}),
    };
    
    mockElement.getBoundingClientRect = vi.fn(() => fullRect);
    return { current: mockElement };
  };

  it('should position popup below trigger when there is enough space', () => {
    const triggerRef = createMockRef({ top: 100, left: 100, bottom: 130, right: 200 });
    
    const { result } = renderHook(() => 
      usePortalPosition(true, triggerRef, { estimatedHeight: 200 })
    );

    expect(result.current.renderUpward).toBe(false);
    expect(result.current.top).toBe(130); // bottom of trigger
  });

  it('should position popup above trigger when space below is insufficient', () => {
    const triggerRef = createMockRef({ top: 700, left: 100, bottom: 730, right: 200 });
    
    const { result } = renderHook(() => 
      usePortalPosition(true, triggerRef, { estimatedHeight: 200 })
    );

    expect(result.current.renderUpward).toBe(true);
    expect(result.current.top).toBe(700); // top of trigger
  });

  it('should align left when there is enough space on the right', () => {
    const triggerRef = createMockRef({ top: 100, left: 100, bottom: 130, right: 200 });
    
    const { result } = renderHook(() => 
      usePortalPosition(true, triggerRef, { estimatedHeight: 200, estimatedWidth: 300 })
    );

    expect(result.current.horizontalAlign).toBe('left');
    expect(result.current.left).toBe(100);
  });

  it('should align right when space on left is better', () => {
    const triggerRef = createMockRef({ 
      top: 100, 
      left: 900, 
      right: 1000, 
      bottom: 130,
      width: 100 
    });
    
    const { result } = renderHook(() => 
      usePortalPosition(true, triggerRef, { estimatedHeight: 200, estimatedWidth: 400 })
    );

    expect(result.current.horizontalAlign).toBe('right');
  });

  it('should center align when neither side has enough space', () => {
    const triggerRef = createMockRef({ 
      top: 100, 
      left: 512, 
      right: 612, 
      bottom: 130,
      width: 100 
    });
    
    const { result } = renderHook(() => 
      usePortalPosition(true, triggerRef, { estimatedHeight: 200, estimatedWidth: 800 })
    );

    expect(result.current.horizontalAlign).toBe('center');
  });

  it('should support backward compatibility with number parameter', () => {
    const triggerRef = createMockRef({ top: 100, left: 100, bottom: 130, right: 200 });
    
    const { result } = renderHook(() => 
      usePortalPosition(true, triggerRef, 200)
    );

    expect(result.current).toHaveProperty('top');
    expect(result.current).toHaveProperty('left');
    expect(result.current).toHaveProperty('renderUpward');
    expect(result.current).toHaveProperty('horizontalAlign');
  });

  it('should respect padding option', () => {
    const triggerRef = createMockRef({ 
      top: 100, 
      left: 10, 
      bottom: 130, 
      right: 110,
      width: 100 
    });
    
    const { result } = renderHook(() => 
      usePortalPosition(true, triggerRef, { 
        estimatedHeight: 200, 
        estimatedWidth: 400,
        padding: 50 
      })
    );

    // With padding of 50, left position should be at least 50
    expect(result.current.left).toBeGreaterThanOrEqual(50);
  });

  it('should set maxWidth to prevent overflow', () => {
    const triggerRef = createMockRef({ top: 100, left: 100, bottom: 130, right: 200 });
    
    const { result } = renderHook(() => 
      usePortalPosition(true, triggerRef, { 
        estimatedHeight: 200,
        estimatedWidth: 5000, // Impossibly wide
        padding: 16
      })
    );

    // maxWidth should be constrained by viewport
    expect(result.current.maxWidth).toBeLessThan(window.innerWidth);
  });

  it('should not calculate position when closed', () => {
    const triggerRef = createMockRef({ top: 100, left: 100, bottom: 130, right: 200 });
    
    const { result } = renderHook(() => 
      usePortalPosition(false, triggerRef, { estimatedHeight: 200 })
    );

    // Should return initial state
    expect(result.current.top).toBe(0);
    expect(result.current.left).toBe(0);
  });
});
