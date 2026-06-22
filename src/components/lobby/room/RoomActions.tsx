import { useTranslations } from "next-intl";

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
        <div className="flex flex-col sm:flex-row gap-3">
            {isHost ? (
                <button
                    type="button"
                    onClick={onStart}
                    disabled={busy || !canStart}
                    className="flex-1 rounded-xl py-3 font-black text-sm disabled:opacity-50"
                    style={{
                        background: "#48c97a",
                        color: "#0d1f12",
                        boxShadow: "0 4px 0 0 #1a6038",
                    }}
                >
                    {busy
                        ? t("starting")
                        : canStart
                          ? t("start")
                          : t("need_more_players", { min: minPlayers })}
                </button>
            ) : (
                <div
                    className="flex-1 rounded-xl py-3 text-center font-bold text-sm"
                    style={{
                        background: "rgba(255,255,255,0.03)",
                        color: "#9a8870",
                        border: "1px solid #3d2d18",
                    }}
                >
                    {t("waiting_host")}
                </div>
            )}
            <button
                type="button"
                onClick={onLeave}
                disabled={busy}
                className="rounded-xl px-6 py-3 font-bold text-sm disabled:opacity-50"
                style={{
                    background: "rgba(224,64,64,0.12)",
                    color: "#e04040",
                    border: "1px solid rgba(224,64,64,0.4)",
                }}
            >
                {t("leave")}
            </button>
        </div>
    );
}
