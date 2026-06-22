"use client";

import { useState } from "react";

export function useButtonPress() {
    const [pressed, setPressed] = useState(false);

    const handlers = {
        onMouseDown: () => setPressed(true),
        onMouseUp: () => setPressed(false),
        onMouseLeave: () => setPressed(false),
    };

    return { pressed, handlers };
}
