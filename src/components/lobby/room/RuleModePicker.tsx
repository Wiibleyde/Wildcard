import { useTranslations } from "next-intl";
import type { GameRuleMode } from "@/lib/engine/types";

type Props = {
    modes: readonly GameRuleMode[];
    /** Mode matching the current toggles, `null` = custom tweak. */
    activeKey: string | null;
    isHost: boolean;
    busy: boolean;
    onPick: (mode: GameRuleMode) => void;
};

/**
 * Launch-mode presets (« règles françaises », « War », « Vegas »…). Picking one
 * rewrites every toggle below it; tweaking a toggle afterwards drops the
 * selection to « personnalisé ». The host picks, everyone else sees the mode.
 */
export function RuleModePicker({
    modes,
    activeKey,
    isHost,
    busy,
    onPick,
}: Props) {
    const t = useTranslations("room");
    const modeText = (key: string, field: "label" | "description") =>
        t(`modes.${key}.${field}` as Parameters<typeof t>[0]);
    const active = modes.find((m) => m.key === activeKey);

    return (
        <div className="flex flex-col gap-2">
            <fieldset
                aria-label={t("mode_title")}
                className="m-0 grid min-w-0 grid-cols-2 border-0 p-0 gap-2 sm:grid-cols-3 xl:grid-cols-4"
            >
                {modes.map((mode) => {
                    const selected = mode.key === activeKey;
                    return (
                        <button
                            key={mode.key}
                            type="button"
                            aria-pressed={selected}
                            disabled={!isHost || busy}
                            onClick={() => onPick(mode)}
                            className="rounded-xl border-nb px-3 py-2 text-left font-display text-sm transition-colors duration-200 enabled:cursor-pointer disabled:cursor-default"
                            style={{
                                background: selected
                                    ? "var(--gold)"
                                    : "var(--panel-d)",
                                color: selected ? "var(--ink)" : "var(--cream)",
                                borderColor: "var(--ink)",
                                boxShadow: "0 4px 0 var(--ink)",
                                opacity: !isHost && !selected ? 0.6 : 1,
                            }}
                        >
                            {modeText(mode.key, "label")}
                        </button>
                    );
                })}
            </fieldset>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
                {active
                    ? modeText(active.key, "description")
                    : t("mode_custom")}
            </p>
        </div>
    );
}
