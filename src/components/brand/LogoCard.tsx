type Props = {
    className?: string;
    boxShadow?: string;
};

// Neobrutalism brand mark — chunky red tile, thick ink outline, hard offset
// shadow, slight tilt. The "W" of the deck logo.
export function LogoCard({
    className = "w-20 h-20",
    boxShadow = "0 6px 0 0 var(--ink)",
}: Props) {
    return (
        <div
            className={`${className} flex items-center justify-center rounded-2xl font-display text-4xl`}
            style={{
                background: "var(--red)",
                color: "#fff",
                border: "2.5px solid var(--ink)",
                boxShadow,
                transform: "rotate(-4deg)",
            }}
        >
            W
        </div>
    );
}
