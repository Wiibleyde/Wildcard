import { useState } from "react";
import { useApiErrorLabel } from "@/hooks/useApiErrorLabel";
import { useRouter } from "@/i18n/navigation";
import { apiFetch, readApiJson } from "@/lib/api/client";
import { normalizeRoomCode } from "@/lib/models/roomCode";

type Busy = { action: "join" } | { action: "create"; moduleId: string };

export interface RoomActionHandle {
    readonly busy: Busy | null;
    /** Module whose room is being created — only that card shows "creating". */
    readonly busyModuleId: string | null;
    readonly error: string | null;
    readonly createRoom: (moduleId: string) => Promise<void>;
    readonly joinRoom: (code: string) => Promise<void>;
}

export function useRoomAction(): RoomActionHandle {
    const errorLabel = useApiErrorLabel();
    const router = useRouter();
    const [busy, setBusy] = useState<Busy | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function run(
        next: Busy,
        request: () => Promise<Response>,
        codeFromData: (data: { code?: string } | null) => string,
    ) {
        setBusy(next);
        setError(null);
        try {
            const res = await request();
            const data = await readApiJson<{ code?: string; error?: unknown }>(
                res,
            );
            const target = res.ok ? codeFromData(data) : "";
            if (!target) {
                setBusy(null);
                setError(errorLabel(data?.error));
                return;
            }
            // Stay busy while navigating so the button can't double-submit.
            router.push(`/lobby/${target}`);
        } catch {
            setBusy(null);
            setError(errorLabel(null));
        }
    }

    async function createRoom(moduleId: string) {
        await run(
            { action: "create", moduleId },
            () =>
                apiFetch("/api/rooms", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ moduleId, visibility: "private" }),
                }),
            (data) => data?.code ?? "",
        );
    }

    async function joinRoom(target: string) {
        const normalized = normalizeRoomCode(target.trim());
        if (!normalized) return;
        await run(
            { action: "join" },
            () => apiFetch(`/api/rooms/${normalized}/join`, { method: "POST" }),
            () => normalized,
        );
    }

    return {
        busy,
        busyModuleId: busy?.action === "create" ? busy.moduleId : null,
        error,
        createRoom,
        joinRoom,
    };
}
