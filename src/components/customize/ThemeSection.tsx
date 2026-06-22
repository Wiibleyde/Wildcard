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
        <div
            className="rounded-xl p-6 border"
            style={{ background: "#1c1510", borderColor: "#3d2d18" }}
        >
            <h2
                className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2"
                style={{ color: "#7a6a50" }}
            >
                {glyph} {label}
                <MutationStatus status={status} />
            </h2>
            <div className="grid grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2">
                {children}
            </div>
        </div>
    );
}
