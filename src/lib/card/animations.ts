import gsap from "gsap";
import type { PlayAnimationRef, PlayAnimationTemplateId } from "./types";

/** Where the played card came from, relative to the table center. */
export type PlayOrigin = "self" | "opponent";

export interface PlayAnimationContext {
    /** Drives the entry direction — `self` cards rise from the hand (bottom). */
    origin: PlayOrigin;
    /** Seconds — theme override of the template default. */
    duration?: number;
}

/**
 * A reusable entry animation for a card landing on the table.
 *
 * Templates are pure functions of a DOM element + context: decks (including
 * future ECA/studio decks stored as JSON) only reference a template id via
 * `CardTheme.playAnimation`, never animation code — see {@link PLAY_ANIMATIONS}.
 */
export interface PlayAnimationTemplate {
    readonly id: PlayAnimationTemplateId;
    /** Display name for customization / studio UIs */
    readonly name: string;
    /** Build and start the entry tween. Caller owns the element. */
    animate(el: HTMLElement, ctx: PlayAnimationContext): gsap.core.Animation;
}

function direction(origin: PlayOrigin): number {
    return origin === "self" ? 1 : -1;
}

/** Default — short slide from the owner's side with a fade-in. */
const simple: PlayAnimationTemplate = {
    id: "simple",
    name: "Simple",
    animate: (el, ctx) =>
        gsap.from(el, {
            y: direction(ctx.origin) * 48,
            opacity: 0,
            scale: 0.92,
            duration: ctx.duration ?? 0.35,
            ease: "power2.out",
        }),
};

/** The card turns over in 3D while sliding in, as if flipped onto the table. */
const flip: PlayAnimationTemplate = {
    id: "flip",
    name: "Flip",
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

/** Thrown in a curve from the owner's side, with a small landing hop. */
const arc: PlayAnimationTemplate = {
    id: "arc",
    name: "Arc",
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

/** Registry of every play-animation template, keyed by id. */
export const PLAY_ANIMATIONS: Record<
    PlayAnimationTemplateId,
    PlayAnimationTemplate
> = {
    simple,
    flip,
    arc,
};

export const DEFAULT_PLAY_ANIMATION: PlayAnimationTemplateId = "simple";

/**
 * Resolve a deck's animation pick. Missing refs — and unknown template ids
 * coming from JSON-stored studio decks — fall back to the default template,
 * so a bad deck definition can never break the table.
 */
export function getPlayAnimation(
    ref: PlayAnimationRef | undefined,
): PlayAnimationTemplate {
    return (
        PLAY_ANIMATIONS[ref?.template ?? DEFAULT_PLAY_ANIMATION] ??
        PLAY_ANIMATIONS[DEFAULT_PLAY_ANIMATION]
    );
}

/** True when the OS asks for minimal motion — callers should skip tweens. */
export function prefersReducedMotion(): boolean {
    return (
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
}
