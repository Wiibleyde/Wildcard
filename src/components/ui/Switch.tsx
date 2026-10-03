"use client";

import type { CSSProperties } from "react";
import { Switch as NbSwitch } from "@/components/ui/base/switch";

export function Switch({
    checked,
    onChange,
    label,
    disabled = false,
    onColor = "var(--green)",
}: {
    checked: boolean;
    onChange: (next: boolean) => void;
    label: string;
    disabled?: boolean;
    onColor?: string;
}) {
    return (
        <NbSwitch
            checked={checked}
            onCheckedChange={onChange}
            aria-label={label}
            disabled={disabled}
            style={{ "--main": onColor } as CSSProperties}
        />
    );
}
