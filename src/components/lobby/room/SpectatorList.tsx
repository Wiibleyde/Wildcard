import { useTranslations } from "next-intl";
import type { SpectatorRow } from "@/lib/lobby/roster";

type Props = {
    spectators: SpectatorRow[];
    hostId: string;
};

export function SpectatorList({ spectators, hostId }: Props) {
    const t = useTranslations("room");
    return (
        <div className="flex flex-col gap-3">
            <h3 className="font-display text-base text-wc-cream">
                {t("spectators", { n: spectators.length })}
            </h3>
            {spectators.length === 0 ? (
                <p className="text-xs font-semibold text-wc-muted">
                    {t("no_spectators")}
                </p>
            ) : (
                <ul className="flex flex-wrap gap-2">
                    {spectators.map((s) => (
                        <li
                            key={s.userId}
                            className="flex items-center gap-2 rounded-xl border-nb border-wc-ink bg-wc-panel-d px-3 py-2"
                            style={{ boxShadow: "0 3px 0 var(--ink)" }}
                        >
                            <span aria-hidden="true">👁</span>
                            <span className="truncate font-display text-sm text-wc-muted">
                                {s.username}
                            </span>
                            {s.userId === hostId && (
                                <span className="font-pixel text-wc-micro text-wc-gold uppercase">
                                    {t("host_badge")}
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
