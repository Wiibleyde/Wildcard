import Image from "next/image";

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
        <div
            className="relative shrink-0 overflow-hidden rounded-full border-nb border-wc-ink"
            style={{
                width: size,
                height: size,
                boxShadow: shadow ? "0 4px 0 var(--ink)" : undefined,
            }}
        >
            {avatarUrl ? (
                <Image
                    src={avatarUrl}
                    alt={name ?? ""}
                    fill
                    sizes={`${size}px`}
                    className="object-cover"
                    loading="eager"
                    unoptimized
                />
            ) : (
                <div
                    className={`flex h-full w-full items-center justify-center bg-wc-gold font-display text-wc-ink ${initialSizeClass(size)}`}
                >
                    {name?.[0]?.toUpperCase() ?? "?"}
                </div>
            )}
        </div>
    );
}
