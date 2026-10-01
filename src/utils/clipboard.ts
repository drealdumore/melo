/** Clipboard writes, in one place, so copy affordances behave identically. */
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

import { createLogger } from '@/services/logger';

const log = createLogger('clipboard');

/** Copies and confirms with a light haptic. Returns false if the copy failed. */
export async function copyToClipboard(value: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(value);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // The length, never the value: this is called with Melo IDs, invite codes
    // and sometimes a person's name, and none of that belongs in a log.
    log.debug('copied to the clipboard', { chars: value.length });
    return true;
  } catch (error) {
    // The caller shows a "couldn't copy" toast, so the user is told. This line
    // is for the case where the copy silently never lands anywhere.
    log.warn('could not write to the clipboard', error);
    return false;
  }
}
