import type { ReactNode } from "react";

/** One condition or effect line inside a rule card. */
export function StudioRow({ children }: { readonly children: ReactNode }) {
    return (
        <div className="well flex flex-col gap-2 p-2.5 sm:flex-row sm:items-center">
            {children}
        </div>
    );
}
