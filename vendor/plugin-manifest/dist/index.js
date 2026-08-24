/**
 * @openclime/plugin-manifest
 *
 * Shared plugin-manifest validation for the openclime marketplace.
 * Zero-dependency-era erasable TS: pure functions + a zod schema; runs under
 * Node 24 type-stripping and bundles into the Workers/Astro app.
 *
 * The desktop main process (`apps/desktop/electron/main/features/plugins/*`)
 * remains the authority for install-time enforcement; this package is the
 * shared gauge both the market and the desktop (re)use so validation never
 * drifts apart.
 */
export * from "./safe-id.js";
export * from "./version.js";
export * from "./manifest.js";
export * from "./entry-order.js";
export * from "./dependencies.js";
export * from "./schema.js";
export * from "./registry.js";
//# sourceMappingURL=index.js.map