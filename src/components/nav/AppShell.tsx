type Props = {
    appNav: React.ReactNode;
    // Reserve the sidebar offset only when the nav is present, else guests see an empty gap.
    authed: boolean;
    children: React.ReactNode;
};

// Offset mirrors the SidebarDesktop width: w-55 (13.75rem = 220px) from md:, w-64 from xl:.
export function AppShell({ appNav, authed, children }: Props) {
    return (
        <>
            {appNav}
            <div className={authed ? "pb-20 md:pb-0 md:pl-55 xl:pl-64" : ""}>
                {children}
            </div>
        </>
    );
}
