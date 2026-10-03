import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge the custom theme tokens, so e.g. `font-display` does not
// evict `font-base` (weight) as if both were font families.
const twMerge = extendTailwindMerge({
    extend: {
        theme: {
            font: ["base", "heading"],
            radius: ["base", "wc-btn", "wc-panel", "wc-card", "wc-icon"],
            shadow: ["shadow"],
            text: ["wc-micro", "wc-label", "wc-tag"],
        },
        classGroups: {
            "font-family": [{ font: ["display", "pixel"] }],
            "border-w": [{ border: ["nb"] }],
        },
    },
});

export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
}
