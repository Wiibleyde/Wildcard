"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "@/hooks/useFocusTrap";

export function Modal({
    open,
    onClose,
    closeLabel,
    labelledBy,
    label,
    role = "dialog",
    dismissible = true,
    className = "",
    children,
}: {
    open: boolean;
    onClose: () => void;
    /** Accessible name of the click-to-dismiss backdrop. */
    closeLabel: string;
    labelledBy?: string;
    label?: string;
    role?: "dialog" | "alertdialog";
    /** When false, Escape and backdrop clicks are ignored. */
    dismissible?: boolean;
    className?: string;
    children: ReactNode;
}) {
    const panelRef = useRef<HTMLDivElement>(null);
    useFocusTrap(open, panelRef);

    useEffect(() => {
        if (!open) return;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prevOverflow;
        };
    }, [open]);

    useEffect(() => {
        if (!open || !dismissible) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, dismissible, onClose]);

    if (!open || typeof document === "undefined") return null;

    return createPortal(
        <div
            className="wc-fade-in fixed inset-0 z-[1000] flex items-center justify-center p-4"
            style={{
                background: "rgba(10,26,46,0.8)",
                backdropFilter: "blur(3px)",
            }}
        >
            {/* A button rather than a clickable div: dismissable without breaking a11y or tab order. */}
            <button
                type="button"
                aria-label={closeLabel}
                tabIndex={-1}
                disabled={!dismissible}
                onClick={onClose}
                className="absolute inset-0 h-full w-full cursor-default"
            />
            {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: role is dialog or alertdialog, both modal-capable */}
            <div
                ref={panelRef}
                role={role}
                aria-modal="true"
                aria-labelledby={labelledBy}
                aria-label={labelledBy ? undefined : label}
                tabIndex={-1}
                className={`wc-pop-in relative w-full outline-none ${className}`}
            >
                {children}
            </div>
        </div>,
        document.body,
    );
}
