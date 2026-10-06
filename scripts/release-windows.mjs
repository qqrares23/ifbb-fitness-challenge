// Builds the Windows app, then copies the installer and the portable .exe to Downloads.
// Usage: npm run release:win
import { execSync } from "node:child_process";
import { copyFileSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const run = (command) => execSync(command, { stdio: ["ignore", "inherit", "inherit"] });
run("npm run tauri build");

// Wherever cargo builds to (src-tauri/.cargo/config.toml may move it out of the project).
const metadata = JSON.parse(execSync("cargo metadata --format-version 1 --no-deps", { cwd: "src-tauri" }).toString());
const release = join(metadata.target_directory, "release");
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const downloads = join(homedir(), "Downloads");

const setupDir = join(release, "bundle", "nsis");
const setup = readdirSync(setupDir).find((f) => f.endsWith(`${version}_x64-setup.exe`));
if (!setup) throw new Error(`No ${version} installer found in ${setupDir}`);

const copies = [
  [join(setupDir, setup), join(downloads, setup)],
  [join(release, "ifbb-fitness-challenge.exe"), join(downloads, `IFBB Fitness Challenge ${version} (portable).exe`)],
];
for (const [from, to] of copies) {
  copyFileSync(from, to);
  console.log(`Copied → ${to}`);
}
