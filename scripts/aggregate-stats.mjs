// Aggregate per-entry stats into stats.json (committed next to plugins.json).
//
// One GraphQL query fetches up to 100 repos' latest releases (+assets) in a
// single round trip — no N×REST fan-out, one rate-limit cost total. The web
// market reads stats.json off the raw CDN (no auth, no quota) instead of
// hitting the GitHub API at request time.
//
// Output shape (keyed by plugin id):
//   { "<id>": { version, publishedAt, downloads, stars, kind, updatedAt } }
// `updatedAt` = this run's timestamp (the web uses it for staleness display).
//
// Degrade policy: a repo whose release lookup fails keeps its PREVIOUS stats
// row (if any) — a transient API blip must not zero out the market. Only
// repos absent from both the API result and the previous file get a zero row.
import { readFileSync, writeFileSync } from "node:fs";

const API = "https://api.github.com";
const TOKEN = process.env.GITHUB_TOKEN ?? "";
const HEADERS = {
	"User-Agent": "PolyCreator-registry/1.0",
	Accept: "application/vnd.github+json",
	...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

function die(msg) {
	console.error(`aggregate-stats: ${msg}`);
	process.exit(1);
}

async function ghGraphql(query, variables) {
	const res = await fetch(`${API}/graphql`, {
		method: "POST",
		headers: { ...HEADERS, "Content-Type": "application/json" },
		body: JSON.stringify({ query, variables }),
	});
	if (!res.ok) die(`GraphQL HTTP ${res.status}`);
	const body = await res.json();
	if (body.errors) die(`GraphQL errors: ${JSON.stringify(body.errors).slice(0, 500)}`);
	return body.data;
}

/** Release-manifest probe (CDN download, no API quota): kind + version. */
async function probeKind(repo) {
	try {
		const res = await fetch(
			`https://github.com/${repo}/releases/latest/download/manifest.json`,
			{ headers: { "User-Agent": "PolyCreator-registry/1.0" }, redirect: "follow" },
		);
		if (!res.ok) return { kind: "plugin", version: null };
		const m = await res.json();
		const hasMain = typeof m?.main === "string" && m.main.length > 0;
		const files = m?.theme?.files;
		const hasTheme = typeof m?.theme === "object" && m !== null && Array.isArray(files) && files.length > 0;
		return {
			kind: hasTheme && hasMain ? "hybrid" : hasTheme ? "theme" : "plugin",
			version: typeof m?.version === "string" ? m.version : null,
		};
	} catch {
		return { kind: "plugin", version: null };
	}
}

const plugins = JSON.parse(readFileSync("plugins.json", "utf8")).plugins;
if (!Array.isArray(plugins)) die("plugins.json has no plugins array");

// Chunk at 100 (GraphQL `search` caps `first:` at 100 per call).
const chunks = [];
for (let i = 0; i < plugins.length; i += 100) chunks.push(plugins.slice(i, i + 100));

const byRepo = new Map(); // "owner/name" -> { publishedAt, downloads, stars }
for (const chunk of chunks) {
	const searchQuery = chunk.map((p) => `repo:${p.repo}`).join(" ");
	const data = await ghGraphql(
		`query($q: String!) {
			search(query: $q, type: REPOSITORY, first: 100) {
				nodes {
					... on Repository {
						nameWithOwner
						stargazerCount
						latestRelease {
							publishedAt
							releaseAssets(first: 20) {
								nodes { name downloadCount }
							}
						}
					}
				}
			}
		}`,
		{ q: searchQuery },
	);
	for (const node of data.search.nodes ?? []) {
		const assets = node.latestRelease?.releaseAssets?.nodes ?? [];
		byRepo.set(node.nameWithOwner.toLowerCase(), {
			publishedAt: node.latestRelease?.publishedAt ?? null,
			assets,
			stars: node.stargazerCount ?? null,
		});
	}
}

let previous = {};
try {
	previous = JSON.parse(readFileSync("stats.json", "utf8"));
} catch {
	// first run — no previous file
}
const prevEntries = previous.entries ?? {};
const now = new Date().toISOString();
const out = { updatedAt: now, entries: {} };

await Promise.all(
	plugins.map(async (p) => {
		const hit = byRepo.get(p.repo.toLowerCase());
		const prev = prevEntries[p.id];
		if (!hit) {
			// API miss: keep previous row, else a zero row (never drop).
			out.entries[p.id] = prev ?? {
				version: null,
				publishedAt: null,
				downloads: 0,
				stars: null,
				kind: "plugin",
				updatedAt: now,
			};
			return;
		}
		const { kind, version } = await probeKind(p.repo);
		// Download count = the installable zip, not the manifest probe asset:
		// match <id>.zip or <id>-<version>.zip (bare-id match kept for safety).
		const downloads = hit.assets
			.filter(
				(a) =>
					a.name === `${p.id}.zip` ||
					(typeof version === "string" && a.name === `${p.id}-${version}.zip`) ||
					a.name === p.id,
			)
			.reduce((n, a) => n + (a.downloadCount ?? 0), 0);
		out.entries[p.id] = {
			version,
			publishedAt: hit.publishedAt,
			downloads,
			stars: hit.stars,
			kind,
			updatedAt: now,
		};
	}),
);

writeFileSync("stats.json", JSON.stringify(out, null, 2) + "\n");
console.log(`aggregate-stats: ${Object.keys(out.entries).length} entries → stats.json`);
