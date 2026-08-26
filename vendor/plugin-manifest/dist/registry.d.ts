/**
 * Registry schema (zod) — the `bingryan/plugins` manifest format, v2.
 *
 * The GitHub registry repo (`bingryan/plugins`) holds one `plugins.json`
 * describing every plugin. v2 is the Obsidian-style shape: entries are
 * REPO-level (one plugin = one repo = one `releases/latest`), so publishing
 * a new version is just the author pushing a tag — no registry PR per
 * release. This schema is the single source of truth for its shape, shared
 * by the registry repo's verify.yml, `apps/web` catalog aggregation, and the
 * desktop marketplace.
 *
 * Design invariants (plan decision record):
 *   - Two modes per entry:
 *       latest (default) — no `tag`, no `sha256`. Download URL is
 *         `releases/latest/download/<id>.zip`, constructible without an API
 *         call because the author's release workflow uploads versionless
 *         alias assets (`<id>.zip` + `manifest.json`). Trust = PR review +
 *         the in-zip `manifest.integrity`.
 *       pinned — `tag` + `sha256` together (both or neither). Downloads the
 *         exact `<id>-<version>.zip` asset and byte-verifies the pin; for
 *         review-critical entries that must never move.
 *   - Download URLs are composed at read time, never stored.
 *   - `asset` filenames are NOT stored: latest mode uses the alias
 *     convention, pinned mode derives `<id>-<version>.zip` from the tag.
 *   - `official: true` is reserved for first-party repos (the registry
 *     validator restricts it to `bingryan/*` owners).
 */
import { z } from "zod";
export declare const MAX_REGISTRY_CATEGORIES = 5;
/** One registry entry — one plugin repo, in latest or pinned mode. */
export declare const REGISTRY_ENTRY_SCHEMA: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    author: z.ZodString;
    repo: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    categories: z.ZodOptional<z.ZodArray<z.ZodString>>;
    homepage: z.ZodOptional<z.ZodString>;
    official: z.ZodOptional<z.ZodBoolean>;
    tag: z.ZodOptional<z.ZodString>;
    sha256: z.ZodOptional<z.ZodString>;
    added_at: z.ZodString;
}, z.core.$strip>;
export type RegistryEntry = z.infer<typeof REGISTRY_ENTRY_SCHEMA>;
/** The whole registry file: a schema version + the entry list. */
export declare const REGISTRY_SCHEMA: z.ZodObject<{
    schema_version: z.ZodLiteral<2>;
    plugins: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        author: z.ZodString;
        repo: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        categories: z.ZodOptional<z.ZodArray<z.ZodString>>;
        homepage: z.ZodOptional<z.ZodString>;
        official: z.ZodOptional<z.ZodBoolean>;
        tag: z.ZodOptional<z.ZodString>;
        sha256: z.ZodOptional<z.ZodString>;
        added_at: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type RegistryManifest = z.infer<typeof REGISTRY_SCHEMA>;
/** True when the entry pins an exact release (tag + sha256), false for
 * `releases/latest` mode. The one place the mode decision is made. */
export declare function isPinnedEntry(entry: {
    tag?: unknown;
    sha256?: unknown;
}): boolean;
/**
 * Install URL for latest-mode entries: the versionless alias asset uploaded
 * by the author's release workflow (`release/<id>.zip`). CDN redirect, no
 * API call, no rate limit, always the newest full (non-prerelease) release.
 */
export declare function registryLatestZipUrl(entry: {
    repo: string;
    id: string;
}): string;
/**
 * Version-probe URL: the versionless `manifest.json` alias asset — the exact
 * integrity-injected manifest bytes that ship inside the zip. One GET tells
 * the desktop the latest version (and permissions) without the GitHub API.
 */
export declare function registryLatestManifestUrl(repo: string): string;
/**
 * Install URL for pinned-mode entries: the versioned asset name derived from
 * the tag (`<id>-<version>.zip`, the pack CLI's canonical output). Only
 * meaningful together with the entry's `sha256` pin.
 */
export declare function registryPinnedUrl(entry: {
    repo: string;
    id: string;
    tag: string;
}): string;
//# sourceMappingURL=registry.d.ts.map