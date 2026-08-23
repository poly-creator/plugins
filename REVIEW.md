# Plugin Review Checklist

Machine gates (validate.yml) cover format, uniqueness, hash integrity, and
byte-consistency. What remains for the human reviewer is **code semantics** —
the things a hash can't see.

## Must review (hard requirements)

- [ ] **`nodeEntry` plugins** — a main-process entry runs with full trust in
      the desktop main process. Read the whole file. Reject if it does
      anything the entry's `permissions` don't justify.
- [ ] **`trust: "trusted"`** — full-permission mode. Read the whole plugin;
      reject unless the code genuinely needs main-process access.
- [ ] **Network / filesystem access** — any `fetch`, `net`, `fs`,
      `child_process`, or shelling out. Confirm each is necessary and scoped.
- [ ] **Obfuscated / minified `main.js`** — the zip must contain readable
      output. Reject minified bundles without a matching source map (the pack
      CLI skips `*.map`, so the readable-source expectation is: what's in the
      zip is what you can read). If you can't audit it, reject it.

## Check (with the machine gates)

- [ ] `manifest.id == entry.id`, `version == tag minus v` (gate 6 covers this;
      eyeball for sanity).
- [ ] `permissions` list matches what the code actually calls — a plugin that
      requests nothing but uses `app.*` is lying about its surface.
- [ ] `categories` are meaningful and ≤ 5.
- [ ] `description` is honest (no keyword stuffing, no "official" claims).
- [ ] README links resolve and describe real behavior.

## Reject without review

- Anything that fails the machine gates (they run first).
- Code that's unreadable (minified, no source map, vendored blob).
- Explicitly malicious patterns: credential harvesting, key exfiltration,
  crypto mining, remote code execution via downloaded payloads.

## Review latency goal

One reviewer pass per PR. If a plugin is a genuine, readable,
right-sized utility, approve. If it needs changes, request them once with
specific line references — the registry is a door, not a court.