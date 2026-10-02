"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { tweenCount } from "@/lib/gsap/textTween";

export function useXPBarAnimation(xp: number, progress: number) {
    const containerRef = useRef<HTMLDivElement>(null);
    const barRef = useRef<HTMLDivElement>(null);
    const xpNumRef = useRef<HTMLSpanElement>(null);

    useGSAP(
        () => {
            const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

            tl.from(containerRef.current, {
                y: 16,
                opacity: 0,
                duration: 0.55,
            });

            tl.fromTo(
                barRef.current,
                { width: "0%" },
                {
                    width: `${progress * 100}%`,
                    duration: 1.1,
                    ease: "power2.out",
                },
                "-=0.2",
            );

            // Animating `textContent` would detach React's Text node and freeze later updates.
            tweenCount(
                tl,
                xpNumRef.current,
                0,
                xp,
                { duration: 0.9, ease: "power1.out" },
                "<",
            );
        },
        { scope: containerRef, dependencies: [xp] },
    );

    return { containerRef, barRef, xpNumRef };
}
