/**
 * Canonical marketplace plugin manifest type + required-field checks.
 *
 * The manifest shape mirrors the desktop's `ExternalPluginManifest`
 * (`apps/desktop/electron/main/features/plugins/types.ts`) — a marketplace
 * plugin's `manifest.json` IS a desktop plugin manifest, plus the strict
 * semver/numbered-version rule from the marketplace schema.
 */
/** A plugin manifest as parsed from `manifest.json`. Structurally identical to
 *  the desktop's `ExternalPluginManifest`; the marketplace adds strict version
 *  validation (see `MARKETPLACE_MANIFEST_SCHEMA`). */
export interface PluginManifest {
    id: string;
    name: string;
    version: string;
    author?: string;
    description?: string;
    minAppVersion?: string;
    /** Renderer entry: built ESM served via `openclime-plugin://<id>/<main>`. Required. */
    main: string;
    /** Optional main-process entry for provider/job backends (V1.2). */
    nodeEntry?: string;
    /** Content hash of the plugin's executable surface (`main` + `nodeEntry`
     *  files) — verified by the desktop main process at enable/install. On the
     *  marketplace this field is IGNORED on upload: the server computes the hash
     *  from the actual uploaded bytes and writes the authoritative value. */
    integrity?: string;
    /** Plugin dependency graph: dep plugin id → minimum version floor. */
    dependencies?: Record<string, string>;
    trust?: "trusted" | "safe";
    permissions?: string[];
    categories?: string[];
}
/** Fields the desktop loader treats as required for a plugin to be installable
 *  (port of `readPluginManifestFromDir`'s gate). The marketplace enforces the
 *  same set — a plugin that would be rejected on-device must be rejected here. */
export declare const REQUIRED_MANIFEST_FIELDS: readonly ["id", "name", "version", "main"];
/** Returns the list of required fields missing from `manifest` (empty = valid). */
export declare function missingRequiredManifestFields(manifest: Record<string, unknown>): string[];
/** Parse + shape-check a manifest.json payload into a typed manifest.
 *  Returns `null` when a required field is missing or types are wrong —
 *  a malformed manifest is rejected, not partially accepted. */
export declare function parsePluginManifest(raw: unknown): PluginManifest | null;
//# sourceMappingURL=manifest.d.ts.map