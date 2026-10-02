import { NextResponse } from "next/server";
import { isJsonObject } from "@/lib/json";

/** Thrown by the field readers; {@link apiRoute} turns it into a 400. */
export class InvalidInput extends Error {
    constructor(readonly field: string) {
        super(`invalid_input: ${field}`);
        this.name = "InvalidInput";
    }
}

export function invalidInput(field: string): NextResponse {
    return NextResponse.json(
        { error: "invalid_input", field },
        { status: 400 },
    );
}

type Body = Readonly<Record<string, unknown>>;

export function stringField(body: Body, key: string): string {
    const value = body[key];
    if (typeof value !== "string") throw new InvalidInput(key);
    return value;
}

export function numberField(body: Body, key: string): number {
    const value = body[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new InvalidInput(key);
    }
    return value;
}

export function booleanField(body: Body, key: string): boolean {
    const value = body[key];
    if (typeof value !== "boolean") throw new InvalidInput(key);
    return value;
}

export function objectField(body: Body, key: string): Record<string, unknown> {
    const value = body[key];
    if (!isJsonObject(value)) throw new InvalidInput(key);
    return value;
}

export function oneOfField<const T extends string>(
    body: Body,
    key: string,
    values: readonly T[],
): T {
    const value = body[key];
    if (!values.includes(value as T)) throw new InvalidInput(key);
    return value as T;
}
