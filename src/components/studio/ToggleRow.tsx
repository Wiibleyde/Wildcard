import { Checkbox } from "@/components/ui/base/checkbox";

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
        // biome-ignore lint/a11y/noLabelWithoutControl: Base UI Checkbox renders the control inside the label
        <label className="flex cursor-pointer items-center gap-3">
            <Checkbox
                checked={checked}
                onCheckedChange={onChange}
                className="size-5 cursor-pointer"
            />
            <span className="text-sm font-semibold">{label}</span>
        </label>
    );
}
