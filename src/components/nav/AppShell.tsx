"use client";

import { NavCollapseContext } from "./NavCollapseContext";

type Props = {
    appNav: React.ReactNode;
    children: React.ReactNode;
};

export function AppShell({ appNav, children }: Props) {
    return (
        <NavCollapseContext.Provider
            value={{ collapsed: false, toggle: () => {} }}
        >
            {appNav}
            <div className="pb-16 md:pb-0 md:pl-60 xl:pl-68">{children}</div>
        </NavCollapseContext.Provider>
    );
}
