import {
    AvatarFallback,
    AvatarImage,
    Avatar as NbAvatar,
} from "@/components/ui/base/avatar";
import { cn } from "@/lib/utils";

// Initials sit on a palette colour picked from the name, so a player keeps the same colour everywhere.
const FALLBACK_COLORS = [
    "var(--red)",
    "var(--blue)",
    "var(--green)",
    "var(--purple)",
    "var(--orange)",
    "var(--gold-d)",
] as const;

function colorFor(name: string | null): string {
    let h = 0;
    for (const ch of name ?? "") h = (h * 31 + ch.charCodeAt(0)) | 0;
    return FALLBACK_COLORS[Math.abs(h) % FALLBACK_COLORS.length];
}

function initialSizeClass(size: number): string {
    if (size >= 96) return "text-5xl";
    if (size >= 64) return "text-3xl";
    if (size >= 40) return "text-lg";
    if (size >= 28) return "text-sm";
    return "text-xs";
}

export function Avatar({
    name,
    avatarUrl = null,
    size,
    shadow = false,
}: {
    name: string | null;
    avatarUrl?: string | null;
    size: number;
    shadow?: boolean;
}) {
    return (
        <NbAvatar
            className={cn(
                "overflow-hidden rounded-[28%] border-0 outline-none",
                shadow && "shadow-shadow",
            )}
            style={{ width: size, height: size, flex: "none" }}
        >
            {avatarUrl && (
                <AvatarImage
                    src={avatarUrl}
                    alt={name ?? ""}
                    className="rounded-[28%] object-cover"
                />
            )}
            <AvatarFallback
                className={cn(
                    "rounded-[28%] font-display text-white text-shadow shadow-[inset_0_-3px_0_rgba(0,0,0,0.25)]",
                    initialSizeClass(size),
                )}
                style={{ background: colorFor(name) }}
            >
                {name?.[0]?.toUpperCase() ?? "?"}
            </AvatarFallback>
        </NbAvatar>
    );
}
