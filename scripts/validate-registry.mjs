#!/usr/bin/env node
/**
 * Registry validator — the machine gate behind `validate.yml`.
 *
 * Runs the same checks the desktop's install gate and the web's catalog
 * aggregation rely on, against the shared `@openclime/plugin-manifest`
 * package (REGISTRY_ENTRY_SCHEMA + MARKETPLACE_MANIFEST_SCHEMA) and the
 * shared `@openclime/plugin-pack` CLI. The goal: a PR that passes here is
 * byte-consistent — a human then only reviews code semantics (REVIEW.md).
 *
 * Gates (each one exits non-zero with a reason on failure):
 *   1. plugins.json parses + passes REGISTRY_SCHEMA (id safe, repo/tag/asset
 *      shape, sha256 exactly 64 lowercase hex, added_at ISO).
 *   2. ids are unique across the whole file.
 *   3. Diff is additive-only: the PR must not modify entries it doesn't own
 *      (compares the merged base against the head via GitHub's PR API).
 *   4. The GitHub repo exists, the tag release exists, and the asset exists.
 *   5. The asset's downloaded bytes hash to the pinned sha256 (the critical
 *      tamper-evidence step — a release swapped after review is refused).
 *   6. Unzipping yields a manifest passing MARKETPLACE_MANIFEST_SCHEMA,
 *      manifest.id == entry.id, and manifest.version == tag minus "v".
 *   7. `openclime-plugin-pack --check` re-validates the unpacked plugin
 *      (integrity derivation matches the desktop's).
 *   8. Entries declaring a nodeEntry are flagged for manual review (a
 *      main-process entry is full-trust on the desktop).
 *
 * Usage (CI):
 *   REGISTRY_REPO=owner/plugins validate-registry.mjs <path-to-plugins.json>
 *   REGISTRY_REPO=owner/plugins validate-registry.mjs --pr <pr-number>
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { unzipSync, strToU8 } from "fflate";
import {
	REGISTRY_SCHEMA,
	MARKETPLACE_MANIFEST_SCHEMA,
	isSafePluginId,
	entryFileOrder,
} from "@openclime/plugin-manifest";

const API = "https://api.github.com";
const UA = "openclime-plugins-registry/1.0";
const HEADERS = {
	"User-Agent": UA,
	Accept: "application/vnd.github+json",
	// CI passes GITHUB_TOKEN (60 req/h unauthenticated would not survive
	// per-entry repo/release/asset checks).
	...(process.env.GITHUB_TOKEN
		? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
		: {}),
};

function die(msg, code = 1) {
	console.error(`validate-registry: ${msg}`);
	process.exit(code);
}

async function gh(path, opts = {}) {
	const res = await fetch(`${API}${path}`, { headers: HEADERS, ...opts });
	if (!res.ok) return null;
	return res.json();
}

async function download(url) {
	const res = await fetch(url, { headers: { "User-Agent": UA } });
	if (!res.ok) return null;
	return new Uint8Array(await res.arrayBuffer());
}

async function sha256Hex(bytes) {
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Gate 5 + 6 + 7: download → sha → unzip → manifest → pack --check. */
async function verifyEntryAsset(entry) {
	const assetUrl = `https://github.com/${entry.repo}/releases/download/${entry.tag}/${entry.asset}`;
	const bytes = await download(assetUrl);
	if (!bytes) throw new Error(`[5] asset download failed: ${assetUrl}`);

	const actual = await sha256Hex(bytes);
	if (actual !== entry.sha256) {
		throw new Error(
			`[5] sha256 mismatch: pinned ${entry.sha256}, downloaded ${actual} — ` +
				"release bytes differ from what was reviewed",
		);
	}

	const files = unzipSync(bytes);
	const manifestRaw = files["manifest.json"];
	if (!manifestRaw) throw new Error("[6] zip has no manifest.json");
	const manifest = JSON.parse(new TextDecoder().decode(manifestRaw));

	const parsed = MARKETPLACE_MANIFEST_SCHEMA.safeParse(manifest);
	if (!parsed.success) {
		throw new Error(
			`[6] manifest fails MARKETPLACE_MANIFEST_SCHEMA: ${parsed.error.issues
				.map((i) => i.path.join(".") + ": " + i.message)
				.join("; ")}`,
		);
	}
	if (manifest.id !== entry.id) {
		throw new Error(`[6] manifest.id "${manifest.id}" != entry.id "${entry.id}"`);
	}
	if (manifest.version !== entry.tag.replace(/^v/, "")) {
		throw new Error(
			`[6] manifest.version "${manifest.version}" != tag ${entry.tag} minus v`,
		);
	}

	// Gate 7: pack --check against the unpacked plugin. Write to temp so the
	// shared CLI validates the exact bytes CI just verified. runCli is called
	// programmatically (not via node_modules/.bin) — the bin shim is a shell
	// script, unspawnable through process.execPath, and the package is a
	// symlinked `file:` install anyway.
	const tmp = await mkdtemp(path.join(os.tmpdir(), "registry-verify-"));
	try {
		for (const [name, data] of Object.entries(files)) {
			const abs = path.join(tmp, name);
			await mkdir(path.dirname(abs), { recursive: true });
			await writeFile(abs, data);
		}
		const { runCli } = await import("@openclime/plugin-pack");
		const code = await runCli([tmp, "--check"]);
		if (code !== 0) {
			throw new Error(`[7] openclime-plugin-pack --check failed for ${entry.id} (see stderr above)`);
		}
	} finally {
		await rm(tmp, { recursive: true, force: true });
	}
	return { nodeEntry: manifest.nodeEntry };
}

