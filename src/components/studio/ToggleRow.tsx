export function ToggleRow({
    label,
    checked,
    onChange,
}: {
    readonly label: string;
    readonly checked: boolean;
    readonly onChange: (checked: boolean) => void;
}) {
    return (
        <label className="flex cursor-pointer items-center gap-3">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="h-5 w-5 shrink-0 cursor-pointer"
                style={{ accentColor: "var(--red)" }}
            />
            <span
                className="text-sm font-semibold"
                style={{ color: "var(--ink)" }}
            >
                {label}
            </span>
        </label>
    );
}
