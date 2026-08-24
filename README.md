# OpenClime Plugin Registry

The official manifest of **third-party** OpenClime plugins distributed
Obsidian-style: one plugin = one GitHub repo, bytes hosted on the author's own
release, this repo pins the exact zip + its SHA-256 at review time.

Official first-party plugins do NOT live here — they're built in the OpenClime
monorepo and seeded via the D1 pipeline (the web catalog merges both sources).

## How to publish your plugin

1. **Build + release it.** Use the
   [`bingryan/plugin-template`](https://github.com/bingryan/plugin-template)
   template repo and follow its README: `git tag v0.1.0 && git push origin
   v0.1.0` produces a GitHub Release with `<id>-<version>.zip` attached and
   prints the zip's `sha256`.

2. **Add an entry to `plugins.json`** — append (never edit) your plugin:

   ```jsonc
   {
     "schema_version": 1,
     "plugins": [
       {
         "id": "com.example.my-plugin",
         "repo": "your-github-username/your-plugin-repo",
         "tag": "v0.1.0",
         "asset": "com.example.my-plugin-0.1.0.zip",
         "sha256": "<64 hex from your release log>",
         "description": "One-line description.",
         "categories": ["utility"],
         "added_at": "2026-08-23T00:00:00Z"
       }
     ]
   }
   ```

3. **Open a PR.** CI runs 8 machine gates (schema, uniqueness, additive-only
   diff, repo/tag/asset existence, **sha256 re-verification over the
   downloaded bytes**, in-zip manifest match, pack re-validation, nodeEntry
   flag). A human then reviews your code per `REVIEW.md`.

## Rules

- **Entries are immutable.** A new version is a NEW entry with a new tag —
  never edit an existing one. The CI rejects modifications to entries whose
  repo you don't own.
- **`sha256` is the zip's own digest**, pinned at review. The desktop
  re-verifies it after download — a release swapped after review is refused.
- **`nodeEntry` (main-process entry) always requires manual review** — it
  runs with full trust in the desktop main process.
- **Asset URL is composed** from `repo` / `tag` / `asset` at read time; never
  store a full URL in the entry.

## Schema

`plugins.json` shape is validated by `REGISTRY_ENTRY_SCHEMA` from
`@openclime/plugin-manifest` — the same package the web catalog and the
desktop use. Keep schema changes in lockstep with that package and both
consumers.