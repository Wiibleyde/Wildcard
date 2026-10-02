import type { ReactNode } from "react";

export function PanelTitle({ children }: { readonly children: ReactNode }) {
    return (
        <h2 className="font-display text-xl" style={{ color: "var(--ink)" }}>
            {children}
        </h2>
    );
}
