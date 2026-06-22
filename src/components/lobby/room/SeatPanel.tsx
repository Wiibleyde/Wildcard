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
                    className="text-xs font-bold uppercase tracking-widest"
                    style={{ color: "#7a6a50" }}
                >
                    {t("seats")} · {total}/{maxPlayers}
                </h3>
                {isHost && (
                    <div className="flex items-center gap-2">
                        <span
                            className="text-xs font-bold"
                            style={{ color: "#9a8870" }}
                        >
                            {t("bots")}
                        </span>
                        <button
                            type="button"
                            onClick={() => onSetBots(botCount - 1)}
                            disabled={botCount <= 0}
                            className="flex h-7 w-7 items-center justify-center rounded-lg font-black disabled:opacity-30"
                            style={{
                                background: "rgba(255,255,255,0.05)",
                                color: "#f5c516",
                                border: "1px solid #3d2d18",
                            }}
                        >
                            −
                        </button>
                        <span
                            className="w-5 text-center font-black"
                            style={{ color: "#faf2e2" }}
                        >
                            {botCount}
                        </span>
                        <button
                            type="button"
                            onClick={() => onSetBots(botCount + 1)}
                            disabled={total >= maxPlayers}
                            className="flex h-7 w-7 items-center justify-center rounded-lg font-black disabled:opacity-30"
                            style={{
                                background: "rgba(255,255,255,0.05)",
                                color: "#f5c516",
                                border: "1px solid #3d2d18",
                            }}
                        >
                            +
                        </button>
                    </div>
                )}
            </div>
            <ul className="grid grid-cols-2 lg:grid-cols-3 gap-3">
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
