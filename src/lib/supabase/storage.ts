import { getSupabaseEnv } from "./env";

/**
 * Public URL for an object in a public bucket, always built from the **public**
 * Supabase URL — the one the browser can reach (`localhost:54321` mapped to
 * Kong in dev/Docker, the real domain in prod).
 *
 * Why not `supabase.storage.from(b).getPublicUrl(p)`: a server client built by
 * {@link createClient} now talks to Supabase over the internal host
 * (`http://kong:8000`, see {@link getServerSupabaseEnv}), so its `getPublicUrl`
 * would emit a `kong:8000` URL the browser cannot resolve. This helper is host-
 * agnostic on the server (reads the public `process.env.SUPABASE_URL`) and works
 * the same in the browser, so the `<img>` src is always browser-loadable.
 *
 * Pair with `unoptimized` on the `<Image>`: the Next image optimizer runs inside
 * the container, where it can neither reach `localhost:54321` (that's the app
 * container, not Kong) nor optimize an upstream that resolves to a private IP.
 * Avatars are small user uploads from a public bucket — the browser fetches them
 * directly, no server round-trip.
 */
export function publicStorageUrl(bucket: string, path: string): string {
    const { url } = getSupabaseEnv();
    return `${url}/storage/v1/object/public/${bucket}/${path}`;
}
