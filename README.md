# codex-plusplus

A tweak system for the [Codex](https://chatgpt.com/codex) desktop app. Inject custom features, fix UI bugs, and add a tweak manager — without rebuilding the app.

> **Status:** alpha. The architecture is designed but the installer needs real-device testing on each platform before declaring victory. PRs welcome.

## What it does

`codex-plusplus` patches your local Codex.app installation so a small **loader** runs on startup. The loader pulls a **runtime** from your user directory, which discovers and loads **tweaks** (small ESM modules with a manifest + `start/stop` lifecycle). The runtime injects a "Tweaks" tab into Codex's settings UI so you can enable, disable, and configure tweaks in-app.

Everything beyond the one-time install patch lives **outside** the app bundle, so iterating on tweaks is just save-and-reload.

## Install

```sh
npx codex-plusplus install
```

That's it. The installer:

1. Locates your Codex.app (`/Applications/Codex.app`, `%LOCALAPPDATA%/codex/...`, etc.).
2. Backs it up to `~/.codex-plusplus/backup/`.
3. Patches `app.asar` to require our loader.
4. Recomputes the asar header SHA-256 and writes it into `Info.plist` (`ElectronAsarIntegrity`).
5. Flips `EnableEmbeddedAsarIntegrityValidation` in the Electron Framework binary as a belt-and-suspenders.
6. Re-signs the app ad-hoc on macOS (`codesign --force --deep --sign -`).
7. Installs a launch agent / login item that detects Sparkle auto-updates and prompts to repair.

To revert:

```sh
npx codex-plusplus uninstall
```

Other commands: `status`, `doctor`, `repair`, `tweaks list`, `tweaks open` (opens user tweaks dir).

## Writing a tweak

A tweak is a folder under `<user-data-dir>/tweaks/` with:

```
my-tweak/
├── manifest.json
└── index.js            # or .mjs / .ts (transpiled by runtime)
```

```json
{
  "id": "com.you.my-tweak",
  "name": "My Tweak",
  "version": "0.1.0",
  "author": "you",
  "description": "Adds a button.",
  "minRuntime": "0.1.0"
}
```

```ts
import type { Tweak } from "@codex-plusplus/sdk";

export default {
  start(api) {
    api.settings.register({
      id: "my-tweak",
      title: "My Tweak",
      render: (root) => {
        root.innerHTML = `<button>hi</button>`;
      },
    });
    api.log.info("started");
  },
  stop() {},
} satisfies Tweak;
```

See [`docs/WRITING-TWEAKS.md`](./docs/WRITING-TWEAKS.md) for the full API.

## How it works (TL;DR)

| Thing | Location |
|---|---|
| Loader stub | `Codex.app/Contents/Resources/app.asar` (entry replaced with `loader.cjs`) |
| Runtime | `<user-data-dir>/runtime/` (auto-installed, hot-reloadable) |
| Tweaks | `<user-data-dir>/tweaks/` |
| Config | `<user-data-dir>/config.json` |
| Backup | `<user-data-dir>/backup/` |

`<user-data-dir>` per-OS:

- macOS: `~/Library/Application Support/codex-plusplus/`
- Linux: `$XDG_DATA_HOME/codex-plusplus/` (default `~/.local/share/codex-plusplus/`)
- Windows: `%APPDATA%/codex-plusplus/`

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for details.

## Legal

This is an unofficial project. Not affiliated with OpenAI. Modifying Codex.app violates its code signature; on macOS you may need to allow the re-signed app on first launch. Auto-updates from Sparkle will overwrite the patch — `codex-plusplus` includes a watcher that detects this and prompts to repair.

Use at your own risk.

MIT.
