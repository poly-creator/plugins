import type { PluginManifest } from "./manifest.ts";
/** One unsatisfied dependency: id + declared floor; `installedVersion` is
 *  present when the dep IS enabled but below the floor, absent when the dep is
 *  not installed/enabled at all. */
export interface MissingPluginDependency {
    id: string;
    requested: string;
    installedVersion?: string;
}
export declare function findMissingPluginDependencies(manifest: Pick<PluginManifest, "dependencies">, enabledVersions: Record<string, string>): MissingPluginDependency[];
//# sourceMappingURL=dependencies.d.ts.map