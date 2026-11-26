import { useEffect, useRef } from "react";

/**
 * Pins a scroll container to its newest content whenever `trigger` changes,
 * but only while the reader is already near the bottom (so scrolling up to
 * read an older answer is never yanked away).
 */
export function useAutoScroll<T extends HTMLElement>(trigger: unknown) {
  const ref = useRef<T | null>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const onScroll = () => {
      const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
      stickToBottom.current = distance < 120;
    };

    node.addEventListener("scroll", onScroll, { passive: true });
    return () => node.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node || !stickToBottom.current) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [trigger]);

  return ref;
}
