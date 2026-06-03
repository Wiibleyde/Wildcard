import type { CardTheme } from "@/lib/card/types";

export function CardBack({ theme }: { theme: CardTheme }) {
    const { back } = theme;

    return (
        <>
            {back.artwork && (
                <div className="absolute inset-0">
                    {typeof back.artwork === "string" ? (
                        // biome-ignore lint/performance/noImgElement: theme artwork — dimensions unknown at build time
                        <img
                            src={back.artwork}
                            alt=""
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        back.artwork
                    )}
                </div>
            )}
            {back.emblem && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {typeof back.emblem === "string" ? (
                        <span style={{ fontSize: "30cqi", lineHeight: 1 }}>
                            {back.emblem}
                        </span>
                    ) : (
                        back.emblem
                    )}
                </div>
            )}
        </>
    );
}
