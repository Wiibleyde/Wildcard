import type { BoardTheme } from "@/lib/board/types";

export function BoardTile({ theme }: { theme: BoardTheme }) {
    return (
        <div
            className="h-10 w-16 shrink-0 overflow-hidden rounded-md border-nb border-wc-edge"
            style={{ background: theme.surface.background }}
        />
    );
}