async function main() {
	const argv = process.argv.slice(2);
	const prFlag = argv.indexOf("--pr");
	let pluginsPath;
	let prNumber = null;

	if (prFlag !== -1) {
		prNumber = argv[prFlag + 1];
		pluginsPath = argv.filter((_, i) => i !== prFlag && i !== prFlag + 1)[0];
	} else {
		pluginsPath = argv[0];
	}
	if (!pluginsPath) die("missing <path-to-plugins.json> argument");
	if (!existsSync(pluginsPath)) die(`file not found: ${pluginsPath}`);

	const raw = JSON.parse(await readFile(pluginsPath, "utf8"));
	const parsed = REGISTRY_SCHEMA.safeParse(raw);
	if (!parsed.success) {
		die(
			`[1] plugins.json fails REGISTRY_SCHEMA: ${parsed.error.issues
				.map((i) => i.path.join(".") + ": " + i.message)
				.join("; ")}`,
		);
	}
	const plugins = parsed.data.plugins;

	// Gate 2: unique ids.
	const seen = new Set();
	for (const p of plugins) {
		if (seen.has(p.id)) die(`[2] duplicate id "${p.id}"`);
		seen.add(p.id);
	}

	// Gate 3: additive-only diff (only meaningful on a PR).
	if (prNumber) {
		const repo = process.env.REGISTRY_REPO;
		if (!repo) die("REGISTRY_REPO env required with --pr");
		const pr = await gh(`/repos/${repo}/pulls/${prNumber}`);
		if (!pr) die(`[3] could not read PR ${prNumber}`);
		const baseRaw = await gh(`/repos/${repo}/contents/plugins.json?ref=${pr.base.sha}`);
		const headRaw = await gh(`/repos/${repo}/contents/plugins.json?ref=${pr.head.sha}`);
		const base = baseRaw
			? JSON.parse(Buffer.from(baseRaw.content, "base64").toString())
			: { plugins: [] };
		const head = headRaw
			? JSON.parse(Buffer.from(headRaw.content, "base64").toString())
			: { plugins: [] };
		const baseIds = new Map(base.plugins.map((p) => [p.id, p]));
		const headIds = new Map(head.plugins.map((p) => [p.id, p]));
		// Ownership = the PR AUTHOR's login, not pr.head.repo.full_name —
		// PRs come from forks, so the fork's full_name never equals the
		// plugin repo an entry points at; comparing them rejects every
		// legitimate external update. What we actually require: every
		// plugin repo an entry touches belongs to the submitter.
		const submitter = pr.user.login;
		const ownerOf = (entry) => entry.repo.split("/")[0];
		for (const [id, headEntry] of headIds) {
			const baseEntry = baseIds.get(id);
			if (!baseEntry) {
				// New entry: the submitter must own the plugin repo it pins.
				if (ownerOf(headEntry) !== submitter) {
					die(`[3] new entry "${id}" pins ${headEntry.repo} but PR is from @${submitter} — you may only submit entries for repos you own`);
				}
				continue;
			}
			// Modified entry: no repo swap, and only the owning repo's author
			// may change it.
			if (headEntry.repo !== baseEntry.repo) {
				die(`[3] entry "${id}" changed repo (${baseEntry.repo} → ${headEntry.repo}) — modifying others' entries is not allowed`);
			}
			if (ownerOf(baseEntry) !== submitter) {
				die(`[3] entry "${id}" belongs to ${baseEntry.repo} but PR is from @${submitter} — modifying others' entries is not allowed`);
			}
		}
		// Removals follow the same rule: you may only remove your own entries.
		for (const [id, baseEntry] of baseIds) {
			if (!headIds.has(id) && ownerOf(baseEntry) !== submitter) {
				die(`[3] PR removes "${id}" (repo ${baseEntry.repo}) owned by @${ownerOf(baseEntry)} — PR is from @${submitter}`);
			}
		}
	}

	// Gates 4–7 per entry.
	for (const entry of plugins) {
		// Gate 4: repo + tag + asset exist.
		const repoMeta = await gh(`/repos/${entry.repo}`);
		if (!repoMeta) die(`[4] repo not found: ${entry.repo}`);
		const release = await gh(`/repos/${entry.repo}/releases/tags/${encodeURIComponent(entry.tag)}`);
		if (!release) die(`[4] release tag not found: ${entry.repo}@${entry.tag}`);
		if (!release.assets?.some((a) => a.name === entry.asset)) {
			die(`[4] asset not found: ${entry.asset} in ${entry.repo}@${entry.tag}`);
		}

		const { nodeEntry } = await verifyEntryAsset(entry);

		// Gate 8: nodeEntry ⇒ manual review required. Exit code 2 (not 1) —
		// validate.yml treats it as "label needs-manual-review", not failure.
		if (nodeEntry) {
			console.log(`[8] ${entry.id} declares nodeEntry — requires manual review`);
			process.exitCode = 2;
		}
	}

	console.log(`validate-registry: ${plugins.length} entries OK`);
}

main().catch((err) => {
	const cause = err instanceof Error && err.cause ? ` (${err.cause.message ?? err.cause})` : "";
	die(`${err instanceof Error ? err.message : String(err)}${cause}`);
});