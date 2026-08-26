/**
 * Core pack logic for `@openclime/plugin-pack`.
 *
 * Ported from `scripts/pack-plugin.mjs` (the monorepo's original pack script)
 * so third-party plugin repos can run the SAME packing pipeline the official
 * examples use — same skip rules, same manifest validation, same integrity
 * derivation. The monorepo's `scripts/pack-plugin.mjs` is now a thin shell
 * over this package; `scripts/seed-marketplace.mjs` keeps consuming the same
 * JSON summary shape (this package only ADDS fields).
 *
 * Steps (each matches `apps/web/src/lib/upload.ts` so the result is byte-equal
 * to what the marketplace upload gate accepts):
 *   1. Locate the manifest — `<dir>/manifest.json` or the canonical
 *      `<dir>/dist/manifest.json` wrapper (mirrors desktop `locateManifestDir`).
 *   2. Walk the directory, skipping node_modules / .git / OS junk / *.map.
 *   3. Validate the manifest with the same light gate the desktop install
 *      enforces (required fields + safe id + entry files exist). The stricter
 *      `MARKETPLACE_MANIFEST_SCHEMA` is intentionally NOT applied here — the
 *      official examples' long descriptions exceed its 800-char cap, and the
 *      market-side strict layer belongs to the registry CI gate (Phase 2).
 *   4. Compute SHA-256 over [main, nodeEntry?] in declaration order using the
 *      shared `digestEntryFiles` (single source of truth for hash ordering).
 *   5. Inject `manifest.integrity = "sha256:<hex>"` into the zip copy.
 *   6. Write the zip; report size, entry integrity, AND the zip's own sha256
 *      (the field the registry pins for tamper-evidence on GitHub releases).
 *   7. Unless disabled, also write two versionless alias assets next to the
 *      zip so GitHub's `releases/latest/download/` URLs stay constructible
 *      without an API call: `<id>.zip` (byte copy of the versioned zip) and
 *      `manifest.json` (the exact integrity-injected bytes shipped inside the
 *      zip — what a version probe fetches). One plugin = one repo = one
 *      latest release; the aliases are how `latest` stays nameable.
 */
export interface PackArgs {
    /** Plugin directory (containing manifest.json or dist/manifest.json). */
    dir: string;
    /** Output zip path. Defaults to `<dir>/release/<id>-<version>.zip`. */
    out?: string;
    /** Validate only — no zip is written. */
    check?: boolean;
    /**
     * Write the versionless alias assets (`<id>.zip` + `manifest.json`) next
     * to the zip. Default ON — they are what `releases/latest/download/`
     * URLs point at. `--no-aliases` opts out (e.g. local dev packs).
     */
    aliases?: boolean;
}
export interface PackSummary {
    ok: true;
    /** Resolved zip path (absent in --check mode). */
    zip?: string;
    id: string;
    name: string;
    version: string;
    entryCount: number;
    uncompressedBytes: number;
    /** Present in write mode only. */
    zippedBytes?: number;
    /** Zip file's own SHA-256 hex — the field the registry pins. */
    sha256?: string;
    /** Manifest integrity: `sha256:<hex>` over [main, nodeEntry?]. */
    integrity: string;
    /** Alias asset paths — present in write mode with aliases enabled only. */
    aliasZip?: string;
    aliasManifest?: string;
}
/**
 * Locate the manifest. Mirrors desktop `locateManifestDir`: prefer the
 * `<root>/manifest.json` at the root, otherwise the single manifest found
 * one level deep (so `dist/` wrappers still work).
 */
export declare function locateManifestDir(root: string): Promise<string | null>;
/**
 * Pack a plugin directory into a marketplace-ready zip (or validate it when
 * `check` is set). Returns the JSON summary; throws on any validation failure.
 */
export declare function packPlugin(args: PackArgs): Promise<PackSummary>;
/** SHA-256 hex digest of raw bytes (Web Crypto, available Node ≥ 20). */
export declare function sha256Hex(bytes: Uint8Array): Promise<string>;
//# sourceMappingURL=pack.d.ts.map