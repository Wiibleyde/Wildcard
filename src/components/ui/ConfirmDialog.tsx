"use client";

import { GameButton, type GameButtonVariant } from "./GameButton";
import { Modal } from "./Modal";

export interface ConfirmDialogProps {
    open: boolean;
    title?: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    variant?: GameButtonVariant;
    onConfirm: () => void;
    onCancel: () => void;
}

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
    return (
        <Modal
            open={open}
            onClose={onCancel}
            closeLabel={cancelLabel}
            role="alertdialog"
            label={title ?? message}
            className="flex max-w-sm flex-col gap-4 rounded-2xl border-nb border-wc-ink bg-wc-panel-d p-6 text-center shadow-[0_8px_0_var(--ink)]"
        >
            {title && (
                <h2 className="font-display text-xl text-wc-cream">{title}</h2>
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
        </Modal>
    );
}
