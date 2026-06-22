"use client";

import { useCallback, useRef, useState } from "react";

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
    reset: () => void;
}

export function useApiMutation<TBody = unknown>(
    url: string,
    options: Options = {},
): MutationHandle<TBody> {
    const { method = "PATCH", successDuration = 0 } = options;
    const [status, setStatus] = useState<MutationStatus>("idle");
    const [error, setError] = useState<string | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const reset = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setStatus("idle");
        setError(null);
    }, []);

    const mutate = useCallback(
        async (body: TBody): Promise<boolean> => {
            if (status === "pending") return false;
            if (timerRef.current) clearTimeout(timerRef.current);

            setStatus("pending");
            setError(null);

            try {
                const res = await fetch(url, {
                    method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });

                if (!res.ok) {
                    const data = (await res.json().catch(() => ({}))) as {
                        error?: string;
                    };
                    setError(data.error ?? "error");
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
            }
        },
        [url, method, status, successDuration],
    );

    return { status, error, mutate, reset };
}
