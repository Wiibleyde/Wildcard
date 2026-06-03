"use client";

import { TierBadge } from "@/components/ui/TierBadge";
import type { CardTheme } from "@/lib/card/types";
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
  theme: CardTheme;
  selected: boolean;
  onClick: () => void;
  previewHref: string;
  dict: Dictionary["customize"];
};

export function DeckTile({
  theme,
  selected,
  onClick,
  previewHref,
  dict,
}: Props) {
  const backBg = theme.back.pattern ?? theme.back.color;
  const tierKey = TIER_LABELS[theme.tier];
  const tierName = tierKey ? (dict[tierKey] as string) : theme.tier;

  return (
    <TileShell selected={selected} onClick={onClick} previewHref={previewHref}>
      <div
        className="w-10 h-14 rounded-md overflow-hidden shrink-0"
        style={{
          background: backBg,
          backgroundColor: theme.back.color,
          border: `1px solid ${theme.border.color}`,
        }}
      />
      <span className="text-xs font-semibold text-wc-text truncate w-full text-center">
        {theme.name}
      </span>
      <TierBadge tier={theme.tier} name={tierName} />
    </TileShell>
  );
}
