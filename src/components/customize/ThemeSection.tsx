"use client";

import type { ReactNode } from "react";
import type { MutationStatus as Status } from "@/hooks/useApiMutation";
import { MutationStatus } from "./MutationStatus";

type Props = {
    glyph: string;
    label: string;
    status: Status;
    children: ReactNode;
};

export function ThemeSection({ glyph, label, status, children }: Props) {
    return (
        <div className="panel-d p-5">
            <h2 className="text-xl xl:text-2xl font-display mb-4 flex items-center gap-2 text-wc-cream">
                <span style={{ color: "var(--gold)" }}>{glyph}</span> {label}
                <MutationStatus status={status} />
            </h2>
            <div className="grid grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                {children}
            </div>
        </div>
    );
}
