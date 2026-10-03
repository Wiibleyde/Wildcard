import { useTranslations } from "next-intl";
import type { SpectatorRow } from "@/lib/lobby/roster";

type Props = {
    spectators: SpectatorRow[];
    hostId: string;
};

export function SpectatorList({ spectators, hostId }: Props) {
    const t = useTranslations("room");
    return (
        <section className="panel flex flex-col gap-3 p-5">
            <h2 className="h-lg">
                {t("spectators", { n: spectators.length })}
            </h2>
            {spectators.length === 0 ? (
                <p className="text-sm text-wc-muted">{t("no_spectators")}</p>
            ) : (
                <ul className="flex flex-wrap gap-2">
                    {spectators.map((s) => (
                        <li
                            key={s.userId}
                            className="well flex items-center gap-2 px-3 py-2"
                        >
                            <span aria-hidden="true">👁</span>
                            <span className="truncate text-sm font-bold text-wc-muted">
                                {s.username}
                            </span>
                            {s.userId === hostId && (
                                <span className="text-wc-micro font-bold tracking-wc-cap text-wc-gold uppercase">
                                    {t("host_badge")}
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
