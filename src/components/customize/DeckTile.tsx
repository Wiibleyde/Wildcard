import { Card } from "@/components/card/Card";
import { CARD_WIDTH_CLASS } from "@/lib/card/sizes";
import type { CardTheme } from "@/lib/card/types";
import { FACE_DOWN_CARD } from "@/lib/card/utils";

export function DeckTile({ theme }: { theme: CardTheme }) {
    return (
        <div className={`${CARD_WIDTH_CLASS.xs} shrink-0`}>
            <Card card={FACE_DOWN_CARD} faceDown theme={theme} />
        </div>
    );
}
