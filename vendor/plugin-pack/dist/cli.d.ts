#!/usr/bin/env node
/**
 * `openclime-plugin-pack` — CLI entry for `@openclime/plugin-pack`.
 *
 *   npx openclime-plugin-pack [dir=. ] [--out <path>] [--check]
 *
 * Prints the pack summary as JSON on stdout. `--check` validates without
 * writing a zip (CI mode): exits 0 on success, 1 with a reason on failure.
 * The zip's own sha256 is printed so registry entries can pin it.
 */
/**
 * Run the CLI against `argv` (without the node/binary prefix) and return a
 * process exit code: 0 on success, 1 on any validation/usage failure.
 * Programmatic entry — `scripts/pack-plugin.mjs` and the bin both call this.
 */
export declare function runCli(argv: string[]): Promise<number>;
//# sourceMappingURL=cli.d.ts.map