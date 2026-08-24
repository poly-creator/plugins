/**
 * Minimum-version floor comparison for plugins.
 *
 * VENDORED from `packages/shared/src/lib/version.ts` (same semantics as the
 * desktop's `minAppVersion` / dependency-floor enforcement). The marketplace
 * package deliberately does NOT import `@openclime/shared` — it must stay
 * dependency-free (runs standalone in packs/scripts and in the Worker).
 * If you change behavior here, change it in shared too.
 *
 * Parses a semver-ish `major.minor.patch` numerically (missing segments
 * default to 0) and returns whether `appVersion` is >= `minVersion`.
 *
 * Invariants callers depend on:
 * - A missing, empty, or unparseable `minVersion` means "no floor" — the
 *   function returns true for any `appVersion` (equivalent to `0.0.0`).
 * - Comparison is numeric per segment, so `1.10.0 > 1.9.0` (not lexicographic).
 * - `appVersion` that cannot be parsed compares as `0.0.0`.
 */
/**
 * Compare two `major.minor.patch` version strings numerically.
 * Returns <0 when a < b, 0 when equal, >0 when a > b. Non-numeric or
 * unparseable versions compare as `0.0.0` (same leniency as parseVersion).
 * Used by the marketplace to pick the highest published version.
 */
export function compareMiniSemver(a, b) {
    const pa = parseVersion(a) ?? [0, 0, 0];
    const pb = parseVersion(b) ?? [0, 0, 0];
    return compareTriples(pa, pb);
}
/**
 * @param appVersion — the running app version (e.g. `app.getVersion()`).
 * @param minVersion — the plugin-declared floor; absent/invalid ⇒ no floor.
 * @returns true when `appVersion` is >= `minVersion` (or no floor exists).
 */
export function meetsMinVersion(appVersion, minVersion) {
    const min = parseVersion(minVersion);
    if (min === null)
        return true; // no floor
    const app = parseVersion(appVersion) ?? [0, 0, 0];
    return compareTriples(app, min) >= 0;
}
function parseVersion(version) {
    if (!version)
        return null;
    const parts = version.split(".");
    if (parts.length > 3)
        return null;
    const nums = parts.map((part) => {
        const n = Number.parseInt(part, 10);
        return Number.isNaN(n) ? null : n;
    });
    if (nums.some((n) => n === null))
        return null;
    return [nums[0], nums[1] ?? 0, nums[2] ?? 0];
}
function compareTriples(a, b) {
    for (let i = 0; i < 3; i++) {
        if (a[i] !== b[i])
            return a[i] - b[i];
    }
    return 0;
}
//# sourceMappingURL=version.js.map