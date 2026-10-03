import { Button } from "@/components/nb/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type GameButtonVariant =
    | "gold"
    | "green"
    | "red"
    | "teal"
    | "purple"
    | "cream"
    | "ghost";
export type GameButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<GameButtonVariant, string> = {
    gold: "bg-wc-gold text-wc-ink",
    green: "bg-wc-green text-wc-ink",
    red: "bg-wc-red text-wc-accent-ink",
    teal: "bg-wc-blue text-wc-accent-ink",
    purple: "bg-wc-purple text-wc-accent-ink",
    cream: "bg-wc-cream text-wc-ink",
    ghost: "border-transparent bg-transparent text-wc-cream shadow-none hover:translate-x-0 hover:translate-y-0 hover:bg-white/5",
};

const SIZES: Record<GameButtonSize, string> = {
    sm: "h-auto px-3.5 py-2 text-sm",
    md: "h-auto px-4.5 py-2.75 text-base",
    lg: "h-auto px-6 py-3.5 text-xl",
};

type BaseProps = {
    variant?: GameButtonVariant;
    size?: GameButtonSize;
    children: React.ReactNode;
    className?: string;
    disabled?: boolean;
    ariaLabel?: string;
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

export function gameButtonClass(
    variant: GameButtonVariant = "gold",
    size: GameButtonSize = "md",
    className?: string,
): string {
    return cn(
        "border-nb font-display font-normal tracking-wc-cap leading-none",
        VARIANTS[variant],
        SIZES[size],
        className,
    );
}

export function GameButton({
    variant = "gold",
    size = "md",
    children,
    className,
    disabled = false,
    ariaLabel,
    ...rest
}: GameButtonProps) {
    const classes = gameButtonClass(variant, size, className);
    const buttonVariant = variant === "ghost" ? "noShadow" : "default";

    // A disabled link renders as a disabled <button>: not navigable, not focusable.
    if ("href" in rest && rest.href !== undefined && !disabled) {
        // Off-site targets (the portal) bypass the locale-prefixing i18n Link.
        const link = /^https?:\/\//.test(rest.href) ? (
            // biome-ignore lint/a11y/useAnchorContent: content is injected by Button's render prop
            <a href={rest.href} />
        ) : (
            <Link href={rest.href} />
        );
        return (
            <Button
                variant={buttonVariant}
                className={classes}
                aria-label={ariaLabel}
                nativeButton={false}
                render={link}
            >
                {children}
            </Button>
        );
    }

    const { type = "button", onClick, form } = rest as AsButton;

    return (
        <Button
            variant={buttonVariant}
            type={type}
            className={classes}
            disabled={disabled}
            aria-label={ariaLabel}
            onClick={onClick}
            form={form}
        >
            {children}
        </Button>
    );
}
