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

/** Picking a mode rewrites every toggle; tweaking one afterwards shows « personnalisé ». */
export function RuleModePicker({
    modes,
    activeKey,
    isHost,
    busy,
    onPick,
}: Props) {
    const t = useTranslations("room");
    // Mode keys come from the game module, so the message key is dynamic.
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
                            className={`wc-chip rounded-[10px] px-3 py-2 text-left text-sm font-extrabold enabled:cursor-pointer disabled:cursor-default ${
                                selected
                                    ? "bg-wc-gold text-wc-ink [--press:var(--gold-d)]"
                                    : "bg-wc-panel-d2 text-wc-cream [--press:#110c17]"
                            } ${!isHost && !selected ? "opacity-60" : ""}`}
                        >
                            {modeText(mode.key, "label")}
                        </button>
                    );
                })}
            </fieldset>
            <p className="text-sm text-wc-muted">
                {active
                    ? modeText(active.key, "description")
                    : t("mode_custom")}
            </p>
        </div>
    );
}
