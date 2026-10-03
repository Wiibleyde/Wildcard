import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

type Size = "sm" | "md";

// md sits in the 220px sidebar at tablet width: fluid so the word never wraps.
const FONT_SIZE: Record<Size, string> = {
    sm: "26px",
    md: "clamp(28px, 2.6vw, 36px)",
};

/** Wordmark: bobbing Titan One letters, the first half in red ("WILD" + "CARD"). */
export function Brand({ size }: { size: Size }) {
    const t = useTranslations("home");
    const word = t("title").toUpperCase();
    const split = Math.ceil(word.length / 2);
    return (
        <Link
            href="/"
            aria-label={t("title")}
            className="wc-logo-word font-display leading-none whitespace-nowrap"
            style={{
                fontSize: FONT_SIZE[size],
                textShadow: "0 4px 0 rgba(0, 0, 0, 0.45)",
            }}
        >
            {[...word].map((ch, i) => (
                <span
                    // biome-ignore lint/suspicious/noArrayIndexKey: letters of a fixed word, never reordered
                    key={i}
                    aria-hidden="true"
                    style={
                        {
                            "--i": i,
                            color: i < split ? "var(--red)" : "var(--cream)",
                        } as React.CSSProperties
                    }
                >
                    {ch}
                </span>
            ))}
        </Link>
    );
}
