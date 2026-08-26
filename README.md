# OpenClime Plugin Registry

The official manifest of OpenClime plugins distributed **Obsidian-style**:
one plugin = one GitHub repo, bytes hosted on the author's own releases,
this repo is just one static JSON file. Publishing a new version of your
plugin never touches this repo again — tag `v*` in your plugin repo and
every user's next install picks it up.

First-party plugins (bingryan/* repos) are indistinguishable from
third-party entries at the JSON level — readers derive `official` from
`repo.startsWith("bingryan/")` so no third-party entry can lie about it.

## How to publish your plugin

1. **Build + release it.** Use the
   [`bingryan/plugin-template`](https://github.com/bingryan/plugin-template)
   template repo and follow its README: `git tag v0.1.0 && git push origin
   v0.1.0` produces a full GitHub Release with **three assets** —
   `<id>-<version>.zip`, the byte-identical alias `<id>.zip`, and the
   `manifest.json` alias (version probe).

2. **Add an entry to `plugins.json`** — latest mode, no tag, no hash:

   ```jsonc
   {
     "schema_version": 2,
     "plugins": [
       {
         "id": "com.example.my-plugin",
         "name": "My Plugin",
         "author": "your-github-username",
         "repo": "your-github-username/your-plugin-repo",
         "description": "One-line description."
       }
     ]
   }
   ```

   Optional pinning: `tag` + `sha256` **together** (byte-locked to one
   reviewed release; both or neither — CI rejects half a pin).

3. **Open a PR.** CI runs the machine gates (schema v2, uniqueness,
   additive-only diff with ownership, repo + latest-release alias assets,
   alias-manifest vs in-zip-manifest byte equality, sha256 re-verification
   for pinned entries, in-zip manifest match, pack re-validation, nodeEntry
   flag). A human then reviews your code per `REVIEW.md`.

4. **Ship updates freely.** New version = new `v*` tag in YOUR repo. The
   registry entry stays untouched; users' 可更新 badge comes from your
   `releases/latest`.

## Rules

- **One plugin per repo.** The `<id>.zip` alias convention assumes it — CI
  refuses repos whose latest release carries the wrong asset set.
- **Releases must be full** (not draft, not prerelease) — `releases/latest`
  ignores those and the alias URLs would 404.
- **Latest-mode trust** = PR review + the SHA-256 `integrity` baked into
  the zip (the desktop re-verifies after download). **Pinned-mode trust**
  = the entry's `sha256` over the downloaded bytes; a release swapped
  after review is refused.
- **Entry edits are ownership-checked.** You may only add/modify/remove
  entries whose plugin repo you own (PR author login == repo owner).
- **`nodeEntry` (main-process entry) always requires manual review** — it
  runs with full trust in the desktop main process.
- **Download URLs are composed** from `repo` / `id` / (`tag`) at read
  time; never store a full URL in the entry.
- **Removal** = delete the entry. Already-installed users keep working;
  the market tab just stops listing it.

## Schema

`plugins.json` shape is validated by `REGISTRY_SCHEMA` (v2) from
`@openclime/plugin-manifest` — the same package the web catalog and the
desktop marketplace use. Keep schema changes in lockstep with that
package and both consumers.
