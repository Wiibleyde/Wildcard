"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, readApiError } from "@/lib/api/client";

export type MutationStatus = "idle" | "pending" | "success" | "error";

interface Options {
    method?: "POST" | "PATCH" | "PUT" | "DELETE";
    /** ms to stay in "success" before auto-resetting to "idle". 0 = no auto-reset. */
    successDuration?: number;
}

export interface MutationHandle<TBody> {
    status: MutationStatus;
    error: string | null;
    mutate: (body: TBody) => Promise<boolean>;
    /** Synchronous: true from the `mutate` call until it settles, even before a re-render. */
    isPending: () => boolean;
    reset: () => void;
}

export function useApiMutation<TBody = unknown>(
    url: `/api/${string}`,
    options: Options = {},
): MutationHandle<TBody> {
    const { method = "PATCH", successDuration = 0 } = options;
    const [status, setStatus] = useState<MutationStatus>("idle");
    const [error, setError] = useState<string | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // `status` from the render closure is stale for a second call fired before the re-render.
    const pendingRef = useRef(false);

    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    useEffect(() => clearTimer, [clearTimer]);

    const reset = useCallback(() => {
        clearTimer();
        setStatus("idle");
        setError(null);
    }, [clearTimer]);

    const mutate = useCallback(
        async (body: TBody): Promise<boolean> => {
            if (pendingRef.current) return false;
            pendingRef.current = true;
            clearTimer();

            setStatus("pending");
            setError(null);

            try {
                const res = await apiFetch(url, {
                    method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });

                if (!res.ok) {
                    setError((await readApiError(res)) ?? "error");
                    setStatus("error");
                    return false;
                }

                setStatus("success");
                if (successDuration > 0) {
                    timerRef.current = setTimeout(
                        () => setStatus("idle"),
                        successDuration,
                    );
                }
                return true;
            } catch {
                setError("error");
                setStatus("error");
                return false;
            } finally {
                pendingRef.current = false;
            }
        },
        [url, method, successDuration, clearTimer],
    );

    const isPending = useCallback(() => pendingRef.current, []);

    return { status, error, mutate, isPending, reset };
}
