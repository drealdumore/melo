/**
 * A 4pt grid. `screenPadding` is 20pt, per spec.
 */

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const screenPadding = spacing.xl;

/**
 * Safe-area padding, consumed through `useScreenInsets` rather than raw insets.
 *
 * `headerGap` is added to `insets.top`; `footerGap` is a floor for `insets.bottom`,
 * because a home indicator is already generous and summing pushes pinned bars too far
 * from the edge. See the hook for why the two edges differ.
 */
export const headerGap = spacing.sm;
export const footerGap = spacing.md;

export const radii = {
  /** Message bubbles; the tail-side bottom corner tightens to `bubbleTail`. */
  bubble: 22,
  bubbleTail: 8,
  /** Primary buttons, the composer, chips. Fully rounded. */
  pill: 999,
  /** Language and list rows. */
  row: 18,
  /** Input fields. */
  input: 20,
  /** The Connect field. */
  inputDashed: 22,
  /** Cards, including the Melo ID card. */
  card: 26,
  /** Small speech bubbles such as the mascot's. */
  speech: 18,
  speechTail: 5,
} as const;

/** Minimum touch target per Apple HIG / Material. */
export const hitSize = 44;

/** Standard header buttons, avatar sizes, and other fixed circles. */
export const sizes = {
  headerButton: 38,
  headerAvatar: 40,
  listAvatar: 46,
  rowAvatar: 42,
  sendButton: 40,
  primaryButton: 54,
  progressBar: 5,
  mascot: { width: 58, height: 54 },
} as const;
