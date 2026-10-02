import type { CardTheme, TrumpIndex } from "@/lib/card/types";
import { CenterBox } from "./CardBody";
import { CardFace } from "./CardFace";

const ROMAN: Record<TrumpIndex, string> = {
    1: "I",
    2: "II",
    3: "III",
    4: "IV",
    5: "V",
    6: "VI",
    7: "VII",
    8: "VIII",
    9: "IX",
    10: "X",
    11: "XI",
    12: "XII",
    13: "XIII",
    14: "XIV",
    15: "XV",
    16: "XVI",
    17: "XVII",
    18: "XVIII",
    19: "XIX",
    20: "XX",
    21: "XXI",
};

export function TrumpContent({
    index,
    theme,
}: {
    index: TrumpIndex;
    theme: CardTheme;
}) {
    const color = theme.trumpColor ?? theme.textColor;

    return (
        <CardFace
            artwork={theme.artwork?.trump?.[index]}
            color={color}
            font={theme.font}
            label={String(index)}
        >
            <CenterBox col style={{ color, gap: "4%" }}>
                <span
                    style={{
                        fontSize: "44cqi",
                        fontWeight: 700,
                        lineHeight: 1,
                    }}
                >
                    {index}
                </span>
                <span
                    style={{
                        fontSize: "13cqi",
                        lineHeight: 1,
                        opacity: 0.65,
                    }}
                >
                    {ROMAN[index]}
                </span>
            </CenterBox>
        </CardFace>
    );
}
