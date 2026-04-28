import type { TweakManifest } from "@codex-plusplus/sdk";
export interface DiscoveredTweak {
    dir: string;
    entry: string;
    manifest: TweakManifest;
}
export declare function discoverTweaks(tweaksDir: string): DiscoveredTweak[];
