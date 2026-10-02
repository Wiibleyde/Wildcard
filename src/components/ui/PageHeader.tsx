import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";

export function PageHeader({
    title,
    subtitle,
    back,
    badge,
    children,
}: {
    title: string;
    subtitle?: string;
    back?: { href: string; label: string };
    /** Rendered next to the title (role stamp, count…). */
    badge?: ReactNode;
    /** Rendered under the subtitle (page-level actions). */
    children?: ReactNode;
}) {
    return (
        <header className="flex flex-col gap-2">
            {back && (
                <Link
                    href={back.href}
                    className="w-fit font-display text-sm text-wc-muted"
                >
                    <span aria-hidden="true">← </span>
                    {back.label}
                </Link>
            )}
            <div className="flex flex-wrap items-center gap-3">
                <h1 className="h-xl">{title}</h1>
                {badge}
            </div>
            {subtitle && <p className="sub text-sm">{subtitle}</p>}
            {children}
        </header>
    );
}
