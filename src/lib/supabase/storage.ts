import { getSupabaseEnv, getSupabaseSchema } from "./env";

/**
 * Public object URL built from the *public* Supabase URL: the server client's
 * `getPublicUrl` would emit the internal Kong host, unreachable from the browser.
 * Pair with `unoptimized` on `<Image>` (the optimizer cannot reach that host either).
 */
export function publicStorageUrl(bucket: string, path: string): string {
    const { url } = getSupabaseEnv();
    return `${url}/storage/v1/object/public/${bucket}/${path}`;
}

/** Storage is shared by every app on the instance: one bucket per schema. */
export function ecaImagesBucket(): string {
    return `${getSupabaseSchema()}-eca-images`;
}
