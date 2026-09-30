/** Clipboard writes, in one place, so copy affordances behave identically. */
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

/** Copies and confirms with a light haptic. Returns false if the copy failed. */
export async function copyToClipboard(value: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(value);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    return true;
  } catch (error) {
    console.warn('Could not write to the clipboard', error);
    return false;
  }
}
