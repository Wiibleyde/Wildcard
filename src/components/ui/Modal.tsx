"use client";

import type { ReactNode } from "react";
import { Dialog, DialogContent } from "@/components/nb/dialog";

export function Modal({
    open,
    onClose,
    labelledBy,
    label,
    dismissible = true,
    className,
    children,
}: {
    open: boolean;
    onClose: () => void;
    labelledBy?: string;
    label?: string;
    /** When false, Escape and backdrop clicks are ignored. */
    dismissible?: boolean;
    className?: string;
    children: ReactNode;
}) {
    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next && dismissible) onClose();
            }}
        >
            <DialogContent
                aria-labelledby={labelledBy}
                aria-label={labelledBy ? undefined : label}
                className={className}
            >
                {children}
            </DialogContent>
        </Dialog>
    );
}
