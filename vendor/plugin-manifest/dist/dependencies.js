/**
 * Plugin dependency resolution (port of the desktop's `dependencies.ts`).
 *
 * A manifest can declare `dependencies?: Record<string, string>` — dep plugin
 * id → minimum version floor. `findMissingPluginDependencies` resolves each
 * declaration against a provided `enabledVersions` map (id → version) and
 * returns the unsatisfied ones. The desktop uses this at install/enable time;
 * the marketplace uses the same shape so upload-time dependency sanity checks
 * and install-time enforcement agree.
 *
 * Invariants:
 * - No `dependencies` (or empty object) ⇒ `[]` (back-compat).
 * - A dep is satisfied iff its id is present AND
 *   `meetsMinVersion(installedVersion, requested)`.
 * - Missing deps are returned in declaration order.
 * - An empty-string floor means "any version" — present ⇒ satisfied.
 */
import { meetsMinVersion } from "./version.js";
export function findMissingPluginDependencies(manifest, enabledVersions) {
    const deps = manifest.dependencies;
    if (!deps)
        return [];
    const missing = [];
    for (const [id, requested] of Object.entries(deps)) {
        const installedVersion = enabledVersions[id];
        if (installedVersion === undefined) {
            missing.push({ id, requested });
        }
        else if (!meetsMinVersion(installedVersion, requested)) {
            missing.push({ id, requested, installedVersion });
        }
    }
    return missing;
}
//# sourceMappingURL=dependencies.js.map