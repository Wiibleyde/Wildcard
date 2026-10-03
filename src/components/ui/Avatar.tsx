import {
    AvatarFallback,
    AvatarImage,
    Avatar as NbAvatar,
} from "@/components/nb/avatar";
import { cn } from "@/lib/utils";

function initialSizeClass(size: number): string {
    if (size >= 64) return "text-3xl";
    if (size >= 40) return "text-lg";
    if (size >= 34) return "text-sm";
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
                "overflow-hidden border-nb border-wc-ink outline-none",
                shadow && "shadow-shadow",
            )}
            style={{ width: size, height: size }}
        >
            {avatarUrl && (
                <AvatarImage
                    src={avatarUrl}
                    alt={name ?? ""}
                    className="object-cover"
                />
            )}
            <AvatarFallback
                className={cn(
                    "bg-wc-gold font-display text-wc-ink",
                    initialSizeClass(size),
                )}
            >
                {name?.[0]?.toUpperCase() ?? "?"}
            </AvatarFallback>
        </NbAvatar>
    );
}
