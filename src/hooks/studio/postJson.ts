import { apiFetch } from "@/lib/api/client";
import { isRecord } from "@/lib/eca/schema";

type PostResult =
    | { readonly ok: true; readonly data: Record<string, unknown> }
    | { readonly ok: false; readonly error: string | null };

/** POST that also hands back the response body (useApiMutation only reports success). */
export async function postJson(
    path: `/api/${string}`,
    body: unknown,
): Promise<PostResult> {
    try {
        const res = await apiFetch(path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        // A proxy error page is not JSON.
        const parsed: unknown = await res.json().catch(() => null);
        const data = isRecord(parsed) ? parsed : {};
        if (res.ok) return { ok: true, data };
        return {
            ok: false,
            error: typeof data.error === "string" ? data.error : null,
        };
    } catch {
        return { ok: false, error: null };
    }
}
