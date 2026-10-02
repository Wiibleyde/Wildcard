type Props = {
    appNav: React.ReactNode;
    authed: boolean;
    children: React.ReactNode;
};

// Offset mirrors the SidebarDesktop width (w-55, xl:w-64); guests have no sidebar.
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
