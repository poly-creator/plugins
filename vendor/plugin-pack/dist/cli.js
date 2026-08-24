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
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { packPlugin } from "./pack.js";
function usage() {
    return [
        "Usage: openclime-plugin-pack [dir] [--out <path>] [--check]",
        "  dir      Plugin directory (default: .) containing manifest.json or dist/manifest.json",
        "  --out    Output zip path (default: <dir>/release/<id>-<version>.zip)",
        "  --check  Validate only — no zip is written.",
    ].join("\n");
}
function parseArgs(argv) {
    const args = { dir: ".", check: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--out" || a === "-o") {
            const v = argv[++i];
            if (!v)
                throw new Error("--out requires a path argument");
            args.out = v;
        }
        else if (a === "--check") {
            args.check = true;
        }
        else if (a === "--help" || a === "-h") {
            console.log(usage());
            process.exit(0);
        }
        else if (a.startsWith("-")) {
            throw new Error(`unknown flag ${a}`);
        }
        else {
            args.dir = a;
        }
    }
    return args;
}
/**
 * Run the CLI against `argv` (without the node/binary prefix) and return a
 * process exit code: 0 on success, 1 on any validation/usage failure.
 * Programmatic entry — `scripts/pack-plugin.mjs` and the bin both call this.
 */
export async function runCli(argv) {
    let args;
    try {
        args = parseArgs(argv);
    }
    catch (err) {
        console.error(`openclime-plugin-pack: ${err instanceof Error ? err.message : String(err)}`);
        console.error(usage());
        return 1;
    }
    try {
        const summary = await packPlugin(args);
        console.log(JSON.stringify(summary, null, 2));
        return 0;
    }
    catch (err) {
        console.error(`openclime-plugin-pack: ${err instanceof Error ? err.message : String(err)}`);
        return 1;
    }
}
// Run only when executed directly (not when imported by the thin shell).
// Compare REALPATHS: symlinked installs (`file:./vendor/*`, pnpm-style links)
// give argv[1] a path containing a symlink component while import.meta.url
// is the real location — a plain resolve() compare makes the bin a silent
// no-op there.
const isBin = process.argv[1] &&
    realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (isBin) {
    process.exitCode = await runCli(process.argv.slice(2));
}
//# sourceMappingURL=cli.js.map