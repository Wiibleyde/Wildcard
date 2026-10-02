import { fieldClass, fieldStyle, labelClass, labelStyle } from "./fields";

/** Non-numeric input reads as 0; the validator reports the out-of-range value. */
function parseCount(raw: string): number {
    const parsed = Number.parseInt(raw, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
}

export function NumberField({
    id,
    label,
    value,
    min,
    max,
    onChange,
}: {
    readonly id: string;
    readonly label: string;
    readonly value: number;
    readonly min: number;
    readonly max: number;
    readonly onChange: (value: number) => void;
}) {
    return (
        <div>
            <label
                htmlFor={id}
                className={`${labelClass} mb-2 block`}
                style={labelStyle}
            >
                {label}
            </label>
            <input
                id={id}
                type="number"
                min={min}
                max={max}
                value={value}
                onChange={(e) => onChange(parseCount(e.target.value))}
                className={`${fieldClass} w-full`}
                style={fieldStyle}
            />
        </div>
    );
}
