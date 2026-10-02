import { useTranslations } from "next-intl";
import { Switch } from "@/components/ui/Switch";

type Props = {
    label: string;
    description: string;
    on: boolean;
    /** Depends on a rule that is currently off. */
    locked: boolean;
    isHost: boolean;
    busy: boolean;
    onToggle: (value: boolean) => void;
};

export function RuleToggle({
    label,
    description,
    on,
    locked,
    isHost,
    busy,
    onToggle,
}: Props) {
    const t = useTranslations("room");
    return (
        <li
            className="flex items-center justify-between gap-3 rounded-xl border-nb border-wc-ink bg-wc-panel-d px-4 py-3"
            style={{
                boxShadow: "0 4px 0 var(--ink)",
                opacity: locked ? 0.5 : 1,
            }}
        >
            <div className="min-w-0 flex-1">
                <div className="font-display text-sm text-wc-cream">
                    {label}
                </div>
                <div className="text-xs text-wc-muted">{description}</div>
            </div>
            {isHost ? (
                <Switch
                    checked={on}
                    onChange={onToggle}
                    label={label}
                    disabled={busy || locked}
                />
            ) : (
                <span
                    className="shrink-0 font-pixel text-wc-micro uppercase"
                    style={{ color: on ? "var(--green)" : "var(--muted)" }}
                >
                    {on ? t("rule_on") : t("rule_off")}
                </span>
            )}
        </li>
    );
}
