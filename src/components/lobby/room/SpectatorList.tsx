import { useTranslations } from "next-intl";
import type { SpectatorRow } from "./types";

type Props = {
    spectators: SpectatorRow[];
    hostId: string;
};

export function SpectatorList({ spectators, hostId }: Props) {
    const t = useTranslations("room");
    return (
        <div className="flex flex-col gap-3">
            <h3
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: "#7a6a50" }}
            >
                {t("spectators")} · {spectators.length}
            </h3>
            {spectators.length === 0 ? (
                <p className="text-xs font-bold" style={{ color: "#4a3820" }}>
                    {t("no_spectators")}
                </p>
            ) : (
                <ul className="flex flex-wrap gap-2">
                    {spectators.map((s) => (
                        <li
                            key={s.userId}
                            className="flex items-center gap-2 rounded-xl px-3 py-2"
                            style={{
                                background: "#1c1510",
                                border: "1px solid #3d2d18",
                            }}
                        >
                            <span aria-hidden>👁</span>
                            <span
                                className="truncate font-bold text-sm"
                                style={{ color: "#9a8870" }}
                            >
                                {s.username}
                                {s.userId === hostId
                                    ? ` · ${t("host_badge")}`
                                    : ""}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
