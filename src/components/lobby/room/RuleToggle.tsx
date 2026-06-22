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
            className="flex items-center justify-between gap-3 rounded-xl px-4 py-3"
            style={{
                background: "#1c1510",
                border: "2px solid #3d2d18",
                opacity: locked ? 0.5 : 1,
            }}
        >
            <div className="min-w-0 flex-1">
                <div className="font-bold text-sm" style={{ color: "#faf2e2" }}>
                    {label}
                </div>
                <div className="text-xs" style={{ color: "#9a8870" }}>
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
                    className="inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full p-1 transition-colors duration-200 disabled:cursor-default disabled:opacity-40"
                    style={{
                        background: on ? "#48c97a" : "rgba(255,255,255,0.08)",
                    }}
                >
                    <span
                        className="h-4 w-4 rounded-full transition-transform duration-200"
                        style={{
                            background: "#faf2e2",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.4)",
                            transform: on
                                ? "translateX(20px)"
                                : "translateX(0)",
                        }}
                    />
                </button>
            ) : (
                <span
                    className="shrink-0 text-xs font-black uppercase tracking-wider"
                    style={{ color: on ? "#48c97a" : "#7a6a50" }}
                >
                    {on ? t("rule_on") : t("rule_off")}
                </span>
            )}
        </li>
    );
}
