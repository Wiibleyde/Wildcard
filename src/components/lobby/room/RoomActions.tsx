import { useTranslations } from "next-intl";
import { GameButton } from "@/components/ui/GameButton";

type Props = {
    isHost: boolean;
    busy: boolean;
    canStart: boolean;
    minPlayers: number;
    onStart: () => void;
    onLeave: () => void;
};

export function RoomActions({
    isHost,
    busy,
    canStart,
    minPlayers,
    onStart,
    onLeave,
}: Props) {
    const t = useTranslations("room");
    return (
        <div className="flex flex-col gap-3 sm:flex-row">
            {isHost ? (
                <GameButton
                    variant="green"
                    onClick={onStart}
                    disabled={busy || !canStart}
                    className="flex-1"
                >
                    {busy
                        ? t("starting")
                        : canStart
                          ? t("start")
                          : t("need_more_players", { min: minPlayers })}
                </GameButton>
            ) : (
                <div
                    className="flex flex-1 items-center justify-center rounded-wc-btn border-nb py-3 text-center font-display text-sm"
                    style={{
                        background: "var(--panel-d)",
                        color: "var(--muted)",
                        borderColor: "var(--ink)",
                        boxShadow: "0 4px 0 var(--ink)",
                    }}
                >
                    {t("waiting_host")}
                </div>
            )}
            <GameButton variant="red" onClick={onLeave} disabled={busy}>
                {t("leave")}
            </GameButton>
        </div>
    );
}
