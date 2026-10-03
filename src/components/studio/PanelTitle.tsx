import type { ReactNode } from "react";

export function PanelTitle({ children }: { readonly children: ReactNode }) {
    return <h2 className="h-lg">{children}</h2>;
}
