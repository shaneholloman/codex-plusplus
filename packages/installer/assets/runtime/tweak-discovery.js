"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.discoverTweaks = discoverTweaks;
/**
 * Discover tweaks under <userRoot>/tweaks. Each tweak is a directory with
 * a manifest.json and an entry script. Entry resolution: manifest.main >
 * index.js > index.mjs > index.cjs.
 *
 * We deliberately do not transpile TypeScript here — runtime stays small.
 * Tweak authors who want TS should bundle/transpile in their own toolchain
 * (e.g. tsx, esbuild) before dropping into the tweaks dir, OR ship .js.
 */
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const ENTRY_CANDIDATES = ["index.js", "index.cjs", "index.mjs"];
function discoverTweaks(tweaksDir) {
    if (!(0, node_fs_1.existsSync)(tweaksDir))
        return [];
    const out = [];
    for (const name of (0, node_fs_1.readdirSync)(tweaksDir)) {
        const dir = (0, node_path_1.join)(tweaksDir, name);
        if (!(0, node_fs_1.statSync)(dir).isDirectory())
            continue;
        const manifestPath = (0, node_path_1.join)(dir, "manifest.json");
        if (!(0, node_fs_1.existsSync)(manifestPath))
            continue;
        let manifest;
        try {
            manifest = JSON.parse((0, node_fs_1.readFileSync)(manifestPath, "utf8"));
        }
        catch {
            continue;
        }
        if (!manifest.id || !manifest.name || !manifest.version)
            continue;
        const entry = resolveEntry(dir, manifest);
        if (!entry)
            continue;
        out.push({ dir, entry, manifest });
    }
    return out;
}
function resolveEntry(dir, m) {
    if (m.main) {
        const p = (0, node_path_1.join)(dir, m.main);
        return (0, node_fs_1.existsSync)(p) ? p : null;
    }
    for (const c of ENTRY_CANDIDATES) {
        const p = (0, node_path_1.join)(dir, c);
        if ((0, node_fs_1.existsSync)(p))
            return p;
    }
    return null;
}
//# sourceMappingURL=tweak-discovery.js.map