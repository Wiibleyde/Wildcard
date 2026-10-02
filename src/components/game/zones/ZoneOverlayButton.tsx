"use client";

export function ZoneOverlayButton({
    label,
    accentColor,
    onClick,
}: {
    label: string;
    accentColor: string;
    onClick?: () => void;
}) {
    return (
        <button
            type="button"
            className="absolute inset-0 z-20 cursor-pointer rounded-xl focus-visible:outline-3 focus-visible:outline-offset-2"
            style={{ outlineColor: accentColor }}
            aria-label={label}
            onClick={onClick}
        />
    );
}
