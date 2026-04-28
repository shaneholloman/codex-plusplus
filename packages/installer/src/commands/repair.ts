import kleur from "kleur";
import { install } from "./install.js";
import { ensureUserPaths } from "../paths.js";
import { readState } from "../state.js";

interface Opts {
  app?: string;
}

/**
 * `repair` is essentially `install` rerun, but it preserves the user's
 * config + tweaks (which `install` already does) and skips the watcher
 * install if one is already in place. We re-derive everything from the
 * current Codex.app on disk; the new asar/plist/framework hashes will
 * differ from those in `state.json` after a Sparkle update, so we just
 * overwrite state.
 */
export async function repair(opts: Opts = {}): Promise<void> {
  const paths = ensureUserPaths();
  const state = readState(paths.stateFile);
  if (!state) {
    console.warn(
      kleur.yellow("No prior install state found. Running fresh install instead."),
    );
  }
  await install({
    app: opts.app ?? state?.appRoot,
    fuse: state?.fuseFlipped ?? true,
    resign: state?.resigned ?? true,
    watcher: false, // already installed if state exists; install command won't fail if not
  });
  console.log(kleur.green("✓ Repair complete."));
}
