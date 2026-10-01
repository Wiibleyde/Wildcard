"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";
import { tweenCount } from "@/lib/gsap/textTween";

gsap.registerPlugin(useGSAP);

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

            // Tween a proxy and write into React's own Text node — animating
            // `textContent` would detach it and freeze later updates.
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
