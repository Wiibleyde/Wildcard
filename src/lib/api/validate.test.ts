import { describe, expect, it } from "vitest";
import {
    booleanField,
    InvalidInput,
    invalidInput,
    numberField,
    objectField,
    oneOfField,
    stringField,
} from "./validate";

describe("field readers", () => {
    const body = { s: "x", n: 2, b: false, o: { a: 1 }, arr: [1], nan: NaN };

    it("return the typed value", () => {
        expect(stringField(body, "s")).toBe("x");
        expect(numberField(body, "n")).toBe(2);
        expect(booleanField(body, "b")).toBe(false);
        expect(objectField(body, "o")).toEqual({ a: 1 });
        expect(oneOfField(body, "s", ["x", "y"])).toBe("x");
    });

    it("throw InvalidInput naming the field", () => {
        expect(() => stringField(body, "n")).toThrow(InvalidInput);
        expect(() => numberField(body, "nan")).toThrow(InvalidInput);
        expect(() => booleanField(body, "missing")).toThrow(InvalidInput);
        expect(() => objectField(body, "arr")).toThrow(InvalidInput);
        try {
            oneOfField(body, "s", ["y"]);
        } catch (err) {
            expect(err instanceof InvalidInput && err.field).toBe("s");
        }
    });
});

describe("invalidInput", () => {
    it("is a 400 with a machine code", async () => {
        const res = invalidInput("moduleId");
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
            error: "invalid_input",
            field: "moduleId",
        });
    });
});
