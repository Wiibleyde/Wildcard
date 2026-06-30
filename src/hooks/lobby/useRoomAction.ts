import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";

const ROOM_ERROR_KEYS = new Set(["not_found", "room_full", "already_started"]);

type Action = "create" | "join";

export function useRoomAction() {
    const t = useTranslations("lobby");
    const router = useRouter();
    const [busy, setBusy] = useState<Action | null>(null);
    const [error, setError] = useState<string | null>(null);

    function describeError(errorCode: unknown): string {
        if (typeof errorCode === "string" && ROOM_ERROR_KEYS.has(errorCode)) {
            return t(`error_${errorCode}` as "error_not_found");
        }
        return t("error_generic");
    }

    async function run(
        action: Action,
        request: () => Promise<Response>,
        codeFromData: (data: { code?: string }) => string,
    ) {
        setBusy(action);
        setError(null);
        const res = await request();
        const data = await res.json();
        if (!res.ok) {
            setBusy(null);
            setError(describeError(data.error));
            return;
        }
        router.push(`/lobby/${codeFromData(data)}`);
    }

    function createRoom(
        moduleId: string,
        visibility: "public" | "private" = "private",
    ) {
        return run(
            "create",
            () =>
                fetch("/api/rooms", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ moduleId, visibility }),
                }),
            (data) => data.code ?? "",
        );
    }

    function joinRoom(target: string) {
        const normalized = target.trim().toUpperCase();
        if (!normalized) return;
        return run(
            "join",
            () => fetch(`/api/rooms/${normalized}/join`, { method: "POST" }),
            () => normalized,
        );
    }

    return { busy, error, createRoom, joinRoom };
}
