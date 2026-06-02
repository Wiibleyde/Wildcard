import type { CardTheme, JokerVariant } from "@/lib/card/types";
import { ArtworkFill, CardBody, CenteredArtwork } from "./CardBody";
import { Corner } from "./Corner";

export function FoolContent({ theme }: { theme: CardTheme }) {
  const color = theme.trumpColor ?? theme.textColor;
  const artwork = theme.artwork?.fool;
  const showCorners = artwork ? artwork.showCorners !== false : true;
  const showCenter = artwork?.fill ? artwork.showCenter === true : true;

  return (
    <>
      {artwork?.fill && <ArtworkFill artwork={artwork} />}
      {showCorners && <Corner label="★" color={color} font={theme.font} />}
      {showCenter && (
        <CardBody>
          {artwork?.center !== undefined ? (
            <CenteredArtwork artwork={artwork.center} color={color} />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ fontSize: "46cqi", color, lineHeight: 1 }}
            >
              ★
            </div>
          )}
        </CardBody>
      )}
      {showCorners && (
        <Corner label="★" color={color} font={theme.font} flipped />
      )}
    </>
  );
}

export function JokerContent({
  variant,
  theme,
}: {
  variant: JokerVariant | undefined;
  theme: CardTheme;
}) {
  const color =
    variant === "red" ? theme.suits.hearts.color : theme.suits.spades.color;
  const artwork = variant ? theme.artwork?.joker?.[variant] : undefined;
  const showCorners = artwork ? artwork.showCorners !== false : true;
  const showCenter = artwork?.fill ? artwork.showCenter === true : true;

  return (
    <>
      {artwork?.fill && <ArtworkFill artwork={artwork} />}
      {showCorners && <Corner label="★" color={color} font={theme.font} />}
      {showCenter && (
        <CardBody>
          {artwork?.center !== undefined ? (
            <CenteredArtwork artwork={artwork.center} color={color} />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ fontSize: "46cqi", color, lineHeight: 1 }}
            >
              ★
            </div>
          )}
        </CardBody>
      )}
      {showCorners && (
        <Corner label="★" color={color} font={theme.font} flipped />
      )}
    </>
  );
}
