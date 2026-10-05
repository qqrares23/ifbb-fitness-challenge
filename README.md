# IFBB Fitness Challenge

A desktop app (Windows and macOS) for running IFBB Fitness Challenge competitions fully offline:
manage athletes and the exercise library, set up a competition (stations, categories, entries),
record reps live, and export official results as PDF or CSV.

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

Push a version tag to build installers for both platforms on GitHub Actions:

```bash
git tag v0.1.0 && git push origin v0.1.0
```

The `.dmg` (universal: Apple Silicon + Intel) and the Windows `.msi` / `setup.exe` are attached to a
**draft** release on GitHub. The macOS build is not code-signed, so on first launch macOS asks for
confirmation: right-click the app → **Open**. Signing needs an Apple Developer account.

## Structure

| Path | Contents |
|---|---|
| `src/engine/` | Pure ranking, age and eligibility rules — no database or UI imports, fully tested |
| `src/db/` | The only place SQL lives: one module per table |
| `src/features/` | Screens, one folder per area (athletes, exercises, competitions) |
| `src/export/` | PDF and CSV builders, sharing one results-table layout |
| `src/components/` | Shared UI (shadcn primitives in `ui/`) |
| `src-tauri/migrations/` | Database schema and lifecycle rules (enforced by SQLite triggers) |

Ranking: total reps across all stations, highest first; equal totals share a place and the next
place is skipped (1, 1, 3).
