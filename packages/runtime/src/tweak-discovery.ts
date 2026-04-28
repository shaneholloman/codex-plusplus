/**
 * Discover tweaks under <userRoot>/tweaks. Each tweak is a directory with
 * a manifest.json and an entry script. Entry resolution: manifest.main >
 * index.js > index.mjs > index.cjs.
 *
 * We deliberately do not transpile TypeScript here — runtime stays small.
 * Tweak authors who want TS should bundle/transpile in their own toolchain
 * (e.g. tsx, esbuild) before dropping into the tweaks dir, OR ship .js.
 */
import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { TweakManifest } from "@codex-plusplus/sdk";

export interface DiscoveredTweak {
  dir: string;
  entry: string;
  manifest: TweakManifest;
}

const ENTRY_CANDIDATES = ["index.js", "index.cjs", "index.mjs"];

export function discoverTweaks(tweaksDir: string): DiscoveredTweak[] {
  if (!existsSync(tweaksDir)) return [];
  const out: DiscoveredTweak[] = [];
  for (const name of readdirSync(tweaksDir)) {
    const dir = join(tweaksDir, name);
    if (!statSync(dir).isDirectory()) continue;
    const manifestPath = join(dir, "manifest.json");
    if (!existsSync(manifestPath)) continue;
    let manifest: TweakManifest;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as TweakManifest;
    } catch {
      continue;
    }
    if (!manifest.id || !manifest.name || !manifest.version) continue;
    const entry = resolveEntry(dir, manifest);
    if (!entry) continue;
    out.push({ dir, entry, manifest });
  }
  return out;
}

function resolveEntry(dir: string, m: TweakManifest): string | null {
  if (m.main) {
    const p = join(dir, m.main);
    return existsSync(p) ? p : null;
  }
  for (const c of ENTRY_CANDIDATES) {
    const p = join(dir, c);
    if (existsSync(p)) return p;
  }
  return null;
}
