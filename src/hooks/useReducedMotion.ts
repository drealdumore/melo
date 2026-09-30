/**
 * Tracks the OS "Reduce Motion" setting.
 *
 * This is not a courtesy check — Melo's rule is that reduced motion means
 * transforms become plain fades, which is a different animation, not a faster
 * one. Components branch on this; the Reanimated configs handle the rest.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // The platform is the source of truth, so the read lands in a callback.
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setReduced(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      if (!cancelled) setReduced(enabled);
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return reduced;
}
