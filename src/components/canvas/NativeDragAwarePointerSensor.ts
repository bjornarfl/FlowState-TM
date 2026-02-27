import { PointerSensor } from '@dnd-kit/core';

/**
 * Custom PointerSensor that skips activation when the pointer target is inside
 * a native HTML5 draggable element (e.g. CanvasToolbar buttons with draggable="true").
 * This prevents dnd-kit from capturing pointer events that should start a native drag.
 */
export class NativeDragAwarePointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: ({ nativeEvent }: { nativeEvent: PointerEvent }) => {
        let el = nativeEvent.target as HTMLElement | null;
        while (el) {
          if (el.getAttribute?.('draggable') === 'true') return false;
          el = el.parentElement;
        }
        return true;
      },
    },
  ];
}
