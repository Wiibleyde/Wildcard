import { Link } from "@/i18n/navigation";
import { GOLD_GRADIENT } from "@/lib/ui/brand";

type Size = "sm" | "md";

const LOGO = {
    sm: {
        box: "w-8 h-8 rounded-xl text-sm",
        word: "text-sm",
        suit: "text-[9px]",
    },
    md: {
        box: "w-10 h-10 rounded-xl text-lg",
        word: "text-base",
        suit: "text-[10px]",
    },
} as const;

const LOGO_SHADOW = {
    sm: "0 0 12px rgba(245,197,22,0.25)",
    md: "0 0 20px rgba(245,197,22,0.25), 0 3px 0 0 #7a5a00",
} as const;

export function Brand({ size }: { size: Size }) {
    const s = LOGO[size];
    return (
        <Link href="/" className="flex items-center gap-2.5">
            <div
                className={`${s.box} flex items-center justify-center font-black shrink-0`}
                style={{
                    background: GOLD_GRADIENT,
                    color: "#0d0a05",
                    boxShadow: LOGO_SHADOW[size],
                }}
            >
                W
            </div>
            <div className="min-w-0">
                <p
                    className={`font-display font-extrabold ${s.word} leading-none tracking-tight`}
                    style={{ color: "#faf2e2" }}
                >
                    Wildcard
                </p>
                <p
                    className={`${s.suit} font-bold tracking-[0.2em] uppercase`}
                    style={{ color: "#7a6a50" }}
                >
                    ♠ ♥ ♦ ♣
                </p>
            </div>
        </Link>
    );
}
