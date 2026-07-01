import { Link } from "@/i18n/navigation";

export type GameButtonVariant = "gold" | "green" | "red" | "teal" | "ghost";
export type GameButtonSize = "sm" | "md" | "lg";

type VariantConfig = {
    bg: string;
    text: string;
    shadow: string;
    border?: string;
};

const VARIANTS: Record<GameButtonVariant, VariantConfig> = {
    gold: { bg: "#f5c516", text: "#0d0a05", shadow: "#7a5a00" },
    green: { bg: "#48c97a", text: "#0d1f12", shadow: "#1a6038" },
    red: { bg: "#e04040", text: "#faf2e2", shadow: "#8a1010" },
    teal: { bg: "#26ccba", text: "#0d0a05", shadow: "#0c5f56" },
    ghost: {
        bg: "rgba(255,255,255,0.04)",
        text: "#f5c516",
        shadow: "#3d2d18",
        border: "2px solid #3d2d18",
    },
};

type SizeConfig = {
    cls: string;
    depth: string;
};

const SIZES: Record<GameButtonSize, SizeConfig> = {
    sm: { cls: "py-2   px-4  text-xs  rounded-lg  font-bold", depth: "3px" },
    md: { cls: "py-3   px-5  text-sm  rounded-xl  font-black", depth: "4px" },
    lg: { cls: "py-4   px-8  text-lg  rounded-xl  font-black", depth: "5px" },
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
    const s = SIZES[size];

    const style = {
        "--btn-depth": s.depth,
        "--btn-shadow": v.shadow,
        background: v.bg,
        color: v.text,
        border: v.border ?? "none",
    } as React.CSSProperties;

    const baseClass = `btn-game inline-flex items-center justify-center gap-2 ${s.cls} ${className}`;

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
