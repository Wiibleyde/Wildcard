import Image from "next/image";
import { GOLD_GRADIENT, GOLD_RED_GRADIENT } from "@/lib/ui/brand";

type Props = {
    avatarUrl: string | null;
    initial: string;
    username: string | null;
    sizePx: number;
    initialClassName: string;
};

export function NavAvatar({
    avatarUrl,
    initial,
    username,
    sizePx,
    initialClassName,
}: Props) {
    return (
        <div
            className="relative rounded-full shrink-0 p-0.5"
            style={{
                width: sizePx,
                height: sizePx,
                background: GOLD_RED_GRADIENT,
            }}
        >
            <div className="relative w-full h-full rounded-full overflow-hidden">
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
                        className={`w-full h-full flex items-center justify-center font-black ${initialClassName}`}
                        style={{
                            background: GOLD_GRADIENT,
                            color: "#0d0a05",
                        }}
                    >
                        {initial}
                    </div>
                )}
            </div>
        </div>
    );
}
