"use client";

import { NavCollapseContext } from "./NavCollapseContext";

type Props = {
    appNav: React.ReactNode;
    /**
     * Whether the authenticated chrome (sidebar + bottom nav) is present. The
     * sidebar offset / bottom padding must only be reserved when it is —
     * otherwise a signed-out visitor sees an empty gap where the nav would be.
     */
    authed: boolean;
    children: React.ReactNode;
};

export function AppShell({ appNav, authed, children }: Props) {
    return (
        <NavCollapseContext.Provider
            value={{ collapsed: false, toggle: () => {} }}
        >
            {appNav}
            <div className={authed ? "pb-16 md:pb-0 md:pl-60 xl:pl-68" : ""}>
                {children}
            </div>
        </NavCollapseContext.Provider>
    );
}
