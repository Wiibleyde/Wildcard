import type { CSSProperties } from "react";

type Props = {
    suit: string;
    style: CSSProperties;
};

export function DecoSuit({ suit, style }: Props) {
    return (
        <span
            className="absolute font-black leading-none select-none pointer-events-none"
            style={style}
            aria-hidden="true"
        >
            {suit}
        </span>
    );
}
