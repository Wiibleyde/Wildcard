import { Input } from "@/components/ui/base/input";
import { fieldClass, fieldLabelClass } from "@/components/ui/fields";

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
            <label htmlFor={id} className={`${fieldLabelClass} mb-2 block`}>
                {label}
            </label>
            <Input
                id={id}
                type="number"
                min={min}
                max={max}
                value={value}
                onChange={(e) => onChange(parseCount(e.target.value))}
                className={`${fieldClass} w-full`}
            />
        </div>
    );
}
