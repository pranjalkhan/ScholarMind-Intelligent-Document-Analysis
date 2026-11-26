import { useCallback, useRef } from "react";

/**
 * Tracks the pointer inside an element and exposes its position as the
 * `--spot-x` / `--spot-y` CSS variables used by `.panel-interactive`.
 */
export function useSpotlight<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  const onPointerMove = useCallback((event: React.PointerEvent<T>) => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    node.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    node.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  }, []);

  const onPointerLeave = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    node.style.setProperty("--spot-x", "50%");
    node.style.setProperty("--spot-y", "0%");
  }, []);

  return { ref, onPointerMove, onPointerLeave };
}
