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
                    size="lg"
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
                <div className="well flex flex-1 items-center justify-center py-3 text-center text-sm font-bold text-wc-muted">
                    {t("waiting_host")}
                </div>
            )}
            <GameButton variant="red" onClick={onLeave} disabled={busy}>
                {t("leave")}
            </GameButton>
        </div>
    );
}
