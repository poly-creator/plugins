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
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
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
const HEADERS = { "User-Agent": UA, Accept: "application/vnd.github+json" };

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
	// shared CLI validates the exact bytes CI just verified.
	const tmp = await mkdtemp(path.join(os.tmpdir(), "registry-verify-"));
	try {
		for (const [name, data] of Object.entries(files)) {
			const abs = path.join(tmp, name);
			await import("node:fs/promises").then(({ mkdir, writeFile }) =>
				mkdir(path.dirname(abs), { recursive: true }).then(() => writeFile(abs, data)),
			);
		}
		const pack = spawnSync(
			process.execPath,
			[path.join(path.dirname(new URL(import.meta.url).pathname), "../../node_modules/.bin/openclime-plugin-pack"), tmp, "--check"],
			{ encoding: "utf8" },
		);
		if (pack.status !== 0) {
			throw new Error(`[7] openclime-plugin-pack --check failed: ${pack.stderr || pack.stdout}`);
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
		for (const [id, headEntry] of headIds) {
			const baseEntry = baseIds.get(id);
			if (!baseEntry) continue; // new entry — fine
			// Modified entry: only the owning repo may change it.
			if (headEntry.repo !== baseEntry.repo) {
				die(`[3] entry "${id}" changed repo (${baseEntry.repo} → ${headEntry.repo}) — modifying others' entries is not allowed`);
			}
			if (headEntry.repo !== pr.head.repo.full_name) {
				die(`[3] entry "${id}" belongs to ${baseEntry.repo} but PR is from ${pr.head.repo.full_name}`);
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

		// Gate 8: nodeEntry ⇒ manual review required.
		if (nodeEntry) {
			console.log(`[8] ${entry.id} declares nodeEntry — requires manual review`);
			process.exitCode = process.exitCode ?? 2;
		}
	}

	console.log(`validate-registry: ${plugins.length} entries OK`);
}

main().catch((err) => die(err instanceof Error ? err.message : String(err)));