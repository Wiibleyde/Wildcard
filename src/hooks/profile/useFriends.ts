"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    addFriend,
    blockUser,
    listBlocks,
    listFriends,
    PortalApiError,
    type PortalBlock,
    type PortalErrorCode,
    type PortalFriend,
    type PortalTarget,
    refuseFriend,
    removeFriend,
    unblockUser,
} from "@/lib/portal/api";

export type FriendsLoad = "loading" | "ready" | "error";

export interface FriendsHandle {
    readonly load: FriendsLoad;
    readonly friends: readonly PortalFriend[];
    readonly blocks: readonly PortalBlock[];
    /** Last action's (or the load's) portal error code. */
    readonly error: PortalErrorCode | null;
    /** Id (or `"add"`) of the action in flight — disables its buttons. */
    readonly pending: string | null;
    readonly add: (target: PortalTarget) => Promise<boolean>;
    readonly remove: (id: string) => Promise<boolean>;
    readonly refuse: (id: string) => Promise<boolean>;
    readonly block: (id: string) => Promise<boolean>;
    readonly unblock: (id: string) => Promise<boolean>;
    readonly reload: () => Promise<void>;
}

function codeOf(e: unknown): PortalErrorCode {
    return e instanceof PortalApiError ? e.code : "upstream";
}

/**
 * Every action re-reads both lists instead of patching locally: a block ends
 * both friend edges server-side, and the sort order is the portal's.
 */
export function useFriends(): FriendsHandle {
    const [load, setLoad] = useState<FriendsLoad>("loading");
    const [friends, setFriends] = useState<readonly PortalFriend[]>([]);
    const [blocks, setBlocks] = useState<readonly PortalBlock[]>([]);
    const [error, setError] = useState<PortalErrorCode | null>(null);
    const [pending, setPending] = useState<string | null>(null);
    const pendingRef = useRef(false);

    const reload = useCallback(async () => {
        try {
            const [f, b] = await Promise.all([listFriends(), listBlocks()]);
            setFriends(f);
            setBlocks(b);
            setError(null);
            setLoad("ready");
        } catch (e) {
            setError(codeOf(e));
            setLoad((prev) => (prev === "ready" ? prev : "error"));
        }
    }, []);

    useEffect(() => {
        void reload();
    }, [reload]);

    const run = useCallback(
        async (key: string, action: () => Promise<unknown>) => {
            if (pendingRef.current) return false;
            pendingRef.current = true;
            setPending(key);
            setError(null);
            try {
                await action();
                await reload();
                return true;
            } catch (e) {
                setError(codeOf(e));
                return false;
            } finally {
                pendingRef.current = false;
                setPending(null);
            }
        },
        [reload],
    );

    return {
        load,
        friends,
        blocks,
        error,
        pending,
        add: (target) =>
            run("id" in target ? target.id : "add", () => addFriend(target)),
        remove: (id) => run(id, () => removeFriend(id)),
        refuse: (id) => run(id, () => refuseFriend(id)),
        block: (id) => run(id, () => blockUser({ id })),
        unblock: (id) => run(id, () => unblockUser(id)),
        reload,
    };
}
