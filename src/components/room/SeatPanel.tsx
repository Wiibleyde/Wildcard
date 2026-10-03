import { useTranslations } from "next-intl";
import type { Slot } from "@/lib/lobby/roster";
import { SeatSlot } from "./SeatSlot";

type Props = {
    slots: Slot[];
    total: number;
    maxPlayers: number;
    hostId: string;
    isHost: boolean;
    botCount: number;
    onSetBots: (next: number) => void;
};

function StepButton({
    glyph,
    label,
    disabled,
    onClick,
}: {
    glyph: string;
    label: string;
    disabled: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className="wc-iconbtn grid h-8 w-8 place-items-center rounded-lg bg-wc-panel-d2 font-display text-lg text-wc-cream [--press:#110c17] disabled:opacity-30"
        >
            <span aria-hidden="true">{glyph}</span>
        </button>
    );
}

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
        <section className="panel flex flex-col gap-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="h-lg">
                    {t("seats", { total, max: maxPlayers })}
                </h2>
                {isHost && (
                    <div className="flex items-center gap-2">
                        <span className="label text-xs font-bold text-wc-muted uppercase">
                            {t("bots")}
                        </span>
                        <StepButton
                            glyph="−"
                            label={t("remove_bot")}
                            disabled={botCount <= 0}
                            onClick={() => onSetBots(botCount - 1)}
                        />
                        <span className="w-6 text-center font-display text-xl">
                            {botCount}
                        </span>
                        <StepButton
                            glyph="+"
                            label={t("add_bot")}
                            disabled={total >= maxPlayers}
                            onClick={() => onSetBots(botCount + 1)}
                        />
                    </div>
                )}
            </div>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {slots.map((slot, index) => {
                    // Bots and empty seats have no identity: their position is the key.
                    const key =
                        slot?.kind === "human"
                            ? slot.userId
                            : `${slot?.kind ?? "empty"}-${index}`;
                    return <SeatSlot key={key} slot={slot} hostId={hostId} />;
                })}
            </ul>
        </section>
    );
}
