"use client";

import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogTitle,
} from "@/components/ui/base/alert-dialog";
import {
    GameButton,
    type GameButtonVariant,
    gameButtonClass,
} from "./GameButton";

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
        <AlertDialog
            open={open}
            onOpenChange={(next) => {
                if (!next) onCancel();
            }}
        >
            <AlertDialogContent
                size="sm"
                aria-label={title ? undefined : message}
                className="flex flex-col gap-4 bg-wc-panel-d text-center text-wc-cream"
            >
                {title && (
                    <AlertDialogTitle className="font-display text-xl text-wc-cream">
                        {title}
                    </AlertDialogTitle>
                )}
                <AlertDialogDescription className="text-sm font-semibold text-wc-muted">
                    {message}
                </AlertDialogDescription>
                <AlertDialogFooter className="mt-2 sm:justify-center">
                    <AlertDialogCancel
                        className={gameButtonClass("ghost", "sm")}
                    >
                        {cancelLabel}
                    </AlertDialogCancel>
                    {/* Not an AlertDialog.Close: confirming must not also fire onCancel. */}
                    <GameButton variant={variant} size="sm" onClick={onConfirm}>
                        {confirmLabel}
                    </GameButton>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
