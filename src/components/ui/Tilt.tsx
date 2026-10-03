"use client";

import {
    type CSSProperties,
    type PointerEvent,
    type ReactNode,
    useRef,
} from "react";
import { cn } from "@/lib/utils";

interface Props {
    readonly children: ReactNode;
    /** Max rotation in degrees at the element's edge. */
    readonly strength?: number;
    /** Idle up-and-down sway (see `.wc-sway` in globals.css). */
    readonly sway?: boolean;
    /** Desynchronises neighbouring cards. */
    readonly swayDelay?: number;
    readonly className?: string;
}

const reducedMotion = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Leans its content toward the cursor. Writes CSS variables straight onto the
 * node (no re-render per pointer move); `--mx`/`--my` are exposed for sheen effects.
 */
export function Tilt({
    children,
    strength = 16,
    sway = false,
    swayDelay = 0,
    className,
}: Props) {
    const ref = useRef<HTMLDivElement>(null);

    function onMove(e: PointerEvent<HTMLDivElement>) {
        const el = ref.current;
        if (!el || e.pointerType !== "mouse" || reducedMotion()) return;
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        el.style.setProperty("--ry", `${((x - 0.5) * strength).toFixed(1)}deg`);
        el.style.setProperty("--rx", `${((0.5 - y) * strength).toFixed(1)}deg`);
        el.style.setProperty("--mx", `${(x * 100).toFixed(0)}%`);
        el.style.setProperty("--my", `${(y * 100).toFixed(0)}%`);
    }

    function onLeave() {
        ref.current?.style.setProperty("--rx", "0deg");
        ref.current?.style.setProperty("--ry", "0deg");
    }

    return (
        <div
            className={cn("block", sway && "wc-sway", className)}
            style={{ "--sway-delay": `${swayDelay}s` } as CSSProperties}
        >
            <div
                ref={ref}
                className="wc-tilt relative block"
                onPointerMove={onMove}
                onPointerLeave={onLeave}
            >
                {children}
            </div>
        </div>
    );
}
