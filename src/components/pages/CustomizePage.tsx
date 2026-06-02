"use client";

import Link from "next/link";
import { useState } from "react";
import { BOARD_THEMES } from "@/lib/board/themes";
import type { BoardTheme } from "@/lib/board/types";
import { THEMES } from "@/lib/card/themes";
import type { CardTheme } from "@/lib/card/types";
import type { Dictionary } from "@/lib/i18n";

type TierKey =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "mystical"
  | "ethereal";

function tierLabel(tier: TierKey, dict: Dictionary["customize"]): string {
  const map: Record<TierKey, string> = {
    common: dict.tier_common,
    uncommon: dict.tier_uncommon,
    rare: dict.tier_rare,
    epic: dict.tier_epic,
    legendary: dict.tier_legendary,
    mystical: dict.tier_mystical,
    ethereal: dict.tier_ethereal,
  };
  return map[tier];
}

function tierColor(tier: TierKey): string {
  const map: Record<TierKey, string> = {
    common: "rgba(156,163,175,0.15)",
    uncommon: "rgba(74,222,128,0.15)",
    rare: "rgba(96,165,250,0.15)",
    epic: "rgba(167,139,250,0.15)",
    legendary: "rgba(251,191,36,0.15)",
    mystical: "rgba(251,113,133,0.15)",
    ethereal: "rgba(232,196,104,0.20)",
  };
  return map[tier];
}

function tierTextColor(tier: TierKey): string {
  const map: Record<TierKey, string> = {
    common: "#9ca3af",
    uncommon: "#4ade80",
    rare: "#60a5fa",
    epic: "#a78bfa",
    legendary: "#fbbf24",
    mystical: "#fb7185",
    ethereal: "#e8c468",
  };
  return map[tier];
}

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="w-3 h-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5Z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      className="w-2.5 h-2.5"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 6l3 3 5-5"
        stroke="#15110a"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Deck tile ─────────────────────────────────────────────────────────────────

function TileShell({
  selected,
  onClick,
  previewHref,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  previewHref: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative rounded-xl border transition-all overflow-hidden"
      style={{
        background: selected
          ? "rgba(232,196,104,0.08)"
          : "rgba(255,255,255,0.04)",
        borderColor: selected
          ? "rgba(232,196,104,0.60)"
          : "rgba(255,255,255,0.08)",
        boxShadow: selected ? "0 0 0 1px rgba(232,196,104,0.30)" : undefined,
      }}
    >
      {/* Main select area */}
      <button
        type="button"
        onClick={onClick}
        className="w-full flex flex-col items-center gap-2 p-3 pb-6 cursor-pointer"
      >
        {children}
        {selected && (
          <div
            className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
            style={{ background: "#e8c468" }}
          >
            <CheckIcon />
          </div>
        )}
      </button>
      {/* Preview link — sits below the button, full width */}
      <Link
        href={previewHref}
        className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1 py-1 text-[10px] font-semibold transition-colors"
        style={{ background: "rgba(0,0,0,0.35)", color: "#7c8699" }}
      >
        <EyeIcon />
      </Link>
    </div>
  );
}

// ── Deck tile ─────────────────────────────────────────────────────────────────

function DeckTile({
  theme,
  selected,
  onClick,
  previewHref,
  dict,
}: {
  theme: CardTheme;
  selected: boolean;
  onClick: () => void;
  previewHref: string;
  dict: Dictionary["customize"];
}) {
  const backBg = theme.back.pattern ?? theme.back.color;
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
      <span
        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
        style={{
          background: tierColor(theme.tier as TierKey),
          color: tierTextColor(theme.tier as TierKey),
        }}
      >
        {tierLabel(theme.tier as TierKey, dict)}
      </span>
    </TileShell>
  );
}

// ── Board tile ────────────────────────────────────────────────────────────────

