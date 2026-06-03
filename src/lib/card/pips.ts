export interface PipPosition {
    x: number; // % from left
    y: number; // % from top
    flip: boolean; // rotate 180° (bottom half of card)
}

/**
 * Pip positions for numeric cards (2–10) as percentages within the card's
 * inner content area. Positions follow traditional French-suited deck layouts.
 */
export const PIP_LAYOUTS: Partial<Record<number, PipPosition[]>> = {
    2: [
        { x: 50, y: 22, flip: false },
        { x: 50, y: 78, flip: true },
    ],
    3: [
        { x: 50, y: 20, flip: false },
        { x: 50, y: 50, flip: false },
        { x: 50, y: 80, flip: true },
    ],
    4: [
        { x: 28, y: 25, flip: false },
        { x: 72, y: 25, flip: false },
        { x: 28, y: 75, flip: true },
        { x: 72, y: 75, flip: true },
    ],
    5: [
        { x: 28, y: 25, flip: false },
        { x: 72, y: 25, flip: false },
        { x: 50, y: 50, flip: false },
        { x: 28, y: 75, flip: true },
        { x: 72, y: 75, flip: true },
    ],
    6: [
        { x: 28, y: 22, flip: false },
        { x: 72, y: 22, flip: false },
        { x: 28, y: 50, flip: false },
        { x: 72, y: 50, flip: false },
        { x: 28, y: 78, flip: true },
        { x: 72, y: 78, flip: true },
    ],
    7: [
        { x: 28, y: 20, flip: false },
        { x: 72, y: 20, flip: false },
        { x: 50, y: 35, flip: false },
        { x: 28, y: 52, flip: false },
        { x: 72, y: 52, flip: false },
        { x: 28, y: 78, flip: true },
        { x: 72, y: 78, flip: true },
    ],
    8: [
        { x: 28, y: 18, flip: false },
        { x: 72, y: 18, flip: false },
        { x: 50, y: 33, flip: false },
        { x: 28, y: 50, flip: false },
        { x: 72, y: 50, flip: false },
        { x: 50, y: 67, flip: true },
        { x: 28, y: 80, flip: true },
        { x: 72, y: 80, flip: true },
    ],
    9: [
        { x: 28, y: 18, flip: false },
        { x: 72, y: 18, flip: false },
        { x: 28, y: 38, flip: false },
        { x: 72, y: 38, flip: false },
        { x: 50, y: 50, flip: false },
        { x: 28, y: 62, flip: true },
        { x: 72, y: 62, flip: true },
        { x: 28, y: 82, flip: true },
        { x: 72, y: 82, flip: true },
    ],
    10: [
        { x: 28, y: 15, flip: false },
        { x: 72, y: 15, flip: false },
        { x: 50, y: 28, flip: false },
        { x: 28, y: 40, flip: false },
        { x: 72, y: 40, flip: false },
        { x: 28, y: 60, flip: true },
        { x: 72, y: 60, flip: true },
        { x: 50, y: 72, flip: true },
        { x: 28, y: 85, flip: true },
        { x: 72, y: 85, flip: true },
    ],
};
