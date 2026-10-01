import type gsap from "gsap";

/**
 * Write `value` into an element's text without replacing React's Text node.
 *
 * Setting `el.textContent` swaps the child Text node for a new one, so React
 * keeps committing later updates to the detached original and the screen goes
 * stale. Mutating the existing node's `nodeValue` keeps React's handle valid:
 * the next commit simply overwrites what GSAP wrote.
 */
export function writeOwnedText(el: HTMLElement | null, value: string): void {
    if (!el) return;
    const node = el.firstChild;
    if (node && node.nodeType === Node.TEXT_NODE) {
        node.nodeValue = value;
    } else if (!node) {
        el.appendChild(document.createTextNode(value));
    }
}

/**
 * Count an integer up from `from` to `to` on a timeline by tweening a plain
 * proxy object and writing each step through {@link writeOwnedText}.
 */
export function tweenCount(
    tl: gsap.core.Timeline,
    el: HTMLElement | null,
    from: number,
    to: number,
    vars: { duration: number; ease?: string },
    position?: gsap.Position,
): void {
    const proxy = { value: from };
    writeOwnedText(el, String(from));
    tl.to(
        proxy,
        {
            value: to,
            duration: vars.duration,
            ease: vars.ease,
            onUpdate: () => writeOwnedText(el, String(Math.round(proxy.value))),
            onComplete: () => writeOwnedText(el, String(to)),
        },
        position,
    );
}