function BoardTile({
  theme,
  selected,
  onClick,
  previewHref,
  dict,
}: {
  theme: BoardTheme;
  selected: boolean;
  onClick: () => void;
  previewHref: string;
  dict: Dictionary["customize"];
}) {
  return (
    <TileShell selected={selected} onClick={onClick} previewHref={previewHref}>
      <div
        className="w-16 h-10 rounded-md overflow-hidden shrink-0"
        style={{ background: theme.surface.background }}
      />
      <span className="text-xs font-semibold text-wc-text truncate w-full text-center">
        {theme.name}
      </span>
      <span
        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
        style={{
          background: tierColor(theme.tier as TierKey),
          color: tierTextColor(theme.tier as TierKey),
        }}
      >
        {tierLabel(theme.tier as TierKey, dict)}
      </span>
    </TileShell>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Props = {
  lang: string;
  ownedDeckStyleIds: string[];
  ownedBoardStyleIds: string[];
  currentDeckStyleId: string;
  currentBoardStyleId: string;
  dict: Dictionary;
};

export function CustomizePage({
  lang,
  ownedDeckStyleIds,
  ownedBoardStyleIds,
  currentDeckStyleId,
  currentBoardStyleId,
  dict,
}: Props) {
  const [activeDeck, setActiveDeck] = useState(currentDeckStyleId);
  const [activeBoard, setActiveBoard] = useState(currentBoardStyleId);
  const [saving, setSaving] = useState<"deck" | "board" | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const ownedDeckThemes = ownedDeckStyleIds
    .map((id) => THEMES[id])
    .filter(Boolean) as CardTheme[];

  const ownedBoardThemes = ownedBoardStyleIds
    .map((id) => BOARD_THEMES[id])
    .filter(Boolean) as BoardTheme[];

  async function selectDeck(id: string) {
    if (id === activeDeck || saving) return;
    const prev = activeDeck;
    setActiveDeck(id); // optimistic
    setSaving("deck");
    setSaveError(null);
    const res = await fetch("/api/customization", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deck_style_id: id }),
    });
    if (!res.ok) {
      setActiveDeck(prev); // revert
      setSaveError("deck");
    }
    setSaving(null);
  }

  async function selectBoard(id: string) {
    if (id === activeBoard || saving) return;
    const prev = activeBoard;
    setActiveBoard(id); // optimistic
    setSaving("board");
    setSaveError(null);
    const res = await fetch("/api/customization", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ board_style_id: id }),
    });
    if (!res.ok) {
      setActiveBoard(prev); // revert
      setSaveError("board");
    }
    setSaving(null);
  }

  return (
    <div className="min-h-screen bg-wc-surface px-4 xl:px-10 pt-6 md:pt-10 pb-10">
      <div className="max-w-lg lg:max-w-5xl xl:max-w-7xl mx-auto flex flex-col gap-4">
        {/* Header */}
        <div
          className="rounded-wc-card p-6 border"
          style={{
            background: "linear-gradient(160deg, #1d1a0e, #0c1118 72%)",
            borderColor: "rgba(232,196,104,0.22)",
          }}
        >
          <h1 className="text-(length:--font-size-wc-label) font-bold text-wc-sub uppercase tracking-(--letter-spacing-wc-cap)">
            {dict.customize.title}
          </h1>
        </div>

        {/* 2-column grid on lg+ */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start flex flex-col gap-4 lg:flex-none">
          {/* Deck styles */}
          <div className="bg-wc-panel rounded-wc-panel p-6 border border-wc-border">
            <h2 className="text-sm font-bold text-wc-muted mb-4 uppercase tracking-(--letter-spacing-wc-cap) flex items-center gap-2">
              {dict.customize.deck_section}
              {saving === "deck" && (
                <span className="inline-block w-3 h-3 rounded-full border-2 border-t-transparent border-wc-muted animate-spin" />
              )}
              {saveError === "deck" && (
                <span className="text-red-400 text-xs font-semibold normal-case tracking-normal">
                  {dict.common.error}
                </span>
              )}
            </h2>
            <div className="grid grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2">
              {ownedDeckThemes.map((theme) => (
                <DeckTile
                  key={theme.id}
                  theme={theme}
                  selected={theme.id === activeDeck}
                  onClick={() => selectDeck(theme.id)}
                  previewHref={`/${lang}/customize/preview?deck=${theme.id}&board=${activeBoard}`}
                  dict={dict.customize}
                />
              ))}
            </div>
          </div>

          {/* Board styles */}
          <div className="bg-wc-panel rounded-wc-panel p-6 border border-wc-border">
            <h2 className="text-sm font-bold text-wc-muted mb-4 uppercase tracking-(--letter-spacing-wc-cap) flex items-center gap-2">
              {dict.customize.board_section}
              {saving === "board" && (
                <span className="inline-block w-3 h-3 rounded-full border-2 border-t-transparent border-wc-muted animate-spin" />
              )}
              {saveError === "board" && (
                <span className="text-red-400 text-xs font-semibold normal-case tracking-normal">
                  {dict.common.error}
                </span>
              )}
            </h2>
            <div className="grid grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2">
              {ownedBoardThemes.map((theme) => (
                <BoardTile
                  key={theme.id}
                  theme={theme}
                  selected={theme.id === activeBoard}
                  onClick={() => selectBoard(theme.id)}
                  previewHref={`/${lang}/customize/preview?deck=${activeDeck}&board=${theme.id}`}
                  dict={dict.customize}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
