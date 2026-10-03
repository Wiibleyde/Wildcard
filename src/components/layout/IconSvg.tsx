export function IconSvg({
    children,
    className = "w-5 h-5",
    strokeWidth = "2",
}: {
    children: React.ReactNode;
    className?: string;
    strokeWidth?: string;
}) {
    return (
        <svg
            viewBox="0 0 24 24"
            className={className}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {children}
        </svg>
    );
}
