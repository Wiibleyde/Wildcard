export function Switch({
    checked,
    onChange,
    label,
    disabled = false,
    onColor = "var(--green)",
}: {
    checked: boolean;
    onChange: (next: boolean) => void;
    label: string;
    disabled?: boolean;
    onColor?: string;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className="relative h-8 w-14 shrink-0 cursor-pointer rounded-[10px] border-nb border-wc-ink transition-colors disabled:cursor-default disabled:opacity-50"
            style={{ background: checked ? onColor : "var(--panel-d2)" }}
        >
            <span
                className="absolute top-1/2 left-0 h-5 w-5 rounded-md border-nb border-wc-ink bg-wc-gold"
                style={{
                    boxShadow: "0 3px 0 var(--ink)",
                    transform: `translateY(-50%) translateX(${checked ? 28 : 3}px)`,
                    transition: "transform 0.14s cubic-bezier(0.3,0.8,0.3,1)",
                }}
            />
        </button>
    );
}
