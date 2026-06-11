import { describe, expect, it } from "vitest";
import {
    DEFAULT_PLAY_ANIMATION,
    getPlayAnimation,
    PLAY_ANIMATIONS,
} from "./animations";
import type { PlayAnimationRef } from "./types";

describe("PLAY_ANIMATIONS registry", () => {
    it("registers every template under its own id", () => {
        for (const [id, template] of Object.entries(PLAY_ANIMATIONS)) {
            expect(template.id).toBe(id);
            expect(template.name.length).toBeGreaterThan(0);
            expect(typeof template.animate).toBe("function");
        }
    });

    it("includes the default template", () => {
        expect(PLAY_ANIMATIONS[DEFAULT_PLAY_ANIMATION]).toBeDefined();
    });
});

describe("getPlayAnimation", () => {
    it("falls back to the default when the deck declares nothing", () => {
        expect(getPlayAnimation(undefined).id).toBe(DEFAULT_PLAY_ANIMATION);
    });

    it("resolves the template a deck references", () => {
        expect(getPlayAnimation({ template: "arc" }).id).toBe("arc");
        expect(getPlayAnimation({ template: "flip" }).id).toBe("flip");
    });

    it("survives unknown ids coming from JSON-stored studio decks", () => {
        const rogue = { template: "explode" } as unknown as PlayAnimationRef;
        expect(getPlayAnimation(rogue).id).toBe(DEFAULT_PLAY_ANIMATION);
    });
});
