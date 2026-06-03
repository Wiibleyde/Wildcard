"use client";

import { useEffect, useState } from "react";
import { NavCollapseContext } from "./NavCollapseContext";

type Props = {
    appNav: React.ReactNode;
    children: React.ReactNode;
};

export function AppShell({ appNav, children }: Props) {
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        if (localStorage.getItem("nav-collapsed") === "true") {
            setCollapsed(true);
        }
    }, []);

    function toggle() {
        setCollapsed((prev) => {
            const next = !prev;
            localStorage.setItem("nav-collapsed", String(next));
            return next;
        });
    }

    return (
        <NavCollapseContext.Provider value={{ collapsed, toggle }}>
            {appNav}
            <div
                className={`pb-15 md:pb-0 transition-all duration-200 ${
                    collapsed ? "md:pl-14" : "md:pl-55 xl:pl-64"
                }`}
            >
                {children}
            </div>
        </NavCollapseContext.Provider>
    );
}
