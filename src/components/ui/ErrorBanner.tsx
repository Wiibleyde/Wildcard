import type { ReactNode } from "react";

export function ErrorBanner({
    children,
    className = "",
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <p
            role="alert"
            className={`rounded-xl border-nb border-wc-ink bg-wc-red px-4 py-3 text-sm font-bold text-wc-accent-ink ${className}`}
            style={{ boxShadow: "0 4px 0 var(--ink)" }}
        >
            {children}
        </p>
    );
}
