import { useTranslations } from "next-intl";

type Props = {
    label: string;
    description: string;
    on: boolean;
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
            className="flex items-center justify-between gap-3 rounded-xl border-nb px-4 py-3"
            style={{
                background: "var(--panel-d)",
                borderColor: "var(--ink)",
                boxShadow: "0 4px 0 var(--ink)",
                opacity: locked ? 0.5 : 1,
            }}
        >
            <div className="min-w-0 flex-1">
                <div
                    className="font-display text-sm"
                    style={{ color: "var(--cream)" }}
                >
                    {label}
                </div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>
                    {description}
                </div>
            </div>
            {isHost ? (
                <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={label}
                    disabled={busy || locked}
                    onClick={() => onToggle(!on)}
                    className="inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-nb p-0.5 transition-colors duration-200 disabled:cursor-default disabled:opacity-40"
                    style={{
                        background: on ? "var(--green)" : "var(--panel-d2)",
                        borderColor: "var(--ink)",
                    }}
                >
                    <span
                        className="h-4 w-4 rounded-sm border-2 transition-transform duration-200"
                        style={{
                            background: "var(--cream)",
                            borderColor: "var(--ink)",
                            transform: on
                                ? "translateX(18px)"
                                : "translateX(0)",
                        }}
                    />
                </button>
            ) : (
                <span
                    className="shrink-0 font-pixel text-wc-micro uppercase"
                    style={{
                        fontFamily: "var(--pixel)",
                        color: on ? "var(--green)" : "var(--muted)",
                    }}
                >
                    {on ? t("rule_on") : t("rule_off")}
                </span>
            )}
        </li>
    );
}
