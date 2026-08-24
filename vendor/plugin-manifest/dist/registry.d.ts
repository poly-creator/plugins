/**
 * Registry schema (zod) — the `bingryan/plugins` manifest format.
 *
 * The GitHub registry repo (`bingryan/plugins`) holds one `plugins.json`
 * describing every third-party plugin's release asset. This schema is the
 * single source of truth for its shape, shared by:
 *   - the registry repo's validate.yml (gate 1: parse + schema),
 *   - `apps/web` catalog aggregation (Phase 3),
 *   - the desktop deep-link `&sha256=` pin consumer (Phase 4).
 *
 * Design invariants (plan decision record):
 *   - An entry pins `repo` / `tag` / `asset` — the download URL is composed
 *     at read time, never stored (one less place to drift).
 *   - `sha256` is the zip asset's own digest, pinned at review time. The
 *     desktop re-verifies it after download, so a release swapped post-review
 *     is refused.
 *   - Entries are immutable: a new version is a NEW entry with a new tag,
 *     never an edit of an old one. The CI (not this schema) enforces that.
 */
import { z } from "zod";
export declare const MAX_REGISTRY_CATEGORIES = 5;
/** One registry entry — one plugin's pinned release asset. */
export declare const REGISTRY_ENTRY_SCHEMA: z.ZodObject<{
    id: z.ZodString;
    repo: z.ZodString;
    tag: z.ZodString;
    asset: z.ZodString;
    sha256: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    categories: z.ZodOptional<z.ZodArray<z.ZodString>>;
    homepage: z.ZodOptional<z.ZodString>;
    added_at: z.ZodString;
}, z.core.$strip>;
export type RegistryEntry = z.infer<typeof REGISTRY_ENTRY_SCHEMA>;
/** The whole registry file: a schema version + the entry list. */
export declare const REGISTRY_SCHEMA: z.ZodObject<{
    schema_version: z.ZodLiteral<1>;
    plugins: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        repo: z.ZodString;
        tag: z.ZodString;
        asset: z.ZodString;
        sha256: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        categories: z.ZodOptional<z.ZodArray<z.ZodString>>;
        homepage: z.ZodOptional<z.ZodString>;
        added_at: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type RegistryManifest = z.infer<typeof REGISTRY_SCHEMA>;
/**
 * Compose the download URL for an entry: the GitHub release asset URL derived
 * from `repo` / `tag` / `asset`. The one place this string is built — entry
 * authors and consumers must not hand-assemble it.
 */
export declare function registryAssetUrl(entry: {
    repo: string;
    tag: string;
    asset: string;
}): string;
//# sourceMappingURL=registry.d.ts.map