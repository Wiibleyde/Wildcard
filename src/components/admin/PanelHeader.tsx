import { useTranslations } from "next-intl";
import { GameButton } from "@/components/ui/GameButton";

export function PanelHeader({
    title,
    badge,
    accent,
    onRefresh,
    refreshing = false,
}: {
    /** Omitted when the page heading already names the panel. */
    title?: string;
    badge: string;
    accent: string;
    onRefresh: () => void;
    refreshing?: boolean;
}) {
    const t = useTranslations("admin");
    return (
        <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
                {title && (
                    <h2 className="font-display text-xl leading-none xl:text-2xl">
                        {title}
                    </h2>
                )}
                <span
                    className="stamp"
                    style={{ background: accent, color: "var(--ink)" }}
                >
                    {badge}
                </span>
            </div>
            <GameButton
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                disabled={refreshing}
            >
                {t("refresh")}
            </GameButton>
        </div>
    );
}
