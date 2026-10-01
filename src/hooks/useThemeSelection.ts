"use client";

import { useRef, useState } from "react";
import { useApiMutation } from "@/hooks/useApiMutation";
import type { CustomizationPatch } from "@/lib/models/customization";

export function useThemeSelection(
    field: keyof CustomizationPatch,
    initialId: string,
) {
    const [activeId, setActiveId] = useState(initialId);
    const mutation = useApiMutation<CustomizationPatch>("/api/customization");
    // Synchronous in-flight guard — `mutation.status` from this render's
    // closure is stale for a rapid second click.
    const inFlight = useRef(false);

    async function select(id: string) {
        if (id === activeId || inFlight.current) return;
        inFlight.current = true;
        const prev = activeId;
        setActiveId(id);
        try {
            const ok = await mutation.mutate({
                [field]: id,
            } as CustomizationPatch);
            if (!ok) setActiveId(prev);
        } finally {
            inFlight.current = false;
        }
    }

    return { activeId, select, mutation };
}
