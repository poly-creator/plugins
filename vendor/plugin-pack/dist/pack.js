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
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { zip } from "fflate";
import { isSafePluginId, digestEntryFiles, entryFileOrder } from "@openclime/plugin-manifest";
/** Directories never packed (mirrors `url-install` zip-entry filters).
 * `vendor` is dev-only `file:` dependency scaffolding (template repos) —
 * never runtime bytes; everything the desktop needs is bundled in main.js. */
const SKIP_DIRS = new Set([
    "node_modules",
    ".git",
    ".DS_Store",
    "dist-electron",
    "release",
    "vendor",
    ".github",
]);
const SKIP_FILES = new Set([".DS_Store", "Thumbs.db"]);
const SRC_EXT_BLACKLIST = [".map"];
/**
 * Locate the manifest. Mirrors desktop `locateManifestDir`: prefer the
 * `<root>/manifest.json` at the root, otherwise the single manifest found
 * one level deep (so `dist/` wrappers still work).
 */
export async function locateManifestDir(root) {
    const rootManifest = path.join(root, "manifest.json");
    if (existsSync(rootManifest))
        return root;
    const stack = [root];
    while (stack.length) {
        const dir = stack.pop();
        if (!dir)
            continue;
        let entries;
        try {
            entries = await readdir(dir, { withFileTypes: true });
        }
        catch {
            continue;
        }
        for (const e of entries) {
            if (!e.isDirectory())
                continue;
            if (SKIP_DIRS.has(e.name))
                continue;
            const child = path.join(dir, e.name);
            const candidate = path.join(child, "manifest.json");
            if (existsSync(candidate))
                return child;
            stack.push(child);
        }
    }
    return null;
}
/** Recursive walk; yields `path.posix` style entries for stable cross-platform zip names. */
async function* walk(root) {
    const stack = [root];
    while (stack.length) {
        const dir = stack.pop();
        if (!dir)
            continue;
        let entries;
        try {
            entries = await readdir(dir, { withFileTypes: true });
        }
        catch {
            continue;
        }
        for (const e of entries) {
            if (SKIP_DIRS.has(e.name))
                continue;
            if (SKIP_FILES.has(e.name))
                continue;
            const abs = path.join(dir, e.name);
            if (e.isDirectory()) {
                stack.push(abs);
                continue;
            }
            if (!e.isFile())
                continue;
            if (SRC_EXT_BLACKLIST.some((ext) => e.name.endsWith(ext)))
                continue;
            const rel = path.relative(root, abs).split(path.sep).join("/");
            yield { abs, rel };
        }
    }
}
/**
 * Pack a plugin directory into a marketplace-ready zip (or validate it when
 * `check` is set). Returns the JSON summary; throws on any validation failure.
 */
export async function packPlugin(args) {
    const pluginDir = path.resolve(args.dir);
    if (!existsSync(pluginDir)) {
        throw new Error(`plugin dir not found: ${pluginDir}`);
    }
    const manifestDir = await locateManifestDir(pluginDir);
    if (!manifestDir) {
        throw new Error(`could not find manifest.json under ${pluginDir} ` + "(or inside a single dist/ wrapper)");
    }
    const manifestPath = path.join(manifestDir, "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    // Same light gate as the desktop install (required fields + safe id). The
    // strict market schema is applied by registry CI, not here.
    const required = ["id", "name", "version", "main"];
    const missing = required.filter((f) => typeof manifest[f] !== "string" || !manifest[f]);
    if (missing.length > 0) {
        throw new Error(`manifest missing required fields (need id/name/version/main): ` +
            `id=${!!manifest.id} name=${!!manifest.name} version=${!!manifest.version} main=${!!manifest.main}`);
    }
    if (!isSafePluginId(String(manifest.id))) {
        throw new Error(`unsafe plugin id "${manifest.id}" (allowed: one safe path segment)`);
    }
    // Collect file entries (Map mirrors the upload pipeline API).
    const entries = new Map();
    for await (const { abs, rel } of walk(manifestDir)) {
        entries.set(rel, new Uint8Array(await readFile(abs)));
    }
    // Make sure the manifest itself is in the map.
    const manifestRel = path.relative(manifestDir, manifestPath).split(path.sep).join("/");
    if (!entries.has(manifestRel)) {
        entries.set(manifestRel, new Uint8Array(await readFile(manifestPath)));
    }
    // Entry files MUST exist on disk — mirrors the upload gate.
    for (const name of entryFileOrder(manifest)) {
        if (!entries.has(name)) {
            throw new Error(`manifest declares entry "${name}" but it is missing from the directory`);
        }
    }
    // Author-supplied integrity is ignored — same policy as the upload pipeline
    // (server-computed overrides). We strip + recompute.
    if (manifest.integrity)
        delete manifest.integrity;
    const integrityHex = await digestEntryFiles(manifest, entries);
    const integrity = `sha256:${integrityHex}`;
    manifest.integrity = integrity;
    const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2) + "\n");
    entries.set(manifestRel, manifestBytes);
    const uncompressedBytes = [...entries.values()].reduce((n, b) => n + b.byteLength, 0);
    if (args.check) {
        return {
            ok: true,
            id: String(manifest.id),
            name: String(manifest.name),
            version: String(manifest.version),
            entryCount: entries.size,
            uncompressedBytes,
            integrity,
        };
    }
    const outPath = path.resolve(args.out ?? path.join(pluginDir, "release", `${manifest.id}-${manifest.version}.zip`));
    await mkdir(path.dirname(outPath), { recursive: true });
    const zipped = await new Promise((res, rej) => {
        zip(Object.fromEntries(entries), { level: 6 }, (err, data) => (err ? rej(err) : res(data)));
    });
    await writeFile(outPath, zipped);
    // Alias assets (default on): versionless names beside the versioned zip.
    // `<id>.zip` reuses the exact zip bytes (no re-pack — byte-identical by
    // construction); `manifest.json` reuses the integrity-injected bytes that
    // are inside the zip, so a version probe sees what ships.
    let aliasZip;
    let aliasManifest;
    if (args.aliases !== false) {
        const outDir = path.dirname(outPath);
        aliasZip = path.join(outDir, `${manifest.id}.zip`);
        aliasManifest = path.join(outDir, "manifest.json");
        await writeFile(aliasZip, zipped);
        await writeFile(aliasManifest, manifestBytes);
    }
    const z = await stat(outPath);
    return {
        ok: true,
        zip: outPath,
        id: String(manifest.id),
        name: String(manifest.name),
        version: String(manifest.version),
        entryCount: entries.size,
        uncompressedBytes,
        zippedBytes: z.size,
        sha256: await sha256Hex(zipped),
        integrity,
        aliasZip,
        aliasManifest,
    };
}
/** SHA-256 hex digest of raw bytes (Web Crypto, available Node ≥ 20). */
export async function sha256Hex(bytes) {
    const buf = new Uint8Array(bytes);
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
//# sourceMappingURL=pack.js.map