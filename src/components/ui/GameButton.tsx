import { Link } from "@/i18n/navigation";

export type GameButtonVariant = "gold" | "green" | "red" | "teal" | "ghost";
export type GameButtonSize = "sm" | "md" | "lg";

type VariantConfig = {
    bg: string;
    text: string;
    /** transparent-border ghost drops the hard shadow */
    ghost?: boolean;
};

// Neobrutalism buttons — saturated fill, thick ink outline + hard ink shadow
// (supplied by `.wc-btn`), chunky display type.
const VARIANTS: Record<GameButtonVariant, VariantConfig> = {
    gold: { bg: "var(--gold)", text: "var(--ink)" },
    green: { bg: "var(--green)", text: "var(--ink)" },
    red: { bg: "var(--red)", text: "var(--accent-ink)" },
    teal: { bg: "var(--blue)", text: "var(--accent-ink)" },
    ghost: { bg: "transparent", text: "var(--cream)", ghost: true },
};

const SIZES: Record<GameButtonSize, string> = {
    sm: "px-3.5 py-2 text-sm",
    md: "px-4.5 py-2.75 text-base",
    lg: "px-6 py-3.5 text-xl",
};

type BaseProps = {
    variant?: GameButtonVariant;
    size?: GameButtonSize;
    children: React.ReactNode;
    className?: string;
    disabled?: boolean;
};

type AsButton = BaseProps & {
    href?: never;
    type?: "button" | "submit" | "reset";
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    form?: string;
};

type AsLink = BaseProps & {
    href: string;
    type?: never;
    onClick?: never;
    form?: never;
};

type GameButtonProps = AsButton | AsLink;

export function GameButton({
    variant = "gold",
    size = "md",
    children,
    className = "",
    disabled = false,
    ...rest
}: GameButtonProps) {
    const v = VARIANTS[variant];

    const style = {
        background: v.bg,
        color: v.text,
        ...(v.ghost ? { boxShadow: "none", borderColor: "transparent" } : null),
    } as React.CSSProperties;

    const baseClass = `wc-btn ${SIZES[size]} ${className}`;

    // A disabled "link" must not be navigable or focusable — fall through to
    // the disabled <button> branch instead of rendering an <a aria-disabled>.
    if ("href" in rest && rest.href !== undefined && !disabled) {
        return (
            <Link href={rest.href} className={baseClass} style={style}>
                {children}
            </Link>
        );
    }

    const { type = "button", onClick, form } = rest as AsButton;

    return (
        <button
            type={type}
            className={baseClass}
            style={style}
            disabled={disabled}
            onClick={onClick}
            form={form}
        >
            {children}
        </button>
    );
}
