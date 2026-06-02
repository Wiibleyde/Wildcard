import type { CardTheme, TrumpIndex } from "@/lib/card/types";
import { ArtworkFill, CardBody, CenteredArtwork } from "./CardBody";
import { Corner } from "./Corner";

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
  const artwork = theme.artwork?.trump?.[index];
  const showCorners = artwork ? artwork.showCorners !== false : true;
  const showCenter = artwork?.fill ? artwork.showCenter === true : true;

  return (
    <>
      {artwork?.fill && <ArtworkFill artwork={artwork} />}
      {showCorners && (
        <Corner label={String(index)} color={color} font={theme.font} />
      )}
      {showCenter && (
        <CardBody>
          {artwork?.center !== undefined ? (
            <CenteredArtwork artwork={artwork.center} color={color} />
          ) : (
            <div
              className="w-full h-full flex flex-col items-center justify-center"
              style={{ color, gap: "4%" }}
            >
              <span
                style={{ fontSize: "38cqi", fontWeight: 700, lineHeight: 1 }}
              >
                {index}
              </span>
              <span style={{ fontSize: "11cqi", lineHeight: 1, opacity: 0.5 }}>
                {ROMAN[index]}
              </span>
            </div>
          )}
        </CardBody>
      )}
      {showCorners && (
        <Corner label={String(index)} color={color} font={theme.font} flipped />
      )}
    </>
  );
}
