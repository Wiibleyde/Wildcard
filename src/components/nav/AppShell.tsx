"use client";

import { NavCollapseContext } from "./NavCollapseContext";

type Props = {
    appNav: React.ReactNode;
    // Reserve the sidebar offset only when the nav is present, else guests see an empty gap.
    authed: boolean;
    children: React.ReactNode;
};

export function AppShell({ appNav, authed, children }: Props) {
    return (
        <NavCollapseContext.Provider
            value={{ collapsed: false, toggle: () => {} }}
        >
            {appNav}
            <div className={authed ? "pb-20 md:pb-0 md:pl-59" : ""}>
                {children}
            </div>
        </NavCollapseContext.Provider>
    );
}
