/**
 * Gate 3 ownership tests (#283).
 *
 * checkOwnership is pure: base/head entry arrays + submitter (+ org
 * members for official entries) → failure messages. No I/O, no exit.
 * Run with: node --test scripts/validate-registry.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { checkOwnership } from "./validate-registry.mjs";

const colorTag = {
	id: "example.color-tag",
	name: "Color Tag",
	author: "bingryan",
	repo: "bingryan/color-tag",
	description: "Tag a palette node.",
};

const dusk = {
	id: "tonguesking.dusk",
	name: "Dusk",
	author: "tonguesking",
	repo: "tonguesking/dusk",
	description: "A dusk theme.",
};

describe("checkOwnership (#283)", () => {
	it("append-only PR from another author passes (the bug)", () => {
		const errs = checkOwnership([colorTag], [colorTag, dusk], "tonguesking");
		assert.deepEqual(errs, []);
	});

	it("modifying another author's entry is rejected", () => {
		const changed = { ...colorTag, description: "Hijacked." };
		const errs = checkOwnership([colorTag], [changed], "tonguesking");
		assert.equal(errs.length, 1);
		assert.match(errs[0], /belongs to bingryan\/color-tag/);
	});

	it("removing another author's entry is rejected", () => {
		const errs = checkOwnership([colorTag], [], "tonguesking");
		assert.equal(errs.length, 1);
		assert.match(errs[0], /PR removes/);
	});

	it("swapping the repo pin is rejected even by the entry owner", () => {
		const swapped = { ...colorTag, repo: "tonguesking/evil" };
		const errs = checkOwnership([colorTag], [swapped], "bingryan");
		assert.equal(errs.length, 1);
		assert.match(errs[0], /changed repo/);
	});

	it("owner editing their own entry passes", () => {
		const changed = { ...dusk, description: "New blurb." };
		const errs = checkOwnership([dusk], [changed], "tonguesking");
		assert.deepEqual(errs, []);
	});
});
