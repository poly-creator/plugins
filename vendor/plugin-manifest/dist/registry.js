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
import { SAFE_PLUGIN_ID } from "./safe-id.js";
/** GitHub `owner/name` — no leading/trailing slash, no path traversal. */
const GITHUB_REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
/** Release tags are `v` + numeric semver (`v0.1.0`), matching the plan's
 *  `release.yml` tag trigger and the pack CLI's `<id>-<version>.zip` naming. */
const RELEASE_TAG = /^v\d+\.\d+\.\d+$/;
/** Zip asset filename — a single release-asset name (GitHub assets are flat). */
const ASSET_NAME = /^[^"<>|:*?\\/]+$/;
/** Pinned zip digest — exactly 64 lowercase hex chars. */
const SHA256_HEX = /^[a-f0-9]{64}$/;
/** `added_at` — ISO 8601 datetime (no timezone offset required). */
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
export const MAX_REGISTRY_CATEGORIES = 5;
/** One registry entry — one plugin's pinned release asset. */
export const REGISTRY_ENTRY_SCHEMA = z.object({
    id: z.string().max(64).regex(SAFE_PLUGIN_ID, "id must be a safe single path segment"),
    repo: z.string().regex(GITHUB_REPO, "repo must be owner/name"),
    tag: z.string().regex(RELEASE_TAG, "tag must be vX.Y.Z"),
    asset: z.string().max(200).regex(ASSET_NAME, "asset must be a release asset filename"),
    sha256: z.string().regex(SHA256_HEX, "sha256 must be 64 lowercase hex chars"),
    description: z.string().max(800).optional(),
    categories: z.array(z.string().trim().min(1).max(32)).max(MAX_REGISTRY_CATEGORIES).optional(),
    homepage: z.string().url().optional(),
    added_at: z.string().regex(ISO_DATETIME, "added_at must be an ISO 8601 datetime"),
});
/** The whole registry file: a schema version + the entry list. */
export const REGISTRY_SCHEMA = z.object({
    schema_version: z.literal(1),
    plugins: z.array(REGISTRY_ENTRY_SCHEMA),
});
/**
 * Compose the download URL for an entry: the GitHub release asset URL derived
 * from `repo` / `tag` / `asset`. The one place this string is built — entry
 * authors and consumers must not hand-assemble it.
 */
export function registryAssetUrl(entry) {
    return `https://github.com/${entry.repo}/releases/download/${entry.tag}/${entry.asset}`;
}
//# sourceMappingURL=registry.js.map