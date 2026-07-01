"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { GameButton, type GameButtonVariant } from "./GameButton";

export interface ConfirmDialogProps {
    open: boolean;
    title?: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    /** Use "red" for destructive actions. */
    variant?: GameButtonVariant;
    onConfirm: () => void;
    onCancel: () => void;
}

/**
 * Presentational confirmation modal; drive it through {@link useConfirm} or
 * mount directly with controlled `open`. Portals to `<body>` to escape any
 * clipped/transformed ancestor.
 */
export function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel,
    cancelLabel,
    variant = "gold",
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCancel();
        };
        document.addEventListener("keydown", onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        // Focus the panel, not the confirm button, so a destructive action
        // isn't one stray Enter away.
        panelRef.current?.focus();
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [open, onCancel]);

    if (!open || typeof document === "undefined") return null;

    return createPortal(
        <div
            className="wc-fade-in fixed inset-0 z-[1000] flex items-center justify-center p-4"
            style={{
                background: "rgba(10,26,46,0.72)",
                backdropFilter: "blur(2px)",
            }}
        >
            {/* Backdrop as a button: click-to-dismiss without an interactive
                <div> (a11y) and without stealing the tab order. */}
            <button
                type="button"
                aria-label={cancelLabel}
                tabIndex={-1}
                onClick={onCancel}
                className="absolute inset-0 h-full w-full cursor-default"
            />
            <div
                ref={panelRef}
                role="alertdialog"
                aria-modal="true"
                aria-label={title ?? message}
                tabIndex={-1}
                className="wc-pop-in relative flex w-full max-w-sm flex-col gap-4 rounded-2xl border-nb border-wc-ink bg-wc-panel-d p-6 text-center outline-none"
                style={{ boxShadow: "0 8px 0 var(--ink)" }}
            >
                {title && (
                    <h2 className="font-display text-xl text-wc-cream">
                        {title}
                    </h2>
                )}
                <p className="text-sm font-semibold text-wc-muted">{message}</p>
                <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
                    <GameButton variant="ghost" size="sm" onClick={onCancel}>
                        {cancelLabel}
                    </GameButton>
                    <GameButton variant={variant} size="sm" onClick={onConfirm}>
                        {confirmLabel}
                    </GameButton>
                </div>
            </div>
        </div>,
        document.body,
    );
}
