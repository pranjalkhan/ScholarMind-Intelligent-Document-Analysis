import { useCallback, useEffect, useRef, useState } from "react";

const RESET_MS = 1600;

/**
 * Copies text to the clipboard and exposes a short-lived `copied` flag so
 * buttons can flash a confirmation.
 */
export function useClipboard() {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopied(false), RESET_MS);
      return true;
    } catch {
      return false;
    }
  }, []);

  return { copied, copy };
}
