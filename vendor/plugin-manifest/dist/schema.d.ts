/**
 * Marketplace manifest schema (zod).
 *
 * The STRICT market-side manifest validation: everything the desktop loader
 * requires (so an approved plugin installs), plus market rules:
 *   - `version` MUST be a numeric semver `X.Y.Z` — the desktop's version
 *     comparison (`meetsMinVersion`) is numeric-per-segment, so a non-numeric
 *     version makes dependency floors and publish ordering ill-defined.
 *   - `trust` is enum-constrained; `permissions` is a bounded string array;
 *     `categories` ≤ 5 (Plan: market rule, not a desktop rule).
 *   - Unknown keys are stripped (the manifest may carry desktop-only extras).
 *
 * Note: `author` is the manifest-declared author string; the marketplace does
 * NOT trust it for attribution — ownership comes from the uploader's session.
 */
import { z } from "zod";
export declare const MAX_CATEGORIES = 5;
export declare const MAX_PERMISSIONS = 64;
export declare const MARKETPLACE_MANIFEST_SCHEMA: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    version: z.ZodString;
    author: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    minAppVersion: z.ZodOptional<z.ZodString>;
    main: z.ZodString;
    nodeEntry: z.ZodOptional<z.ZodString>;
    integrity: z.ZodOptional<z.ZodString>;
    dependencies: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    trust: z.ZodOptional<z.ZodEnum<{
        trusted: "trusted";
        safe: "safe";
    }>>;
    permissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
    categories: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type MarketplaceManifest = z.infer<typeof MARKETPLACE_MANIFEST_SCHEMA>;
//# sourceMappingURL=schema.d.ts.map