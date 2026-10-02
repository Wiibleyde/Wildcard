import type { CSSProperties, ReactNode } from "react";

const STAMP_STYLE: Record<"gold" | "blue", CSSProperties> = {
    gold: { background: "var(--gold)", color: "var(--ink)" },
    blue: { background: "var(--blue)", color: "var(--accent-ink)" },
};

/** Titled side panel of the game rail; `className` sets its share of the rail height. */
export function RailPanel({
    title,
    stamp,
    tone,
    className,
    children,
}: {
    title: string;
    stamp: string;
    tone: "gold" | "blue";
    className: string;
    children: ReactNode;
}) {
    return (
        <section
            className={`panel-d flex flex-col overflow-hidden p-3 lg:h-auto lg:min-h-0 lg:w-60 lg:self-stretch xl:w-72 xl:p-4 2xl:w-80 ${className}`}
            aria-label={title}
        >
            <div className="mb-2 flex items-center gap-2">
                <h2 className="font-display text-lg leading-none text-wc-cream">
                    {title}
                </h2>
                <span className="stamp" style={STAMP_STYLE[tone]}>
                    {stamp}
                </span>
            </div>
            {children}
        </section>
    );
}
