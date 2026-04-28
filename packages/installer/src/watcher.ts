/**
 * Watcher: a small process scheduled to run at user login that compares the
 * current Codex.app's asar hash against the patched hash we recorded at
 * install. If they don't match, Sparkle has updated Codex over our patch —
 * we either auto-`repair` or surface a notification, depending on user prefs.
 *
 * Implementation per OS:
 *   macOS:   ~/Library/LaunchAgents/com.codexplusplus.watcher.plist (launchd)
 *   Linux:   ~/.config/systemd/user/codex-plusplus-watcher.service (systemd --user)
 *   Windows: Task Scheduler entry via schtasks.exe
 *
 * The watcher itself is just `codex-plusplus repair --quiet` triggered on the
 * relevant event (app launch / login). The simplest cross-platform approach
 * is "run at login" + "run when Codex.app is modified" (FSEvents/inotify on
 * unix, but launchd's WatchPaths handles it on mac).
 */
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { homedir, platform } from "node:os";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";

export type WatcherKind = "launchd" | "login-item" | "scheduled-task" | "systemd" | "none";

export function installWatcher(appRoot: string): WatcherKind {
  switch (platform()) {
    case "darwin":
      return installLaunchd(appRoot);
    case "linux":
      return installSystemd(appRoot);
    case "win32":
      return installScheduledTask(appRoot);
    default:
      return "none";
  }
}

export function uninstallWatcher(): void {
  switch (platform()) {
    case "darwin":
      return uninstallLaunchd();
    case "linux":
      return uninstallSystemd();
    case "win32":
      return uninstallScheduledTask();
  }
}

const LABEL = "com.codexplusplus.watcher";

function launchdPath(): string {
  return join(homedir(), "Library", "LaunchAgents", `${LABEL}.plist`);
}

function installLaunchd(appRoot: string): WatcherKind {
  const plPath = launchdPath();
  mkdirSync(dirname(plPath), { recursive: true });
  // Trigger on login + when Codex.app's asar changes. Run our `repair` command.
  // We call `npx -y codex-plusplus@latest repair` so the watcher self-updates.
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>-c</string>
    <string>command -v npx >/dev/null 2>&amp;1 &amp;&amp; npx -y codex-plusplus@latest doctor || true</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>WatchPaths</key>
  <array>
    <string>${appRoot}/Contents/Resources/app.asar</string>
  </array>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  <string>${join(homedir(), "Library", "Logs", "codex-plusplus-watcher.log")}</string>
  <key>StandardErrorPath</key>
  <string>${join(homedir(), "Library", "Logs", "codex-plusplus-watcher.log")}</string>
</dict>
</plist>`;
  writeFileSync(plPath, xml);
  try {
    execFileSync("launchctl", ["unload", plPath], { stdio: "ignore" });
  } catch {}
  execFileSync("launchctl", ["load", plPath], { stdio: "ignore" });
  return "launchd";
}

function uninstallLaunchd(): void {
  const plPath = launchdPath();
  if (!existsSync(plPath)) return;
  try {
    execFileSync("launchctl", ["unload", plPath], { stdio: "ignore" });
  } catch {}
  rmSync(plPath, { force: true });
}

function installSystemd(appRoot: string): WatcherKind {
  const dir = join(homedir(), ".config", "systemd", "user");
  mkdirSync(dir, { recursive: true });
  const unit = `[Unit]
Description=codex-plusplus repair watcher

[Service]
Type=oneshot
ExecStart=/bin/sh -c 'command -v npx >/dev/null 2>&1 && npx -y codex-plusplus@latest doctor || true'

[Install]
WantedBy=default.target
`;
  writeFileSync(join(dir, "codex-plusplus-watcher.service"), unit);
  // We omit a .path unit here; users running `repair` after Codex updates is
  // the simpler default. Power users can add a path unit themselves.
  try {
    execFileSync("systemctl", ["--user", "daemon-reload"], { stdio: "ignore" });
    execFileSync("systemctl", ["--user", "enable", "codex-plusplus-watcher.service"], {
      stdio: "ignore",
    });
  } catch {
    /* systemd may not be available */
  }
  return "systemd";
}

function uninstallSystemd(): void {
  const path = join(homedir(), ".config", "systemd", "user", "codex-plusplus-watcher.service");
  if (!existsSync(path)) return;
  try {
    execFileSync("systemctl", ["--user", "disable", "codex-plusplus-watcher.service"], {
      stdio: "ignore",
    });
  } catch {}
  rmSync(path, { force: true });
}

function installScheduledTask(_appRoot: string): WatcherKind {
  // schtasks.exe creates a logon-trigger task. We pass the npx command via /TR.
  // Quoting on Windows is delicate; leaving this as a TODO until we can test
  // on a real Codex install.
  try {
    execFileSync("schtasks.exe", [
      "/Create",
      "/F",
      "/SC",
      "ONLOGON",
      "/TN",
      "codex-plusplus-watcher",
      "/TR",
      `cmd /c npx -y codex-plusplus@latest doctor`,
    ]);
    return "scheduled-task";
  } catch {
    return "none";
  }
}

function uninstallScheduledTask(): void {
  try {
    execFileSync("schtasks.exe", ["/Delete", "/F", "/TN", "codex-plusplus-watcher"], {
      stdio: "ignore",
    });
  } catch {}
}
