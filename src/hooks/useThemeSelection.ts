"use client";

import { useState } from "react";
import { useApiMutation } from "@/hooks/useApiMutation";
import type { CustomizationPatch } from "@/lib/models/customization";

export function useThemeSelection(
    field: keyof CustomizationPatch,
    initialId: string,
) {
    const [activeId, setActiveId] = useState(initialId);
    const mutation = useApiMutation<CustomizationPatch>("/api/customization");

    async function select(id: string) {
        if (id === activeId || mutation.isPending()) return;
        const prev = activeId;
        setActiveId(id);
        const ok = await mutation.mutate({ [field]: id });
        if (!ok) setActiveId(prev);
    }

    return { activeId, select, mutation };
}
