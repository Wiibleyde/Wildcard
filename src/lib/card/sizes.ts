export type CardSize = "xs" | "sm" | "md" | "lg" | "xl";

// `Card` sizes itself from its wrapper width (aspect-ratio + cqi units), so
// this scale is the single knob; min/max keep it readable from 375px to 2K.
export const CARD_WIDTH_CLASS: Record<CardSize, string> = {
    xs: "w-12 xl:w-14 min-w-10 max-w-14",
    sm: "w-12 sm:w-14 xl:w-16 2xl:w-20 min-w-10 max-w-20",
    md: "w-20 sm:w-24 xl:w-28 2xl:w-32 min-w-16 max-w-32",
    lg: "w-24 sm:w-28 xl:w-32 2xl:w-36 min-w-20 max-w-36",
    xl: "w-32 sm:w-40 xl:w-48 2xl:w-56 min-w-28 max-w-56",
};

// Mobile-base widths (px) used as the layout estimate before a ResizeObserver measures.
export const CARD_PX_ESTIMATE: Record<CardSize, number> = {
    xs: 48,
    sm: 48,
    md: 80,
    lg: 96,
    xl: 128,
};
