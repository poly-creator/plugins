/**
 * @openclime/plugin-pack
 *
 * Reusable plugin packing pipeline — the same logic `scripts/pack-plugin.mjs`
 * used to own, extracted so third-party plugin repos can `npx` it in their
 * release workflows. Pure Node: no Electron, no React, no vitest.
 *
 * The desktop main process remains the authority for install-time enforcement;
 * this package is the shared packer both the monorepo seed pipeline and
 * third-party release CI reuse so a packed zip installs on-device.
 */
export * from "./pack.ts";
export { runCli } from "./cli.ts";
//# sourceMappingURL=index.d.ts.map