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
    // Open on the final frame (the result), then let the viewer rewind.
    const [index, setIndex] = useState(last);
    const [playing, setPlaying] = useState(false);

    useEffect(() => {
        if (!playing) return;
        if (index >= last) {
            setPlaying(false);
            return;
        }
        const id = window.setTimeout(
            () => setIndex((i) => Math.min(i + 1, last)),
            intervalMs,
        );
        return () => window.clearTimeout(id);
    }, [playing, index, last, intervalMs]);

    const togglePlay = () => {
        if (!playing && index >= last) setIndex(0);
        setPlaying((p) => !p);
    };

    const step = (delta: number) => {
        setPlaying(false);
        setIndex((i) => Math.min(Math.max(i + delta, 0), last));
    };

    const seek = (frame: number) => {
        setPlaying(false);
        setIndex(Math.min(Math.max(frame, 0), last));
    };

    return { index, playing, togglePlay, step, seek };
}
