import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { apiFetch } from "@/lib/api/client";

const ROOM_ERROR_KEYS = {
    not_found: "error_not_found",
    room_full: "error_room_full",
    already_started: "error_already_started",
    rate_limited: "error_rate_limited",
    maintenance: "error_maintenance",
    payload_too_large: "error_payload_too_large",
} as const;

function isRoomErrorCode(code: unknown): code is keyof typeof ROOM_ERROR_KEYS {
    return typeof code === "string" && Object.hasOwn(ROOM_ERROR_KEYS, code);
}

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
    const t = useTranslations("lobby");
    const tCommon = useTranslations("common");
    const router = useRouter();
    const [busy, setBusy] = useState<Busy | null>(null);
    const [error, setError] = useState<string | null>(null);

    function describeError(errorCode: unknown): string {
        return isRoomErrorCode(errorCode)
            ? t(ROOM_ERROR_KEYS[errorCode])
            : tCommon("error");
    }

    async function run(
        next: Busy,
        request: () => Promise<Response>,
        codeFromData: (data: { code?: string }) => string,
    ) {
        setBusy(next);
        setError(null);
        try {
            const res = await request();
            const data = (await res.json().catch(() => ({}))) as {
                code?: string;
                error?: unknown;
            };
            const target = res.ok ? codeFromData(data) : "";
            if (!target) {
                setBusy(null);
                setError(describeError(data.error));
                return;
            }
            // Stay busy while navigating so the button can't double-submit.
            router.push(`/lobby/${target}`);
        } catch {
            setBusy(null);
            setError(describeError(null));
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
            (data) => data.code ?? "",
        );
    }

    async function joinRoom(target: string) {
        const normalized = target.trim().toUpperCase();
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
