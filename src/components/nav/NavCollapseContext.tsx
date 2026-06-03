"use client";

import { createContext, useContext } from "react";

type NavCollapseCtx = {
    collapsed: boolean;
    toggle: () => void;
};

export const NavCollapseContext = createContext<NavCollapseCtx>({
    collapsed: false,
    toggle: () => {},
});

export function useNavCollapse() {
    return useContext(NavCollapseContext);
}
