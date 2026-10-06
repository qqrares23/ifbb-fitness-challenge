# IFBB Fitness Challenge

A desktop app (Windows, macOS and Linux) for running IFBB competitions fully offline: manage athletes and
the exercise library, set up a competition (categories, entries), record results live, and export
official results as PDF or CSV. Two challenge types:

- **Fitness Challenge** — reps at each station; most total reps wins.
- **Speed Fit** — one time for the whole set of exercises; fastest wins.

Built with Tauri 2, React 19, TypeScript and SQLite. All data stays on the computer, in the app's
data folder (`fitness-challenge.db`).

## Development

Requires Node.js (LTS) and the Rust toolchain (https://rustup.rs).

```bash
npm install
npm run tauri dev     # run the app with hot reload
npm test              # engine + logic tests
npm run typecheck
npm run tauri build   # installers for the current OS, in src-tauri/target/release/bundle/
```

## Releases

Push a version tag to build installers for all three platforms on GitHub Actions:

```bash
git tag v0.1.0 && git push origin v0.1.0
```

The `.dmg` (universal: Apple Silicon + Intel), the Windows `.msi` / `setup.exe` and the Linux
`.AppImage` / `.deb` / `.rpm` are attached to a
**draft** release on GitHub. The macOS build is not code-signed, so on first launch macOS asks for
confirmation: right-click the app → **Open**. Signing needs an Apple Developer account.

## Structure

| Path | Contents |
|---|---|
| `src/engine/` | Pure ranking, age and eligibility rules — no database or UI imports, fully tested |
| `src/db/` | The only place SQL lives: one module per table |
| `src/features/` | Screens, one folder per area (athletes, exercises, categories, competitions, data) |
| `src/export/` | PDF and CSV builders, sharing one results-table layout |
| `src/components/` | Shared UI (shadcn primitives in `ui/`) |
| `src-tauri/migrations/` | Database schema and lifecycle rules (enforced by SQLite triggers) |

Ranking: Fitness Challenge by total reps (highest first), Speed Fit by time (fastest first; athletes
without a time are listed last, unplaced). Equal Fitness Challenge totals are split by reps on the
last station, then the one before it, and so on. Results still equal share a place and the next place is
skipped (1, 1, 3). Age for categories = the competition's year minus the year of birth.
