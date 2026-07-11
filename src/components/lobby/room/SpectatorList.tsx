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
                className="font-display text-base"
                style={{ color: "var(--cream)" }}
            >
                {t("spectators")} · {spectators.length}
            </h3>
            {spectators.length === 0 ? (
                <p
                    className="text-xs font-semibold"
                    style={{ color: "var(--muted)" }}
                >
                    {t("no_spectators")}
                </p>
            ) : (
                <ul className="flex flex-wrap gap-2">
                    {spectators.map((s) => (
                        <li
                            key={s.userId}
                            className="flex items-center gap-2 rounded-xl border-nb px-3 py-2"
                            style={{
                                background: "var(--panel-d)",
                                borderColor: "var(--ink)",
                                boxShadow: "0 3px 0 var(--ink)",
                            }}
                        >
                            <span aria-hidden>👁</span>
                            <span
                                className="truncate font-display text-sm"
                                style={{ color: "var(--muted)" }}
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
