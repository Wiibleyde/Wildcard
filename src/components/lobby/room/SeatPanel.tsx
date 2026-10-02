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
            className="flex h-7 w-7 items-center justify-center rounded-lg border-nb border-wc-ink bg-wc-cream font-display text-wc-ink disabled:opacity-30"
            style={{ boxShadow: "0 3px 0 var(--ink)" }}
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
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-base text-wc-cream">
                    {t("seats", { total, max: maxPlayers })}
                </h3>
                {isHost && (
                    <div className="flex items-center gap-2">
                        <span className="font-display text-xs text-wc-muted">
                            {t("bots")}
                        </span>
                        <StepButton
                            glyph="−"
                            label={t("remove_bot")}
                            disabled={botCount <= 0}
                            onClick={() => onSetBots(botCount - 1)}
                        />
                        <span className="w-5 text-center font-display text-wc-cream">
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
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {slots.map((slot, index) => {
                    // Bots and empty seats have no identity: their position is the key.
                    const key =
                        slot?.kind === "human"
                            ? slot.userId
                            : `${slot?.kind ?? "empty"}-${index}`;
                    return <SeatSlot key={key} slot={slot} hostId={hostId} />;
                })}
            </ul>
        </div>
    );
}
