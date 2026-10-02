"use client";

import { useEffect, useState } from "react";

interface ReplayPlayback {
    index: number;
    playing: boolean;
    /** Pressing play at the end restarts from the deal. */
    togglePlay: () => void;
    step: (delta: number) => void;
    seek: (frame: number) => void;
}

export function useReplayPlayback(
    last: number,
    intervalMs: number,
): ReplayPlayback {
    // Opens on the result; the viewer rewinds from there.
    const [index, setIndex] = useState(last);
    const [wantsPlay, setWantsPlay] = useState(false);
    const playing = wantsPlay && index < last;

    useEffect(() => {
        if (!playing) return;
        const id = window.setInterval(
            () => setIndex((i) => Math.min(i + 1, last)),
            intervalMs,
        );
        return () => window.clearInterval(id);
    }, [playing, last, intervalMs]);

    const togglePlay = () => {
        if (!playing && index >= last) setIndex(0);
        setWantsPlay(!playing);
    };

    const step = (delta: number) => {
        setWantsPlay(false);
        setIndex((i) => Math.min(Math.max(i + delta, 0), last));
    };

    const seek = (frame: number) => {
        setWantsPlay(false);
        setIndex(Math.min(Math.max(frame, 0), last));
    };

    return { index, playing, togglePlay, step, seek };
}
