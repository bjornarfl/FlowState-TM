import { useEffect, RefObject } from 'react';

/**
 * Hook to detect clicks outside of a specified element.
 * Useful for closing dropdowns, modals, and other overlay components.
 * 
 * @param ref - Ref to the element to detect clicks outside of
 * @param handler - Callback to execute when click outside is detected
 * @param isActive - Whether the click detection is active
 * @param excludeSelectors - CSS selectors for elements to exclude from outside click detection
 * @param delay - Optional delay before attaching the event listener (default: 100ms)
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  handler: () => void,
  isActive: boolean,
  excludeSelectors: string[] = [],
  delay: number = 100
): void {
  useEffect(() => {
    if (!isActive) return;

    const handleClickOutside = (event: MouseEvent): void => {
      const target = event.target as HTMLElement;

      // Check if click is on an excluded element
      const isExcluded = excludeSelectors.some(selector => target.closest(selector));

      // Check if click is outside the ref element
      if (ref.current && !ref.current.contains(target) && !isExcluded) {
        handler();
      }
    };

    // Use a delay to allow other interactions to complete first
    const timeoutId = setTimeout(() => {
      // Listen to both mousedown and click events
      // mousedown catches most interactions, but click ensures we catch canvas/SVG elements
      document.addEventListener('mousedown', handleClickOutside, true);
      document.addEventListener('click', handleClickOutside, true);
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, [isActive, ref, handler, excludeSelectors, delay]);
}
