"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Timer cleared on unmount so a fire after teardown can't touch unmounted state.
export function useTransientNotice<T>(): [
    T | null,
    (message: T, ms: number) => void,
] {
    const [message, setMessage] = useState<T | null>(null);
    const timer = useRef<number | null>(null);

    const clear = useCallback(() => {
        if (timer.current !== null) {
            clearTimeout(timer.current);
            timer.current = null;
        }
    }, []);

    const showNotice = useCallback(
        (next: T, ms: number) => {
            setMessage(next);
            clear();
            timer.current = window.setTimeout(() => {
                setMessage(null);
                timer.current = null;
            }, ms);
        },
        [clear],
    );

    useEffect(() => clear, [clear]);

    return [message, showNotice];
}
