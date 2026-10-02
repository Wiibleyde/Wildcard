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
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: GameButtonVariant;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/** Themed `await confirm({...})` replacement for `window.confirm`. */
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

export function ConfirmProvider({ children }: { children: ReactNode }) {
    const t = useTranslations("common");
    const [state, setState] = useState<DialogState>({
        open: false,
        message: "",
    });
    const resolver = useRef<((result: boolean) => void) | null>(null);

    const confirm = useCallback<ConfirmFn>((options) => {
        return new Promise<boolean>((resolve) => {
            // One dialog at a time: settle the pending one so its promise never dangles.
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
