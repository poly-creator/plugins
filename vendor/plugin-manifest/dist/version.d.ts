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
export declare function compareMiniSemver(a: string, b: string): number;
/**
 * @param appVersion — the running app version (e.g. `app.getVersion()`).
 * @param minVersion — the plugin-declared floor; absent/invalid ⇒ no floor.
 * @returns true when `appVersion` is >= `minVersion` (or no floor exists).
 */
export declare function meetsMinVersion(appVersion: string, minVersion?: string): boolean;
//# sourceMappingURL=version.d.ts.map