/**
 * Shared card sizing scale.
 *
 * `Card` has no intrinsic width: it derives its height from
 * `aspectRatio: 5 / 7` and scales every label with container-query units
 * (`cqi`), so the wrapper width is the single knob that controls how large a
 * card renders. Size cards through this scale instead of ad-hoc `w-*`
 * classes so they stay readable from mobile (375px) up to 2K screens.
 */
export type CardSize = "xs" | "sm" | "md" | "lg" | "xl";

/** Tailwind width classes per size — responsive from mobile to 2K. */
export const CARD_WIDTH_CLASS: Record<CardSize, string> = {
    /** Thumbnails — customization tiles, compact lists */
    xs: "w-12 xl:w-14",
    /** Opponent card backs, dense board zones */
    sm: "w-12 sm:w-14 xl:w-16 2xl:w-20",
    /** Cards on the table (play area) */
    md: "w-20 sm:w-24 xl:w-28 2xl:w-32",
    /** The viewer's hand */
    lg: "w-24 sm:w-28 xl:w-32 2xl:w-36",
    /** Hero / showcase displays */
    xl: "w-32 sm:w-40 xl:w-48 2xl:w-56",
};

/**
 * Negative-margin overlap matching each size (≈40% of the card width), for
 * fanned hands and opponent backs. Overlapping is what lets cards render
 * large without overflowing on small screens. Apply on each card wrapper
 * inside a plain (gapless) flex row.
 */
export const HAND_OVERLAP_CLASS: Record<CardSize, string> = {
    xs: "first:ml-0 -ml-5 xl:-ml-6",
    sm: "first:ml-0 -ml-5 sm:-ml-6 xl:-ml-7 2xl:-ml-8",
    md: "first:ml-0 -ml-8 sm:-ml-9 xl:-ml-11 2xl:-ml-12",
    lg: "first:ml-0 -ml-9 sm:-ml-11 xl:-ml-12 2xl:-ml-14",
    xl: "first:ml-0 -ml-12 sm:-ml-16 xl:-ml-20 2xl:-ml-24",
};
