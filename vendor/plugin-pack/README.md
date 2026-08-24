# @openclime/plugin-pack

Pack an openclime plugin directory into a marketplace-ready zip. The reusable
CLI behind the monorepo's `scripts/pack-plugin.mjs`, extracted so **third-party
plugin repos can run the exact same packing pipeline the official examples
use** — same skip rules, same manifest validation, same integrity derivation.

A packed zip is what a plugin's GitHub release carries, and what the desktop
`installFromUrl` downloads, verifies, and installs.

## Usage

```bash
npx openclime-plugin-pack . --out dist
# → prints JSON: { ok, zip, id, name, version, entryCount,
#                  uncompressedBytes, zippedBytes, sha256, integrity }

npx openclime-plugin-pack . --check   # validate only (CI mode), exit 1 on failure
```

| Flag      | Meaning                                                                     |
| --------- | --------------------------------------------------------------------------- |
| `dir`     | Plugin directory (default `.`) with `manifest.json` or `dist/manifest.json` |
| `--out`   | Output zip path (default `<dir>/release/<id>-<version>.zip`)                |
| `--check` | Validate only — no zip written; CI-friendly exit codes                      |

## What it does

1. Locates the manifest (`<dir>/manifest.json` or the `dist/` wrapper).
2. Walks the directory, skipping `node_modules` / `.git` / OS junk / `*.map`.
3. Validates with the same light gate the desktop install enforces
   (required fields + safe id + entry files exist). The strict market schema
   (`MARKETPLACE_MANIFEST_SCHEMA`) is the registry CI's job, not the packer's.
4. Computes SHA-256 over `[main, nodeEntry?]` in declaration order via
   `@openclime/plugin-manifest`'s `digestEntryFiles` (single source of truth).
5. Injects `manifest.integrity = "sha256:<hex>"` into the zip copy.
6. Writes the zip and reports size, integrity, **and the zip's own `sha256`**
   — the field a registry entry pins for tamper-evidence on GitHub releases.

Output fields:

| Field               | Meaning                                                           |
| ------------------- | ----------------------------------------------------------------- |
| `zip`               | Resolved output path (absent in `--check` mode)                   |
| `id/name/version`   | From the manifest                                                 |
| `entryCount`        | Files packed                                                      |
| `uncompressedBytes` | Sum of file sizes before zipping                                  |
| `zippedBytes`       | Zip file size (write mode only)                                   |
| `sha256`            | SHA-256 hex of the **zip bytes** — pin this in the registry       |
| `integrity`         | `sha256:<hex>` over the executable entries (`[main, nodeEntry?]`) |

## Development

```bash
pnpm --filter @openclime/plugin-pack build   # tsc → dist/
pnpm --filter @openclime/plugin-pack test    # node --test (no vitest)
pnpm --filter @openclime/plugin-pack check   # tsc --noEmit
```

The package must never depend on `vitest` / `@vitejs/plugin-react` /
`@tailwindcss/vite` / `@vitest/*` — same vite-pin rule as `@openclime/plugin-manifest`.
