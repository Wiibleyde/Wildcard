import type { CSSProperties } from "react";

/**
 * Shared neobrutalism form-control skin for the Studio editor — the
 * ProfileForm / MatchHistoryClient input pattern, on cream panels (hence the
 * deeper cream2 fill for contrast).
 */

export const fieldClass =
    "rounded-lg px-2.5 py-2 text-sm font-semibold outline-none";

export const fieldStyle: CSSProperties = {
    background: "var(--cream2)",
    border: "2.5px solid var(--ink)",
    color: "var(--ink)",
};

/** Uppercase pixel-ish field label, dark-on-cream. */
export const labelClass = "text-xs font-bold uppercase tracking-widest";

export const labelStyle: CSSProperties = { color: "#5a5340" };

/** Small square icon button (move / remove rows). */
export const squareButtonClass =
    "wc-iconbtn grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-bold disabled:opacity-40";

export const squareButtonStyle: CSSProperties = {
    background: "var(--cream2)",
    border: "2px solid var(--ink)",
    boxShadow: "0 2px 0 var(--ink)",
    color: "var(--ink)",
};

export const dangerButtonStyle: CSSProperties = {
    background: "var(--red)",
    border: "2px solid var(--ink)",
    boxShadow: "0 2px 0 var(--ink)",
    color: "var(--accent-ink)",
};
