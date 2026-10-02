/** True for a plain JSON object (not null, not an array). */
export function isJsonObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Cast a typed value into a jsonb column / RPC argument. */
export function toJson(value: object): Record<string, unknown> {
    return value as Record<string, unknown>;
}

export function toJsonArray(
    values: readonly object[],
): Record<string, unknown>[] {
    return values as Record<string, unknown>[];
}

/** Read back a jsonb value the server itself wrote with a known shape. */
export function fromJson<T>(value: unknown): T {
    return value as T;
}
