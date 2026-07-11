import { Link } from "@/i18n/navigation";

type Size = "sm" | "md";

const LOGO = {
    sm: { box: 34, glyph: 20, word: 22 },
    md: { box: 40, glyph: 24, word: 25 },
} as const;

export function Brand({ size }: { size: Size }) {
    const s = LOGO[size];
    return (
        <Link href="/" className="flex items-center gap-2.75">
            <span
                className="wc-logo-mark shrink-0 rounded-wc-icon"
                style={{
                    width: s.box,
                    height: s.box,
                    fontSize: s.glyph,
                }}
            >
                ♣
            </span>
            <span
                className="font-display leading-none"
                style={{
                    color: "var(--cream)",
                    fontSize: s.word,
                    letterSpacing: "0.01em",
                }}
            >
                Wildcard
            </span>
        </Link>
    );
}
