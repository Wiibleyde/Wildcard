import { PIP_LAYOUTS, type PipPosition } from "@/lib/card/pips";
import type { CardTheme, Rank, SuitedCard, SuitStyle } from "@/lib/card/types";
import { rankToPipIndex } from "@/lib/card/utils";
import { CenterBox } from "./CardBody";
import { CardFace } from "./CardFace";

export function SuitedContent({
    card,
    theme,
}: {
    card: SuitedCard;
    theme: CardTheme;
}) {
    const { suit, rank } = card;
    const suitStyle = theme.suits[suit];
    const artwork =
        theme.artwork?.suited?.[suit]?.[rank] ??
        theme.artwork?.suitDefault?.[suit];

    return (
        <CardFace
            artwork={artwork}
            color={suitStyle.color}
            font={theme.font}
            label={rank}
            sub={suitStyle.symbol}
        >
            <SuitedBody
                rank={rank}
                suitStyle={suitStyle}
                pipLayout={PIP_LAYOUTS[rankToPipIndex(rank)]}
            />
        </CardFace>
    );
}

function SuitedBody({
    rank,
    suitStyle,
    pipLayout,
}: {
    rank: Rank;
    suitStyle: SuitStyle;
    pipLayout: PipPosition[] | undefined;
}) {
    if (rank === "A") {
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

    if (rank === "J" || rank === "C" || rank === "Q" || rank === "K") {
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

    if (!pipLayout) return null;

    // Denser layouts get smaller symbols so rows don't collide.
    const pipSize =
        pipLayout.length <= 6 ? 20 : pipLayout.length <= 8 ? 18 : 16;
    return (
        <div className="relative w-full h-full">
            {pipLayout.map((pip) => (
                <span
                    key={`${pip.x}:${pip.y}`}
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
