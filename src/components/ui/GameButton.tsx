import { Button } from "@/components/ui/base/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type GameButtonVariant =
    | "gold"
    | "green"
    | "red"
    | "teal"
    | "orange"
    | "purple"
    | "cream"
    | "ghost";
export type GameButtonSize = "sm" | "md" | "lg";

// Each button rests on a darker shade of its own colour (`--press`) and sinks into it when pressed.
const VARIANTS: Record<GameButtonVariant, string> = {
    gold: "bg-wc-gold text-wc-ink [--press:var(--gold-d)]",
    green: "bg-wc-green text-white text-shadow [--press:var(--green-d)]",
    red: "bg-wc-red text-white text-shadow [--press:var(--red-d)]",
    teal: "bg-wc-blue text-white text-shadow [--press:var(--blue-d)]",
    orange: "bg-wc-orange text-white text-shadow [--press:var(--orange-d)]",
    purple: "bg-wc-purple text-white text-shadow [--press:var(--purple-d)]",
    cream: "bg-wc-panel-d2 text-wc-cream text-shadow [--press:#110c17]",
    ghost: "bg-transparent text-wc-cream shadow-none hover:bg-white/5",
};

const SIZES: Record<GameButtonSize, string> = {
    sm: "h-auto rounded-[10px] px-3.5 py-2 text-sm",
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
        "border-0 font-body font-extrabold leading-none",
        variant !== "ghost" && "wc-press",
        "disabled:bg-wc-track disabled:text-wc-sub disabled:opacity-100 disabled:[--press:var(--panel-d)] disabled:[text-shadow:none] data-disabled:bg-wc-track data-disabled:text-wc-sub data-disabled:opacity-100",
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
