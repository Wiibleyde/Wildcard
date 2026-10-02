import type { CardArtwork, CardTheme, JokerVariant } from "@/lib/card/types";
import { CenterBox } from "./CardBody";
import { CardFace } from "./CardFace";

function StarFace({
    artwork,
    color,
    theme,
}: {
    artwork: CardArtwork | undefined;
    color: string;
    theme: CardTheme;
}) {
    return (
        <CardFace artwork={artwork} color={color} font={theme.font} label="★">
            <CenterBox style={{ fontSize: "54cqi", color, lineHeight: 1 }}>
                ★
            </CenterBox>
        </CardFace>
    );
}

export function FoolContent({ theme }: { theme: CardTheme }) {
    return (
        <StarFace
            artwork={theme.artwork?.fool}
            color={theme.trumpColor ?? theme.textColor}
            theme={theme}
        />
    );
}

export function JokerContent({
    variant = "red",
    theme,
}: {
    variant: JokerVariant | undefined;
    theme: CardTheme;
}) {
    return (
        <StarFace
            artwork={theme.artwork?.joker?.[variant]}
            color={
                variant === "red"
                    ? theme.suits.hearts.color
                    : theme.suits.spades.color
            }
            theme={theme}
        />
    );
}
