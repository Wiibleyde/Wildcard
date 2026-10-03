import { type MutableRefObject, useRef, useState } from "react";
import { useApiErrorLabel } from "@/hooks/useApiErrorLabel";
import { useRouter } from "@/i18n/navigation";
import { apiFetch, readApiError, readApiJson } from "@/lib/api/client";
import {
    type GameRuleMode,
    type GameRuleToggle,
    resolveRuleToggles,
    ruleModeValues,
} from "@/lib/engine/types";
import type { Role } from "@/lib/lobby/roster";

type Params = {
    code: string;
    maxPlayers: number;
    seatCount: number;
    botCount: number;
    setBotCount: (n: number) => void;
    rules: Record<string, boolean>;
    setRules: (r: Record<string, boolean>) => void;
    ruleToggles: readonly GameRuleToggle[];
    role: Role;
    setRole: (r: Role) => void;
    refresh: () => Promise<void>;
    closedRef: MutableRefObject<boolean>;
    mutatingRef: MutableRefObject<number>;
};

/**
 * Every action of the waiting room: host settings (optimistic, rolled back on
 * refusal), start, leave and the player/spectator switch. One busy flag and
 * one error for the whole room.
 */
export function useRoomControls({
    code,
    maxPlayers,
    seatCount,
    botCount,
    setBotCount,
    rules,
    setRules,
    ruleToggles,
    role,
    setRole,
    refresh,
    closedRef,
    mutatingRef,
}: Params) {
    const errorLabel = useApiErrorLabel();
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [settingsBusy, setSettingsBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Synchronous guard: a second click fired before the re-render would still see settingsBusy=false.
    const settingsInFlight = useRef(false);

    /** Optimistic host mutation: apply, POST, roll back on refusal, reconcile. */
    async function mutateSetting(
        apply: () => () => void,
        request: () => Promise<Response>,
    ) {
        if (settingsInFlight.current) return;
        settingsInFlight.current = true;
        setSettingsBusy(true);
        setError(null);
        mutatingRef.current += 1;
        const rollback = apply();
        try {
            const res = await request();
            if (!res.ok) {
                rollback();
                setError(errorLabel(await readApiError(res)));
            }
        } catch {
            rollback();
            setError(errorLabel(null));
        } finally {
            mutatingRef.current -= 1;
            settingsInFlight.current = false;
            setSettingsBusy(false);
        }
        await refresh().catch(() => {});
    }

    const postJson = (path: string, body: unknown) =>
        apiFetch(`/api/rooms/${code}/${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

    function setBots(next: number) {
        const clamped = Math.max(0, Math.min(next, maxPlayers - seatCount));
        if (clamped === botCount) return;
        const previous = botCount;
        return mutateSetting(
            () => {
                setBotCount(clamped);
                return () => setBotCount(previous);
            },
            () => postJson("bots", { count: clamped }),
        );
    }

    function saveRules(next: Record<string, boolean>) {
        const previous = rules;
        return mutateSetting(
            () => {
                setRules(next);
                return () => setRules(previous);
            },
            () => postJson("rules", { rules: next }),
        );
    }

    function setRule(key: string, value: boolean) {
        // Resolved locally so a dependency flip shows instantly; the server re-resolves.
        return saveRules(
            resolveRuleToggles(ruleToggles, { ...rules, [key]: value }),
        );
    }

    function pickMode(mode: GameRuleMode) {
        return saveRules(ruleModeValues(ruleToggles, mode));
    }

    async function start() {
        setBusy(true);
        setError(null);
        try {
            const res = await apiFetch(`/api/rooms/${code}/start`, {
                method: "POST",
            });
            const data = await readApiJson<{
                error?: string;
                gameId?: string;
            }>(res);
            if (!res.ok || !data?.gameId) {
                setError(errorLabel(data?.error));
                setBusy(false);
                return;
            }
            // Stay busy while navigating so Start can't be pressed twice.
            router.push(`/game/${data.gameId}`);
        } catch {
            setError(errorLabel(null));
            setBusy(false);
        }
    }

    async function leave() {
        setBusy(true);
        setError(null);
        try {
            const res = await apiFetch(`/api/rooms/${code}/leave`, {
                method: "POST",
            });
            if (!res.ok) {
                setError(errorLabel(await readApiError(res)));
                setBusy(false);
                return;
            }
            closedRef.current = true;
            router.push("/lobby");
        } catch {
            setError(errorLabel(null));
            setBusy(false);
        }
    }

    async function toggleRole() {
        const next: Role = role === "spectator" ? "player" : "spectator";
        setBusy(true);
        setError(null);
        try {
            const res = await postJson("role", { role: next });
            if (!res.ok) {
                setError(errorLabel(await readApiError(res)));
                return;
            }
            setRole(next);
            // postgres_changes can be silent on self-hosted stacks: reconcile now, not at the next poll.
            await refresh();
        } catch {
            setError(errorLabel(null));
        } finally {
            setBusy(false);
        }
    }

    return {
        busy,
        settingsBusy,
        error,
        setBots,
        setRule,
        pickMode,
        start,
        leave,
        toggleRole,
    };
}
