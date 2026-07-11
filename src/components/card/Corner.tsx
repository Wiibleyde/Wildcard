import type { ReactElement } from "react";
import type { CardTheme } from "@/lib/card/types";

interface CornerProps {
    label: string | ReactElement;
    sub?: string | ReactElement;
    color: string;
    font?: CardTheme["font"];
    flipped?: boolean;
}

export function Corner({
    label,
    sub,
    color,
    font,
    flipped = false,
}: CornerProps) {
    return (
        <div
            className={`absolute flex flex-col items-center${flipped ? " rotate-180" : ""}`}
            style={{
                ...(flipped
                    ? { bottom: "3%", right: "5%" }
                    : { top: "3%", left: "5%" }),
                color,
                lineHeight: 1.05,
            }}
        >
            <span
                style={{
                    fontSize: "18cqi",
                    fontWeight: font?.rankWeight ?? 800,
                    fontStyle: font?.rankItalic ? "italic" : undefined,
                    ...font?.rankStyle,
                }}
            >
                {label}
            </span>
            {sub !== undefined && (
                <span style={{ fontSize: "14cqi" }}>{sub}</span>
            )}
        </div>
    );
}
