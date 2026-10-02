import type { ReactElement, ReactNode } from "react";
import type { CardArtwork, CardTheme } from "@/lib/card/types";
import { ArtworkFill, CardBody, CenteredArtwork } from "./CardBody";
import { Corner } from "./Corner";

interface CardFaceProps {
    artwork: CardArtwork | undefined;
    color: string;
    font: CardTheme["font"];
    label: string | ReactElement;
    sub?: string | ReactElement;
    /** Default centre, replaced by `artwork.center` when the theme sets one. */
    children: ReactNode;
}

export function CardFace({
    artwork,
    color,
    font,
    label,
    sub,
    children,
}: CardFaceProps) {
    const showCorners = artwork ? artwork.showCorners !== false : true;
    // A full-bleed fill takes over the centre unless the theme opts back in.
    const showCenter = artwork?.fill ? artwork.showCenter === true : true;

    return (
        <>
            {artwork?.fill && <ArtworkFill artwork={artwork} />}
            {showCorners && (
                <Corner label={label} sub={sub} color={color} font={font} />
            )}
            {showCenter && (
                <CardBody>
                    {artwork?.center !== undefined ? (
                        <CenteredArtwork
                            artwork={artwork.center}
                            color={color}
                        />
                    ) : (
                        children
                    )}
                </CardBody>
            )}
            {showCorners && (
                <Corner
                    label={label}
                    sub={sub}
                    color={color}
                    font={font}
                    flipped
                />
            )}
        </>
    );
}
