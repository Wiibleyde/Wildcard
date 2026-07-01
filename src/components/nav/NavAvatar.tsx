import Image from "next/image";

type Props = {
    avatarUrl: string | null;
    initial: string;
    username: string | null;
    sizePx: number;
    initialClassName: string;
};

// Neobrutalism avatar — flat disc, thick ink ring, chunky display initial.
export function NavAvatar({
    avatarUrl,
    initial,
    username,
    sizePx,
    initialClassName,
}: Props) {
    return (
        <div
            className="relative shrink-0 overflow-hidden rounded-full"
            style={{
                width: sizePx,
                height: sizePx,
                border: "2.5px solid var(--ink)",
            }}
        >
            {avatarUrl ? (
                <Image
                    src={avatarUrl}
                    alt={username ?? ""}
                    fill
                    sizes={`${sizePx}px`}
                    className="object-cover"
                    loading="eager"
                    unoptimized
                />
            ) : (
                <div
                    className={`flex h-full w-full items-center justify-center font-display ${initialClassName}`}
                    style={{ background: "var(--gold)", color: "var(--ink)" }}
                >
                    {initial}
                </div>
            )}
        </div>
    );
}
