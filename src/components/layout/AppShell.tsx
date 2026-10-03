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
            {/* Clip x: fanned and tilted cards may lean past the edge; never a horizontal scroll. */}
            <div
                className={`overflow-x-clip ${authed ? "pb-20 md:pb-0 md:pl-55 xl:pl-64" : ""}`}
            >
                {children}
            </div>
        </>
    );
}
