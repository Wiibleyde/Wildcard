import { useTranslations } from "next-intl";
import { SeatSlot } from "./SeatSlot";
import type { Slot } from "./types";

type Props = {
    slots: Slot[];
    total: number;
    maxPlayers: number;
    hostId: string;
    isHost: boolean;
    botCount: number;
    onSetBots: (next: number) => void;
};

export function SeatPanel({
    slots,
    total,
    maxPlayers,
    hostId,
    isHost,
    botCount,
    onSetBots,
}: Props) {
    const t = useTranslations("room");
    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
                <h3
                    className="font-display text-base"
                    style={{ color: "var(--cream)" }}
                >
                    {t("seats")} · {total}/{maxPlayers}
                </h3>
                {isHost && (
                    <div className="flex items-center gap-2">
                        <span
                            className="font-display text-xs"
                            style={{ color: "var(--muted)" }}
                        >
                            {t("bots")}
                        </span>
                        <button
                            type="button"
                            onClick={() => onSetBots(botCount - 1)}
                            disabled={botCount <= 0}
                            aria-label={t("remove_bot")}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border-nb font-display disabled:opacity-30"
                            style={{
                                background: "var(--cream)",
                                color: "var(--ink)",
                                borderColor: "var(--ink)",
                                boxShadow: "0 3px 0 var(--ink)",
                            }}
                        >
                            <span aria-hidden="true">−</span>
                        </button>
                        <span
                            className="w-5 text-center font-display"
                            style={{ color: "var(--cream)" }}
                        >
                            {botCount}
                        </span>
                        <button
                            type="button"
                            onClick={() => onSetBots(botCount + 1)}
                            disabled={total >= maxPlayers}
                            aria-label={t("add_bot")}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border-nb font-display disabled:opacity-30"
                            style={{
                                background: "var(--cream)",
                                color: "var(--ink)",
                                borderColor: "var(--ink)",
                                boxShadow: "0 3px 0 var(--ink)",
                            }}
                        >
                            <span aria-hidden="true">+</span>
                        </button>
                    </div>
                )}
            </div>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {slots.map((slot, index) => {
                    const key =
                        slot?.kind === "human"
                            ? slot.userId
                            : slot?.kind === "bot"
                              ? `bot-${index}`
                              : `empty-${index}`;
                    return <SeatSlot key={key} slot={slot} hostId={hostId} />;
                })}
            </ul>
        </div>
    );
}
