import type { ReactElement } from "react";
import { PIP_LAYOUTS, type PipPosition } from "@/lib/card/pips";
import type {
    CardDescriptor,
    CardTheme,
    Rank,
    SuitStyle,
} from "@/lib/card/types";
import { rankToPipIndex } from "@/lib/card/utils";
import { ArtworkFill, CardBody, CenterBox, CenteredArtwork } from "./CardBody";
import { Corner } from "./Corner";

export function SuitedContent({
    card,
    theme,
}: {
    card: Extract<CardDescriptor, { type: "suited" }>;
    theme: CardTheme;
}) {
    const { suit, rank } = card;
    const suitStyle = theme.suits[suit];
    const isFaceCard =
        rank === "J" || rank === "C" || rank === "Q" || rank === "K";
    const isAce = rank === "A";

    const artwork =
        theme.artwork?.suited?.[suit]?.[rank] ??
        theme.artwork?.suitDefault?.[suit];

    const showCorners = artwork ? artwork.showCorners !== false : true;
    const showCenter = artwork?.fill ? artwork.showCenter === true : true;

    return (
        <>
            {artwork?.fill && <ArtworkFill artwork={artwork} />}
            {showCorners && (
                <Corner
                    label={rank}
                    sub={suitStyle.symbol}
                    color={suitStyle.color}
                    font={theme.font}
                />
            )}
            {showCenter && (
                <CardBody>
                    <SuitedBody
                        isAce={isAce}
                        isFaceCard={isFaceCard}
                        rank={rank}
                        suitStyle={suitStyle}
                        pipLayout={PIP_LAYOUTS[rankToPipIndex(rank)]}
                        centerArtwork={artwork?.center}
                    />
                </CardBody>
            )}
            {showCorners && (
                <Corner
                    label={rank}
                    sub={suitStyle.symbol}
                    color={suitStyle.color}
                    font={theme.font}
                    flipped
                />
            )}
        </>
    );
}

interface SuitedBodyProps {
    isAce: boolean;
    isFaceCard: boolean;
    rank: Rank;
    suitStyle: SuitStyle;
    pipLayout: PipPosition[] | undefined;
    centerArtwork: string | ReactElement | undefined;
}

function SuitedBody({
    isAce,
    isFaceCard,
    rank,
    suitStyle,
    pipLayout,
    centerArtwork,
}: SuitedBodyProps) {
    if (centerArtwork !== undefined) {
        return (
            <CenteredArtwork artwork={centerArtwork} color={suitStyle.color} />
        );
    }

    if (isAce) {
        return (
            <CenterBox
                style={{
                    fontSize: "54cqi",
                    color: suitStyle.color,
                    lineHeight: 1,
                    ...suitStyle.symbolStyle,
                }}
            >
                {suitStyle.symbol}
            </CenterBox>
        );
    }

    if (isFaceCard) {
        return (
            <CenterBox col style={{ color: suitStyle.color, gap: "5%" }}>
                <span
                    style={{
                        fontSize: "38cqi",
                        fontWeight: 700,
                        lineHeight: 1,
                    }}
                >
                    {rank}
                </span>
                <span
                    style={{
                        fontSize: "28cqi",
                        lineHeight: 1,
                        ...suitStyle.symbolStyle,
                    }}
                >
                    {suitStyle.symbol}
                </span>
            </CenterBox>
        );
    }

    if (pipLayout) {
        // Denser layouts (8–10 pips) get smaller symbols so rows don't collide
        const pipSize =
            pipLayout.length <= 6 ? 20 : pipLayout.length <= 8 ? 18 : 16;
        return (
            <div className="relative w-full h-full">
                {pipLayout.map((pip, i) => (
                    <span
                        // biome-ignore lint/suspicious/noArrayIndexKey: pip order is stable by card value
                        key={i}
                        className="absolute"
                        style={{
                            left: `${pip.x}%`,
                            top: `${pip.y}%`,
                            fontSize: `${pipSize}cqi`,
                            color: suitStyle.color,
                            lineHeight: 1,
                            transform: `translate(-50%, -50%)${pip.flip ? " rotate(180deg)" : ""}`,
                            ...suitStyle.symbolStyle,
                        }}
                    >
                        {suitStyle.symbol}
                    </span>
                ))}
            </div>
        );
    }

    return null;
}
