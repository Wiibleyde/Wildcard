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
                background: filled ? "#1c1510" : "rgba(255,255,255,0.02)",
                border: `2px solid ${filled ? "#3d2d18" : "rgba(61,45,24,0.5)"}`,
            }}
        >
            <div
                className="flex h-9 w-9 items-center justify-center rounded-full font-black"
                style={{
                    background: isBot
                        ? "rgba(167,139,250,0.15)"
                        : filled
                          ? "rgba(245,197,22,0.15)"
                          : "transparent",
                    color: isBot ? "#a78bfa" : filled ? "#f5c516" : "#4a3820",
                    border: filled ? undefined : "1px dashed #4a3820",
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
                    className="truncate font-bold text-sm"
                    style={{ color: filled ? "#faf2e2" : "#4a3820" }}
                >
                    {label}
                </div>
                {slot?.kind === "human" && slot.userId === hostId && (
                    <span
                        className="text-[10px] font-black uppercase tracking-wider"
                        style={{ color: "#f5c516" }}
                    >
                        {t("host_badge")}
                    </span>
                )}
            </div>
        </li>
    );
}
