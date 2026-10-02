import type { ReactNode } from "react";

export function StudioRow({ children }: { readonly children: ReactNode }) {
    return (
        <div
            className="flex flex-col gap-2 rounded-xl p-2.5 sm:flex-row sm:items-center"
            style={{
                background: "var(--cream)",
                border: "2px solid var(--ink)",
            }}
        >
            {children}
        </div>
    );
}
