import type { CSSProperties } from "react";

/** Shared color palette for the admin panels. */
export const ADMIN = {
    text: "#faf2e2",
    textMuted: "#7a6a50",
    textSubtle: "#9a8870",
    danger: "#e04040",
    success: "#48c97a",
    border: "#2a1e0f",
} as const;

/** Green status pill / link styling, reused across admin panels. */
export const statusPillStyle: CSSProperties = {
    background: "rgba(72,201,122,0.15)",
    color: ADMIN.success,
    border: "1px solid rgba(72,201,122,0.25)",
};
