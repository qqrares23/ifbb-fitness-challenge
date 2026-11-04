// Builds the Windows app, then copies the installer to Downloads. (No portable .exe: it can't update
// itself, since an update runs the installer, which installs a separate copy.)
// Usage: npm run release:win
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Updates are signed (tauri.conf.json has the public key); the private key stays outside the repo.
const keyFile = join(homedir(), ".tauri", "ifbb-fitness-challenge.key");
if (!process.env.TAURI_SIGNING_PRIVATE_KEY) {
  if (!existsSync(keyFile)) throw new Error(`The update signing key is missing: set TAURI_SIGNING_PRIVATE_KEY or put it at ${keyFile}`);
  process.env.TAURI_SIGNING_PRIVATE_KEY = readFileSync(keyFile, "utf8");
}
process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ??= ""; // the key has no password; stdin is closed, so tauri can't ask

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

copyFileSync(join(setupDir, setup), join(downloads, setup));
console.log(`Copied → ${join(downloads, setup)}`);
