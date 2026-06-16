"use client";

import { useTranslations } from "next-intl";
import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useRef,
    useState,
} from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import type { GameButtonVariant } from "./GameButton";

export interface ConfirmOptions {
    title?: string;
    message: string;
    /** Defaults to the localized "Confirm" from the `common` namespace. */
    confirmLabel?: string;
    /** Defaults to the localized "Cancel" from the `common` namespace. */
    cancelLabel?: string;
    /** Colour of the confirm button — pass "red" for destructive actions. */
    variant?: GameButtonVariant;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Imperative confirmation, a themed drop-in for `window.confirm`:
 *
 * ```ts
 * const confirm = useConfirm();
 * if (await confirm({ message: t("leave_confirm"), variant: "red" })) {
 *     // confirmed
 * }
 * ```
 */
export function useConfirm(): ConfirmFn {
    const ctx = useContext(ConfirmContext);
    if (!ctx) {
        throw new Error("useConfirm must be used within <ConfirmProvider>");
    }
    return ctx;
}

interface DialogState extends ConfirmOptions {
    open: boolean;
}

/**
 * Holds the single dialog instance for the whole app and exposes
 * {@link useConfirm}. Mount once near the root, inside the i18n provider.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
    const t = useTranslations("common");
    const [state, setState] = useState<DialogState>({
        open: false,
        message: "",
    });
    const resolver = useRef<((result: boolean) => void) | null>(null);

    const confirm = useCallback<ConfirmFn>((options) => {
        return new Promise<boolean>((resolve) => {
            // Only one dialog at a time — a new request cancels any pending one
            // so its promise never dangles.
            resolver.current?.(false);
            resolver.current = resolve;
            setState({ ...options, open: true });
        });
    }, []);

    const settle = useCallback((result: boolean) => {
        resolver.current?.(result);
        resolver.current = null;
        setState((s) => ({ ...s, open: false }));
    }, []);

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            <ConfirmDialog
                open={state.open}
                title={state.title}
                message={state.message}
                confirmLabel={state.confirmLabel ?? t("confirm")}
                cancelLabel={state.cancelLabel ?? t("cancel")}
                variant={state.variant}
                onConfirm={() => settle(true)}
                onCancel={() => settle(false)}
            />
        </ConfirmContext.Provider>
    );
}
