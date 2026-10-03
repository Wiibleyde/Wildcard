"use client";

import type { ReactNode } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/base/select";
import { cn } from "@/lib/utils";

export interface SelectOption {
    readonly value: string;
    readonly label: ReactNode;
}

/** Single-value string select; `className` styles the trigger. */
export function SelectField({
    id,
    value,
    onChange,
    options,
    ariaLabel,
    className,
}: {
    id?: string;
    value: string;
    onChange: (value: string) => void;
    options: readonly SelectOption[];
    ariaLabel?: string;
    className?: string;
}) {
    return (
        <Select
            id={id}
            value={value}
            items={options}
            onValueChange={(next) => {
                if (next !== null) onChange(next);
            }}
        >
            <SelectTrigger
                aria-label={ariaLabel}
                className={cn("h-auto font-semibold", className)}
            >
                <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-nb border-wc-edge bg-wc-panel-d text-wc-cream shadow-shadow">
                {options.map((option) => (
                    <SelectItem
                        key={option.value}
                        value={option.value}
                        className="font-semibold data-highlighted:bg-wc-gold"
                    >
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
