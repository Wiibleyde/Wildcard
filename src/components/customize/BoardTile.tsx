"use client";

import { TierBadge } from "@/components/ui/TierBadge";
import type { BoardTheme } from "@/lib/board/types";
import type { Dictionary } from "@/lib/i18n";
import { TileShell } from "./TileShell";

const TIER_LABELS: Record<string, keyof Dictionary["customize"]> = {
  common: "tier_common",
  uncommon: "tier_uncommon",
  rare: "tier_rare",
  epic: "tier_epic",
  legendary: "tier_legendary",
  mystical: "tier_mystical",
  ethereal: "tier_ethereal",
};

type Props = {
  theme: BoardTheme;
  selected: boolean;
  onClick: () => void;
  previewHref: string;
  dict: Dictionary["customize"];
};

export function BoardTile({
  theme,
  selected,
  onClick,
  previewHref,
  dict,
}: Props) {
  const tierKey = TIER_LABELS[theme.tier];
  const tierName = tierKey ? (dict[tierKey] as string) : theme.tier;

  return (
    <TileShell selected={selected} onClick={onClick} previewHref={previewHref}>
      <div
        className="w-16 h-10 rounded-md overflow-hidden shrink-0"
        style={{ background: theme.surface.background }}
      />
      <span className="text-xs font-semibold text-wc-text truncate w-full text-center">
        {theme.name}
      </span>
      <TierBadge tier={theme.tier} name={tierName} />
    </TileShell>
  );
}
