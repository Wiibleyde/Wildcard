import { useTranslations } from "next-intl";
import type { Slot } from "./types";

type Props = {
    slot: Slot;
    hostId: string;
};

export function SeatSlot({ slot, hostId }: Props) {
    const t = useTranslations("room");
    const filled = slot !== null;
    const isBot = slot?.kind === "bot";
    const label =
        slot?.kind === "human"
            ? slot.username
            : slot?.kind === "bot"
              ? slot.label
              : t("empty_seat");

    return (
        <li
            className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{
                background: filled ? "var(--panel-d)" : "transparent",
                border: filled
                    ? "2.5px solid var(--ink)"
                    : "2.5px dashed rgba(147,168,200,0.4)",
                boxShadow: filled ? "0 4px 0 var(--ink)" : undefined,
            }}
        >
            <div
                className="flex h-9 w-9 items-center justify-center rounded-full font-display"
                style={{
                    background: isBot
                        ? "var(--purple)"
                        : filled
                          ? "var(--gold)"
                          : "transparent",
                    color: isBot ? "var(--accent-ink)" : "var(--ink)",
                    border: filled
                        ? "2.5px solid var(--ink)"
                        : "2px dashed rgba(147,168,200,0.4)",
                }}
            >
                {isBot
                    ? "🤖"
                    : slot?.kind === "human"
                      ? slot.username.charAt(0).toUpperCase()
                      : "?"}
            </div>
            <div className="min-w-0 flex-1">
                <div
                    className="truncate font-display text-sm"
                    style={{
                        color: filled ? "var(--cream)" : "var(--muted)",
                    }}
                >
                    {label}
                </div>
                {slot?.kind === "human" && slot.userId === hostId && (
                    <span
                        className="font-pixel text-wc-micro uppercase"
                        style={{
                            fontFamily: "var(--pixel)",
                            color: "var(--gold)",
                        }}
                    >
                        {t("host_badge")}
                    </span>
                )}
            </div>
        </li>
    );
}
