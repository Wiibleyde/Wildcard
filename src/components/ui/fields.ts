/** Skin for base `Input` / `Textarea` / `SelectField`: a dark well with an edge that lights up on focus. */
export const fieldClass =
    "h-auto rounded-[10px] border-nb border-wc-edge bg-wc-panel-d2 px-3 py-2.5 text-sm font-semibold text-wc-cream placeholder:text-wc-sub focus-visible:border-wc-blue focus-visible:ring-0";

export const fieldLabelClass =
    "text-xs font-bold uppercase tracking-widest text-wc-muted";

/** Small square press button (reorder arrows, steppers). */
export const iconButtonClass =
    "wc-iconbtn grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-wc-panel-d2 text-sm font-bold text-wc-cream [--press:#110c17] disabled:opacity-40";

/** Same, for destructive actions (remove a row). */
export const dangerIconButtonClass =
    "wc-iconbtn grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-wc-red text-sm font-bold text-white [--press:var(--red-d)] disabled:opacity-40";
