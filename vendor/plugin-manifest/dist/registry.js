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
import { SAFE_PLUGIN_ID } from "./safe-id.js";
/** GitHub `owner/name` — no leading/trailing slash, no path traversal. */
const GITHUB_REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
/** Release tags are `v` + numeric semver (`v0.1.0`), matching the template's
 * `release.yml` tag trigger and the pack CLI's `<id>-<version>.zip` naming. */
const RELEASE_TAG = /^v\d+\.\d+\.\d+$/;
/** Pinned zip digest — exactly 64 lowercase hex chars. */
const SHA256_HEX = /^[a-f0-9]{64}$/;
/** `added_at` — ISO 8601 datetime (no timezone offset required). */
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
export const MAX_REGISTRY_CATEGORIES = 5;
/** One registry entry — one plugin repo, in latest or pinned mode. */
export const REGISTRY_ENTRY_SCHEMA = z
    .object({
    id: z.string().max(64).regex(SAFE_PLUGIN_ID, "id must be a safe single path segment"),
    name: z.string().trim().min(1).max(100),
    author: z.string().trim().min(1).max(100),
    repo: z.string().regex(GITHUB_REPO, "repo must be owner/name"),
    description: z.string().max(800).optional(),
    categories: z.array(z.string().trim().min(1).max(32)).max(MAX_REGISTRY_CATEGORIES).optional(),
    homepage: z.string().url().optional(),
    /** First-party marker — the validator only allows it on bingryan/* repos. */
    official: z.boolean().optional(),
    /** Pinned mode: exact release tag. Must pair with `sha256`. */
    tag: z.string().regex(RELEASE_TAG, "tag must be vX.Y.Z").optional(),
    /** Pinned mode: sha256 of the `<id>-<version>.zip` asset. Must pair with `tag`. */
    sha256: z.string().regex(SHA256_HEX, "sha256 must be 64 lowercase hex chars").optional(),
    added_at: z.string().regex(ISO_DATETIME, "added_at must be an ISO 8601 datetime"),
})
    .refine((e) => (e.tag === undefined) === (e.sha256 === undefined), { message: "tag and sha256 must both be present (pinned) or both absent (latest)" });
/** The whole registry file: a schema version + the entry list. */
export const REGISTRY_SCHEMA = z.object({
    schema_version: z.literal(2),
    plugins: z.array(REGISTRY_ENTRY_SCHEMA),
});
/** True when the entry pins an exact release (tag + sha256), false for
 * `releases/latest` mode. The one place the mode decision is made. */
export function isPinnedEntry(entry) {
    return typeof entry.tag === "string";
}
/**
 * Install URL for latest-mode entries: the versionless alias asset uploaded
 * by the author's release workflow (`release/<id>.zip`). CDN redirect, no
 * API call, no rate limit, always the newest full (non-prerelease) release.
 */
export function registryLatestZipUrl(entry) {
    return `https://github.com/${entry.repo}/releases/latest/download/${entry.id}.zip`;
}
/**
 * Version-probe URL: the versionless `manifest.json` alias asset — the exact
 * integrity-injected manifest bytes that ship inside the zip. One GET tells
 * the desktop the latest version (and permissions) without the GitHub API.
 */
export function registryLatestManifestUrl(repo) {
    return `https://github.com/${repo}/releases/latest/download/manifest.json`;
}
/**
 * Install URL for pinned-mode entries: the versioned asset name derived from
 * the tag (`<id>-<version>.zip`, the pack CLI's canonical output). Only
 * meaningful together with the entry's `sha256` pin.
 */
export function registryPinnedUrl(entry) {
    const version = entry.tag.replace(/^v/, "");
    return `https://github.com/${entry.repo}/releases/download/${entry.tag}/${entry.id}-${version}.zip`;
}
//# sourceMappingURL=registry.js.map