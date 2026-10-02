import type gsap from "gsap";

// Mutates the existing Text node: replacing it via `textContent` would leave
// React committing later updates to a detached node.
export function writeOwnedText(el: HTMLElement | null, value: string): void {
    if (!el) return;
    const node = el.firstChild;
    if (node && node.nodeType === Node.TEXT_NODE) {
        node.nodeValue = value;
    } else if (!node) {
        el.appendChild(document.createTextNode(value));
    }
}

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
