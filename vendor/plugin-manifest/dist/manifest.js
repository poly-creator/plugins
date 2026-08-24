/**
 * Canonical marketplace plugin manifest type + required-field checks.
 *
 * The manifest shape mirrors the desktop's `ExternalPluginManifest`
 * (`apps/desktop/electron/main/features/plugins/types.ts`) — a marketplace
 * plugin's `manifest.json` IS a desktop plugin manifest, plus the strict
 * semver/numbered-version rule from the marketplace schema.
 */
/** Fields the desktop loader treats as required for a plugin to be installable
 *  (port of `readPluginManifestFromDir`'s gate). The marketplace enforces the
 *  same set — a plugin that would be rejected on-device must be rejected here. */
export const REQUIRED_MANIFEST_FIELDS = ["id", "name", "version", "main"];
/** Returns the list of required fields missing from `manifest` (empty = valid). */
export function missingRequiredManifestFields(manifest) {
    return REQUIRED_MANIFEST_FIELDS.filter((f) => {
        const v = manifest[f];
        return typeof v !== "string" || v.length === 0;
    });
}
/** Parse + shape-check a manifest.json payload into a typed manifest.
 *  Returns `null` when a required field is missing or types are wrong —
 *  a malformed manifest is rejected, not partially accepted. */
export function parsePluginManifest(raw) {
    if (typeof raw !== "object" || raw === null)
        return null;
    const m = raw;
    if (missingRequiredManifestFields(m).length > 0)
        return null;
    const str = (v) => (typeof v === "string" ? v : undefined);
    return {
        id: m.id,
        name: m.name,
        version: m.version,
        main: m.main,
        author: str(m.author),
        description: str(m.description),
        minAppVersion: str(m.minAppVersion),
        nodeEntry: str(m.nodeEntry),
        integrity: str(m.integrity),
        dependencies: typeof m.dependencies === "object" && m.dependencies !== null
            ? m.dependencies
            : undefined,
        trust: m.trust === "trusted" || m.trust === "safe" ? m.trust : undefined,
        permissions: Array.isArray(m.permissions)
            ? m.permissions.filter((p) => typeof p === "string" && p.trim().length > 0)
            : undefined,
        categories: Array.isArray(m.categories)
            ? m.categories.filter((c) => typeof c === "string" && c.trim().length > 0)
            : undefined,
    };
}
//# sourceMappingURL=manifest.js.map