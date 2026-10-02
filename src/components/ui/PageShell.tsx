import type { ReactNode } from "react";

const WIDTHS = {
    narrow: "max-w-lg lg:max-w-3xl xl:max-w-5xl 2xl:max-w-7xl",
    default: "max-w-lg lg:max-w-4xl xl:max-w-6xl 2xl:max-w-7xl",
    wide: "max-w-lg lg:max-w-5xl xl:max-w-7xl",
} as const;

export function PageShell({
    width = "default",
    className = "flex flex-col gap-6",
    children,
}: {
    width?: keyof typeof WIDTHS;
    /** Layout of the inner column; replaces the default flex stack. */
    className?: string;
    children: ReactNode;
}) {
    return (
        <div className="min-h-screen px-4 pt-6 pb-16 md:pt-10 xl:px-10">
            <div className={`mx-auto ${WIDTHS[width]} ${className}`}>
                {children}
            </div>
        </div>
    );
}
