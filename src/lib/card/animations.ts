import { gsap } from "@/lib/gsap";
import type { PlayAnimationRef, PlayAnimationTemplateId } from "./types";

export type PlayOrigin = "self" | "opponent";

export interface PlayAnimationContext {
    origin: PlayOrigin;
    duration?: number;
}

// Decks reference a template by id only, so JSON-stored studio decks can pick one too.
export interface PlayAnimationTemplate {
    readonly id: PlayAnimationTemplateId;
    animate(el: HTMLElement, ctx: PlayAnimationContext): gsap.core.Animation;
}

function direction(origin: PlayOrigin): number {
    return origin === "self" ? 1 : -1;
}

const simple: PlayAnimationTemplate = {
    id: "simple",
    animate: (el, ctx) =>
        gsap.from(el, {
            y: direction(ctx.origin) * 48,
            opacity: 0,
            scale: 0.92,
            duration: ctx.duration ?? 0.35,
            ease: "power2.out",
        }),
};

const flip: PlayAnimationTemplate = {
    id: "flip",
    animate: (el, ctx) =>
        gsap.from(el, {
            y: direction(ctx.origin) * 36,
            rotationY: direction(ctx.origin) * -120,
            opacity: 0,
            transformPerspective: 640,
            duration: ctx.duration ?? 0.5,
            ease: "back.out(1.4)",
        }),
};

const arc: PlayAnimationTemplate = {
    id: "arc",
    animate: (el, ctx) => {
        const dir = direction(ctx.origin);
        const duration = ctx.duration ?? 0.55;
        return gsap
            .timeline()
            .from(el, {
                x: dir * 80,
                y: dir * 90,
                rotation: dir * 24,
                scale: 1.1,
                opacity: 0,
                duration: duration * 0.7,
                ease: "power3.out",
            })
            .to(el, {
                y: dir * -6,
                duration: duration * 0.15,
                ease: "power1.out",
            })
            .to(el, { y: 0, duration: duration * 0.15, ease: "power1.in" });
    },
};

export const PLAY_ANIMATIONS: Record<
    PlayAnimationTemplateId,
    PlayAnimationTemplate
> = {
    simple,
    flip,
    arc,
};

export const DEFAULT_PLAY_ANIMATION: PlayAnimationTemplateId = "simple";

// Unknown ids from JSON-stored studio decks fall back too, so a bad deck can't break the table.
export function getPlayAnimation(
    ref: PlayAnimationRef | undefined,
): PlayAnimationTemplate {
    return (
        PLAY_ANIMATIONS[ref?.template ?? DEFAULT_PLAY_ANIMATION] ??
        PLAY_ANIMATIONS[DEFAULT_PLAY_ANIMATION]
    );
}

export function prefersReducedMotion(): boolean {
    return (
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
}
