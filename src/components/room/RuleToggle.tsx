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
            className={`well flex items-center justify-between gap-3 px-4 py-3 ${locked ? "opacity-50" : ""}`}
        >
            <div className="min-w-0 flex-1">
                <div className="text-sm font-extrabold">{label}</div>
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
                    className="stamp shrink-0"
                    style={{
                        background: on ? "var(--green)" : "var(--panel-d)",
                        color: on ? "#fff" : "var(--muted)",
                    }}
                >
                    {on ? t("rule_on") : t("rule_off")}
                </span>
            )}
        </li>
    );
}
