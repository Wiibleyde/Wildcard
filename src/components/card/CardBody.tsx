import type { CSSProperties, ReactElement } from "react";
import type { CardArtwork } from "@/lib/card/types";

export function CardBody({ children }: { children: React.ReactNode }) {
    return (
        <div
            className="absolute"
            style={{ top: "16%", bottom: "16%", left: "10%", right: "10%" }}
        >
            {children}
        </div>
    );
}

/** Centered flex container; `col` stacks children vertically. */
export function CenterBox({
    children,
    col = false,
    style,
}: {
    children: React.ReactNode;
    col?: boolean;
    style?: CSSProperties;
}) {
    return (
        <div
            className={`w-full h-full flex items-center justify-center${col ? " flex-col" : ""}`}
            style={style}
        >
            {children}
        </div>
    );
}

/** Full-bleed artwork layer — renders below corners and body content */
export function ArtworkFill({ artwork }: { artwork: CardArtwork }) {
    const { fill, objectFit = "cover", tint } = artwork;
    if (!fill) return null;

    return (
        <div className="absolute inset-0">
            {typeof fill === "string" ? (
                // biome-ignore lint/performance/noImgElement: theme artwork — dimensions unknown at build time
                <img
                    src={fill}
                    alt=""
                    className="w-full h-full"
                    style={{ objectFit }}
                />
            ) : (
                <div className="w-full h-full">{fill}</div>
            )}
            {tint && (
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: tint }}
                />
            )}
        </div>
    );
}

export function CenteredArtwork({
    artwork,
    color,
}: {
    artwork: string | ReactElement;
    color: string;
}) {
    return (
        <div className="w-full h-full flex items-center justify-center overflow-hidden">
            {typeof artwork === "string" ? (
                <span style={{ fontSize: "46cqi", color, lineHeight: 1 }}>
                    {artwork}
                </span>
            ) : (
                artwork
            )}
        </div>
    );
}
