/**
 * Executable-entry ordering for integrity hashing.
 *
 * The SINGLE SOURCE OF TRUTH for the order in which a plugin's executable
 * files are fed into the SHA-256 used for plugin integrity. Both sides MUST
 * agree on this order:
 *
 *   - desktop  `computePluginIntegrity` (integrity.ts:48) — iterates
 *     `[main, nodeEntry]`, hashing each file in declaration order.
 *   - marketplace upload pipeline + `scripts/pack-plugin.mjs` — hash the same
 *     entry list in the same order over the raw uploaded bytes.
 *
 * Any divergence (different order, extra file mixed in) silently produces a
 * different digest and breaks install-on-device.
 */
/** The executable-surface file order to hash: `[main, nodeEntry?]`. */
export declare function entryFileOrder(manifest: {
    main: string;
    nodeEntry?: string;
}): string[];
/**
 * Compute the SHA-256 hex digest over the bytes of the executable entries, in
 * declaration order. Uses Web Crypto (available in Node ≥ 20 and Workers) so
 * the same function runs in the upload pipeline, pack scripts, and tests.
 *
 * @param entries — the entry files, keyed by their declared path
 *                  (`main` / `nodeEntry`). Missing keys throw.
 */
export declare function digestEntryFiles(manifest: {
    main: string;
    nodeEntry?: string;
}, entries: Map<string, Uint8Array>): Promise<string>;
//# sourceMappingURL=entry-order.d.ts.map