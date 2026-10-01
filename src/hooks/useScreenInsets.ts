
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';

import { footerGap, headerGap } from '@/theme/layout';

export interface ScreenInsets extends EdgeInsets {
  /** `paddingTop` for a top header: clears the status bar, then `headerGap`. */
  headerTop: number;
  /** `paddingBottom` for a pinned bar: clears the home indicator, minimum `footerGap`. */
  footerBottom: number;
}

export function useScreenInsets(): ScreenInsets {
  const insets = useSafeAreaInsets();

  return {
    ...insets,
    headerTop: insets.top + headerGap,
    footerBottom: Math.max(insets.bottom, footerGap),
  };
}